// Opt-in verification against an already initialized, isolated test home.
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { localPaths, databaseUrl } from "./paths.mjs";
import { projectRoot } from "./project.mjs";
import { readJson } from "./runtime.mjs";

const paths = localPaths();
assert(paths.home.startsWith(path.join(projectRoot, ".local-runtime-test") + path.sep), "Use an isolated JOBTRACK_HOME under .local-runtime-test");
const log = [];
const mark = (name) => { console.log(`PASS ${name}`); log.push(name); };
const cli = path.join(projectRoot, "scripts/local/cli.mjs");
async function command(args, expected = 0) {
  const result = await new Promise((resolve, reject) => {
    // A deliberately different CWD verifies all launcher paths are anchored.
    const child = spawn(process.execPath, [cli, ...args], { cwd: paths.home, env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, output }));
  });
  await fs.appendFile(path.join(paths.logs, "lifecycle.log"), `\n${args.join(" ")}\n${result.output}`);
  assert.equal(result.code, expected, result.output);
  return result.output;
}
async function counts() {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl(paths.database) } } });
  try { return { users: await db.user.count(), jobs: await db.job.count(), resumes: await db.resume.count(), files: await db.file.count(), stages: await db.jobStage.count() }; }
  finally { await db.$disconnect(); }
}

const secrets = await fs.readFile(paths.settings, "utf8");
const before = await counts();
assert(before.users > 0 && before.resumes > 0, "Run verify-browser first to create persistence fixtures");
const otherNode = spawn(process.execPath, ["-e", 'process.on("message",m=>{if(m==="exit")process.exit(0)});setInterval(()=>{},1000);'], {
  windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"],
});
await new Promise((resolve, reject) => { otherNode.once("spawn", resolve); otherNode.once("error", reject); });
try {
  const initial = await readJson(paths.state);
  await Promise.all([command(["start", "--no-browser"]), command(["start", "--no-browser"])]);
  assert.equal((await readJson(paths.state)).pid, initial.pid);
  mark("Concurrent repeated starts retain the same server PID");
  await command(["stop"]);
  process.kill(otherNode.pid, 0);
  assert(otherNode.connected);
  assert.equal(await readJson(paths.state), null);
  mark("Authenticated stop removes ownership state and leaves another Node.js process alive");

  // Simulate PID reuse/tampered metadata. Neither start nor stop may signal it.
  await fs.writeFile(paths.state, JSON.stringify({ pid: otherNode.pid, token: "wrong", instanceId: "wrong", log: "isolated test" }));
  assert.match(await command(["stop"], 1), /cannot be identified safely/);
  assert.match(await command(["start", "--no-browser"], 1), /cannot be identified safely/);
  process.kill(otherNode.pid, 0);
  await fs.unlink(paths.state);
  mark("Unverifiable live PID is never stopped or replaced");

  const unrelated = net.createServer((socket) => socket.end("unrelated test service"));
  await new Promise((resolve, reject) => { unrelated.once("error", reject); unrelated.listen(3737, "127.0.0.1", resolve); });
  try {
    assert.match(await command(["start", "--no-browser"], 1), /Port 3737 is unavailable/);
    await command(["stop"]);
    assert(unrelated.listening);
    mark("Port conflict is reported without stopping the unrelated listener");
  } finally { await new Promise((resolve) => unrelated.close(resolve)); }

  await Promise.all([command(["start", "--no-browser"]), command(["start", "--no-browser"])]);
  const restarted = await readJson(paths.state);
  assert.notEqual(restarted.instanceId, initial.instanceId);
  assert.deepEqual(await counts(), before);
  assert.equal(await fs.readFile(paths.settings, "utf8"), secrets);
  mark("Concurrent cold starts create one identified server and retain database rows and keys");
  const buildId = await fs.readFile(path.join(projectRoot, ".next-local/BUILD_ID"), "utf8");
  await command(["stop"]);
  const output = await command(["start", "--no-browser"]);
  assert.match(output, /Using the existing production build/);
  assert.doesNotMatch(output, /ci --include|Running: next build/);
  assert.equal(await fs.readFile(path.join(projectRoot, ".next-local/BUILD_ID"), "utf8"), buildId);
  assert.deepEqual(await counts(), before);
  mark("Daily restart reuses dependencies/build and preserves data from a different working directory");
} finally {
  if (otherNode.connected) {
    const exited = new Promise((resolve) => otherNode.once("exit", resolve));
    otherNode.send("exit"); await exited;
  }
  await fs.writeFile(path.join(paths.home, "verification/lifecycle-report.json"), JSON.stringify({ passed: log }, null, 2));
}
