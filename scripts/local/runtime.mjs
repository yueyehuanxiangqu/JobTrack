import fs from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { localPaths, databaseUrl, origin } from "./paths.mjs";
import { projectRoot } from "./project.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

export async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

export async function writeJson(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" });
  await fs.rename(temp, file);
}

export async function ensureDatabaseFile(database) {
  // Prisma 6's Windows missing-database probe can return a bare "Schema
  // engine error". SQLite accepts an empty file; deploy still creates every
  // table/index from the original migrations. Never truncate an existing DB.
  try { await (await fs.open(database, "wx", 0o600)).close(); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
}

export async function ensureSettings(paths) {
  for (const dir of [paths.config, paths.resumes, paths.backups, paths.logs]) {
    await fs.mkdir(dir, { recursive: true });
  }
  let settings = await readJson(paths.settings);
  if (!settings) {
    settings = { version: 1, authSecret: randomBytes(32).toString("base64"), encryptionKey: randomBytes(32).toString("base64") };
    // Never overwrite an existing configuration, including on simultaneous first runs.
    try { await fs.writeFile(paths.settings, JSON.stringify(settings, null, 2), { flag: "wx", mode: 0o600 }); }
    catch (error) { if (error.code !== "EEXIST") throw error; settings = await readJson(paths.settings); }
  }
  if (settings.version !== 1 || typeof settings.authSecret !== "string" || settings.authSecret.length < 32 ||
      typeof settings.encryptionKey !== "string" || settings.encryptionKey.length < 32) {
    throw new Error(`Invalid configuration: ${paths.settings}. Restore it from your configuration backup; keys were not replaced.`);
  }
  return settings;
}

export function runtimeEnv(paths, settings) {
  return {
    ...process.env,
    JOBSYNC_LOCAL_RUNTIME: "1",
    JOBSYNC_HOME: paths.home,
    DATABASE_URL: databaseUrl(paths.database),
    AUTH_SECRET: settings.authSecret,
    ENCRYPTION_KEY: settings.encryptionKey,
    AUTH_URL: origin,
    NEXTAUTH_URL: origin,
    AUTH_TRUST_HOST: "true",
    // Resolve before Next loads the Docker-oriented .env file.
    TZ: Intl.DateTimeFormat().resolvedOptions().timeZone,
    NEXT_TELEMETRY_DISABLED: "1",
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: "3737",
  };
}

export function control(paths, state, command, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(paths.serverPipe);
    let data = "";
    socket.setTimeout(timeout);
    socket.on("connect", () => socket.write(JSON.stringify({ token: state.token, instanceId: state.instanceId, command }) + "\n"));
    socket.on("data", (chunk) => {
      data += chunk;
      if (data.length > 8192) socket.destroy(new Error("Oversized control response"));
      if (data.includes("\n")) {
        try {
          const result = JSON.parse(data.split("\n")[0]);
          if (!result.ok || result.instanceId !== state.instanceId || result.pid !== state.pid) throw new Error("JobSync instance identity did not match");
          socket.end(); resolve(result);
        } catch (error) { socket.destroy(); reject(error); }
      }
    });
    socket.on("timeout", () => socket.destroy(new Error("JobSync control timed out")));
    socket.on("error", reject);
    socket.on("end", () => { if (!data.includes("\n")) reject(new Error("Incomplete control response")); });
  });
}

export async function health(state) {
  const response = await fetch(`${origin}/_jobsync/health`, {
    headers: { authorization: `Bearer ${state.token}` },
    signal: AbortSignal.timeout(2000),
  });
  if (!response.ok) throw new Error("Health check failed");
  const result = await response.json();
  if (result.instanceId !== state.instanceId || result.pid !== state.pid || !result.ready) throw new Error("Health identity mismatch");
  return result;
}

export async function waitReady(paths, state) {
  const until = Date.now() + 120_000;
  while (Date.now() < until) {
    try { await health(state); return; } catch { /* prepare() may still be running */ }
    try { process.kill(state.pid, 0); }
    catch (error) { if (error.code === "ESRCH") throw new Error(`JobSync exited before becoming ready. See ${state.log}`); }
    await pause(500);
  }
  throw new Error(`JobSync did not become ready within 120 seconds. See ${state.log}. Close the desktop app or run npm run local:stop for a CLI instance before retrying.`);
}

export async function assertPortFree() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => reject(new Error(`Port 3737 is unavailable (${error.code}). Another program may be using it; no process was stopped.`)));
    probe.listen(3737, "127.0.0.1", () => probe.close(resolve));
  });
}

// Windows releases named pipes automatically if the launcher crashes. This
// serializes first-time installs and simultaneous double-clicks without stale PID locks.
export async function acquireLock(paths, waitMs = 20 * 60_000) {
  let announced = false;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const server = net.createServer((socket) => socket.end());
    try {
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(paths.launcherPipe, resolve); });
      return () => new Promise((resolve) => server.close(resolve));
    } catch (error) {
      server.close();
      if (error.code !== "EADDRINUSE") throw error;
      if (!announced) { console.log("Another JobSync launcher is working. Waiting for it to finish..."); announced = true; }
      await pause(1000);
    }
  }
  throw new Error("Another JobSync launcher is still working. Check the initialization log and try again later.");
}

async function fingerprint(names) {
  const hash = createHash("sha256");
  async function visit(relative) {
    const full = path.join(projectRoot, relative);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      for (const entry of (await fs.readdir(full)).sort()) await visit(path.join(relative, entry));
    } else { hash.update(relative); hash.update(await fs.readFile(full)); }
  }
  hash.update(`${process.versions.node.split(".")[0]}:${process.platform}:${process.arch}`);
  for (const name of names) await visit(name);
  return hash.digest("hex");
}

export async function runNode(script, args, env, logFile, signal) {
  const stream = createWriteStream(logFile, { flags: "a" });
  console.log(`Running: ${path.basename(script)} ${args.join(" ")}`);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...args], { cwd: projectRoot, env, windowsHide: true, signal, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", (chunk) => { process.stdout.write(chunk); stream.write(chunk); });
      child.stderr.on("data", (chunk) => { process.stderr.write(chunk); stream.write(chunk); });
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Command failed (exit ${code}). See ${logFile}`)));
    });
  } finally { await new Promise((resolve) => stream.end(resolve)); }
}

async function initialize(paths, env, rebuild) {
  const logFile = path.join(paths.logs, "initialization.log");
  const depsFile = path.join(projectRoot, "node_modules", ".jobsync-local-deps.json");
  const depsHash = await fingerprint(["package.json", "package-lock.json", "prisma/schema.prisma"]);
  const deps = await readJson(depsFile);
  const installed = ["next/dist/bin/next", "prisma/build/index.js", ".prisma/client/index.js"].every((file) => existsSync(path.join(projectRoot, "node_modules", file)));
  if (!installed || deps?.hash !== depsHash) {
    const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    if (!existsSync(npmCli)) throw new Error("npm was not found beside Node.js. Install the official Windows Node.js LTS distribution including npm.");
    await runNode(npmCli, ["ci", "--include=dev", "--no-audit", "--no-fund"], env, logFile);
    await runNode(path.join(projectRoot, "node_modules/prisma/build/index.js"), ["generate"], env, logFile);
    await writeJson(depsFile, { hash: depsHash });
  }
  // Deploy preserves migration history and is a quick no-op on daily starts.
  await ensureDatabaseFile(paths.database);
  await runNode(path.join(projectRoot, "node_modules/prisma/build/index.js"), ["migrate", "deploy"], env, logFile);
  const sourceHash = await fingerprint(["src", "public", "prisma", "scripts/local/paths.mjs", "package.json", "package-lock.json", "next.config.mjs", "tsconfig.json", "postcss.config.mjs"]);
  const marker = path.join(projectRoot, ".next-local", "jobsync-build.json");
  const build = await readJson(marker);
  if (rebuild || build?.hash !== sourceHash || !existsSync(path.join(projectRoot, ".next-local", "BUILD_ID"))) {
    await runNode(path.join(projectRoot, "node_modules/next/dist/bin/next"), ["build"], env, logFile);
    await writeJson(marker, { hash: sourceHash, builtAt: new Date().toISOString() });
  } else { console.log("Using the existing production build (dependencies and source unchanged)."); }
}

async function openBrowser() {
  // The URL is a constant; user-controlled paths never enter a shell command.
  await new Promise((resolve, reject) => {
    const child = spawn("cmd.exe", ["/d", "/c", "start", "", origin], { windowsHide: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Browser launch failed (${code}). Open ${origin} manually.`)));
  });
}

export async function launch(command = "start", { noBrowser = false, rebuild = false } = {}) {
  if (process.platform !== "win32") throw new Error("The native launcher requires Windows 11.");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (!((major === 22 && minor >= 12) || (major >= 24 && major % 2 === 0))) throw new Error("Install Node.js 24 LTS (or Node.js 22.12+ LTS) before starting JobSync.");
  const paths = localPaths();
  // No configuration, database or attachment is created by stop/status.
  const release = await acquireLock(paths);
  try {
    let state = await readJson(paths.state);
    let running;
    if (state) {
      try { running = await control(paths, state, "status"); }
      catch (error) {
        // Never replace ownership metadata if a recorded process still exists.
        let alive = true;
        try { process.kill(state.pid, 0); } catch (e) { if (e.code === "ESRCH") alive = false; }
        if (alive) throw new Error(`The recorded JobSync process cannot be identified safely. No process was stopped. Check ${state.log}. ${error.message}`);
        await fs.unlink(paths.state);
        state = null;
      }
    }
    if (command === "stop") {
      if (!running) { console.log("JobSync is not running."); return; }
      await control(paths, state, "stop");
      const deadline = Date.now() + 70_000;
      while (Date.now() < deadline) {
        try { process.kill(state.pid, 0); } catch (error) {
          if (error.code === "ESRCH") { console.log("JobSync stopped. All local data was kept."); return; }
        }
        await pause(250);
      }
      throw new Error(`JobSync has not finished shutting down. No other process was stopped. See ${state.log}`);
    }
    if (command === "status") { console.log(running ? `JobSync ${running.status}: PID ${state.pid}, ${origin}` : "JobSync is not running."); return; }
    if (running) {
      if (!samePath(running.projectRoot, projectRoot)) throw new Error(`Another checkout is using this JobSync data directory: ${running.projectRoot}`);
      if (rebuild || command === "setup") throw new Error("Stop JobSync before initializing or rebuilding.");
      await waitReady(paths, state);
      console.log(`JobSync is already running (PID ${state.pid}).`);
      if (!noBrowser) await openBrowser();
      return;
    }
    await assertPortFree();
    const settings = await ensureSettings(paths);
    const env = runtimeEnv(paths, settings);
    console.log(`Local data: ${paths.data}\nTime zone: ${env.TZ}`);
    await initialize(paths, env, rebuild);
    if (command === "setup") { console.log("Initialization complete. Run npm run local:start for optional browser mode."); return; }
    const instanceId = randomUUID();
    const token = randomBytes(32).toString("hex");
    const logFile = path.join(paths.logs, `server-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
    const output = await fs.open(logFile, "a");
    let child;
    try {
      child = spawn(process.execPath, [path.join(projectRoot, "scripts/local/server.mjs")], {
        cwd: projectRoot, env: { ...env, JOBSYNC_INSTANCE_ID: instanceId, JOBSYNC_INSTANCE_TOKEN: token },
        detached: true, windowsHide: true, stdio: ["ignore", output.fd, output.fd],
      });
      await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    } finally { await output.close(); }
    state = { pid: child.pid, instanceId, token, projectRoot, log: logFile, startedAt: new Date().toISOString() };
    await writeJson(paths.state, state);
    child.unref();
    await waitReady(paths, state);
    console.log(`JobSync is ready: ${origin}\nServer log: ${logFile}`);
    if (!noBrowser) await openBrowser();
  } finally { await release(); }
}
