import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { localPaths, databaseUrl, origin } from "./paths.mjs";
import { projectRoot } from "./project.mjs";
import { ensureSettings, ensureDatabaseFile, runtimeEnv, control } from "./runtime.mjs";

const testRoot = path.join(projectRoot, ".local-runtime-test", `unit-${randomUUID()}`, "中文 空格");
const paths = localPaths({ JOBTRACK_HOME: testRoot });

test("absolute native paths and SQLite URL preserve spaces and Unicode", () => {
  assert.equal(paths.resumes, path.join(testRoot, "data", "files", "resumes"));
  assert.equal(databaseUrl(paths.database), `file:${paths.database.replace(/\\/g, "/")}`);
  assert.throws(() => localPaths({ JOBTRACK_HOME: "relative" }), /absolute/);
  assert.equal(localPaths({ LOCALAPPDATA: path.dirname(testRoot) }).home, path.join(path.dirname(testRoot), "JobTrack"));
});

test("first-run secrets remain unchanged and a damaged config is never replaced", async () => {
  const first = await ensureSettings(paths);
  const before = await fs.readFile(paths.settings, "utf8");
  const second = await ensureSettings(paths);
  assert.deepEqual(first, second);
  assert.equal(await fs.readFile(paths.settings, "utf8"), before);
  assert.notEqual(first.authSecret, first.encryptionKey);
  await fs.writeFile(paths.settings, '{"version":1}');
  await assert.rejects(ensureSettings(paths), /keys were not replaced/);
  assert.equal(await fs.readFile(paths.settings, "utf8"), '{"version":1}');
  // Restore this test's original config so its artifact can be inspected.
  await fs.writeFile(paths.settings, before);
});

test("runtime pins the database, localhost origin and stable keys before Next reads .env", () => {
  const env = runtimeEnv(paths, { authSecret: "auth", encryptionKey: "encryption" });
  assert.equal(env.DATABASE_URL, databaseUrl(paths.database));
  assert.equal(env.AUTH_URL, origin);
  assert.equal(env.NEXTAUTH_URL, origin);
  assert.equal(env.HOSTNAME, "127.0.0.1");
  assert.equal(env.PORT, "3737");
  assert.equal(env.TZ, Intl.DateTimeFormat().resolvedOptions().timeZone);
  assert.equal(env.AUTH_SECRET, "auth");
  assert.equal(env.ENCRYPTION_KEY, "encryption");
});

test("initial database file creation never truncates existing data", async () => {
  await ensureDatabaseFile(paths.database);
  await fs.writeFile(paths.database, "existing database sentinel");
  await ensureDatabaseFile(paths.database);
  assert.equal(await fs.readFile(paths.database, "utf8"), "existing database sentinel");
});

test("control verifies both the random instance identity and PID", async () => {
  const state = { token: "test-token", instanceId: "test-instance", pid: 4321 };
  const server = net.createServer((socket) => {
    socket.on("data", (data) => {
      const request = JSON.parse(data.toString());
      socket.end(JSON.stringify({ ok: request.token === state.token, instanceId: state.instanceId, pid: state.pid }) + "\n");
    });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(paths.serverPipe, resolve); });
  try {
    assert.equal((await control(paths, state, "status")).pid, 4321);
    await assert.rejects(control(paths, { ...state, token: "wrong" }, "stop"), /identity/);
    await assert.rejects(control(paths, { ...state, pid: 1234 }, "stop"), /identity/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("Docker retains standalone output while native builds use a separate directory", async () => {
  const before = process.env.JOBTRACK_LOCAL_RUNTIME;
  try {
    delete process.env.JOBTRACK_LOCAL_RUNTIME;
    const docker = (await import(`../../next.config.mjs?docker=${randomUUID()}`)).default;
    process.env.JOBTRACK_LOCAL_RUNTIME = "1";
    const native = (await import(`../../next.config.mjs?native=${randomUUID()}`)).default;
    assert.equal(docker.output, "standalone");
    assert.equal(docker.distDir, undefined);
    assert.equal(native.distDir, ".next-local");
    assert.equal(native.output, undefined);
  } finally {
    if (before === undefined) delete process.env.JOBTRACK_LOCAL_RUNTIME;
    else process.env.JOBTRACK_LOCAL_RUNTIME = before;
  }
});
