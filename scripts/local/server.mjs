import http from "node:http";
import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { localPaths } from "./paths.mjs";
import { projectRoot } from "./project.mjs";
import { readJson, ensureDatabaseFile, runNode } from "./runtime.mjs";

const paths = localPaths();
const instanceId = process.env.JOBSYNC_INSTANCE_ID;
const token = process.env.JOBSYNC_INSTANCE_TOKEN;
if (!instanceId || !token || process.env.JOBSYNC_LOCAL_RUNTIME !== "1") throw new Error("Start this server through the JobSync local launcher.");
let status = "starting";
let app;
let database;
let web;
let stopping = false;
const migrationAbort = new AbortController();
let migrationInFlight;
const authenticated = (candidate) => typeof candidate === "string" && Buffer.byteLength(candidate) === Buffer.byteLength(token) && timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
const identity = () => ({ ok: true, instanceId, pid: process.pid, projectRoot, status });

async function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  status = "stopping";
  console.log("[local] Waiting for HTTP requests and Next.js to close...");
  // Only this authenticated server exits; the launcher never kills a PID.
  const timeout = setTimeout(() => { migrationAbort.abort(); console.error("[local] Shutdown grace period expired."); process.exit(1); }, 60_000);
  try {
    // Finish an active formal migration before honoring window close/parent
    // disconnect. Interrupting it can leave Prisma's migration log incomplete.
    if (migrationInFlight) await migrationInFlight.catch(() => {});
    if (web?.listening) await new Promise((resolve) => web.close(resolve));
    await app?.close();
    await database?.$disconnect();
    await new Promise((resolve) => ipc.close(resolve));
    const state = await readJson(paths.state);
    if (state?.instanceId === instanceId) await fs.unlink(paths.state);
    clearTimeout(timeout);
    console.log("[local] Stopped.");
    process.exit(exitCode);
  } catch (error) { console.error(error); process.exit(1); }
}

const ipc = net.createServer((socket) => {
  let input = "";
  socket.setTimeout(2000, () => socket.destroy());
  socket.on("error", () => {});
  socket.on("data", (chunk) => {
    input += chunk;
    if (input.length > 4096) { socket.destroy(); return; }
    if (!input.includes("\n")) return;
    try {
      const request = JSON.parse(input.split("\n")[0]);
      if (!authenticated(request.token) || request.instanceId !== instanceId || !["status", "stop"].includes(request.command)) {
        socket.end(JSON.stringify({ ok: false }) + "\n"); return;
      }
      socket.end(JSON.stringify(identity()) + "\n");
      if (request.command === "stop") socket.once("close", () => void shutdown());
    } catch { socket.destroy(); }
  });
});

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
// Electron owns the IPC channel. Even a hard-killed GUI closes it, so the
// backend shuts itself down instead of remaining as a detached Node process.
if (process.env.JOBSYNC_DESKTOP === "1") {
  if (!process.send) throw new Error("Desktop backend requires its parent IPC channel.");
  process.on("disconnect", () => void shutdown());
}

async function startServer() {
try {
  await new Promise((resolve, reject) => { ipc.once("error", reject); ipc.listen(paths.serverPipe, resolve); });
  if (stopping) return;
  if (process.env.JOBSYNC_DESKTOP === "1") {
    await ensureDatabaseFile(paths.database);
    if (stopping) return;
    migrationInFlight = runNode(path.join(projectRoot, "node_modules/prisma/build/index.js"), ["migrate", "deploy"], process.env,
      path.join(paths.logs, "desktop-migrations.log"), migrationAbort.signal);
    await migrationInFlight;
    if (stopping) return;
    const required = await readJson(path.join(projectRoot, ".next-desktop/required-server-files.json"));
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(required.config);
  }
  const { default: next } = await import("next");
  const { PrismaClient } = await import("@prisma/client");
  database = new PrismaClient();
  await database.user.count();
  app = next({ dev: false, dir: projectRoot, hostname: "127.0.0.1", port: 3737 });
  await app.prepare();
  const handler = app.getRequestHandler();
  web = http.createServer(async (req, res) => {
    if (req.url?.split("?")[0] === "/_jobsync/health") {
      res.setHeader("Cache-Control", "no-store");
      if (req.method !== "GET" || !authenticated(req.headers.authorization?.replace(/^Bearer /, ""))) { res.writeHead(404).end(); return; }
      try {
        await database.user.count();
        res.writeHead(status === "ready" ? 200 : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ...identity(), ready: status === "ready" }));
      } catch { res.writeHead(503).end(); }
      return;
    }
    try { await handler(req, res); }
    catch (error) { console.error(error); if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  await new Promise((resolve, reject) => { web.once("error", reject); web.listen(3737, "127.0.0.1", resolve); });
  status = "ready";
  console.log(`[local] Ready on http://127.0.0.1:3737; PID ${process.pid}; timezone ${process.env.TZ}`);
} catch (error) { console.error("[local] Startup failed:", error); await shutdown(1); }
}
if (process.env.JOBSYNC_DESKTOP === "1" && !process.connected) await shutdown();
else await startServer();
