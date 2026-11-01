import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { _electron, expect } from "@playwright/test";
import { localPaths } from "../local/paths.mjs";
import { projectRoot } from "../local/project.mjs";
import { readJson, health } from "../local/runtime.mjs";

const paths = localPaths();
assert(paths.home.startsWith(path.join(projectRoot, ".local-runtime-test") + path.sep), "Use an isolated test home");
const executablePath = process.env.JOBTRACK_ELECTRON_EXE;
assert(executablePath && path.isAbsolute(executablePath));
const env = { ...process.env, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` };
delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const records = [];
const mark = (message) => { console.log(`PASS ${message}`); records.push(message); };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === "ESRCH") return false; throw error; } };
async function gone(pids) {
  await expect.poll(() => pids.filter(alive), { timeout: 70_000 }).toEqual([]);
}
async function open() {
  const application = await _electron.launch({ executablePath, env, timeout: 60_000 });
  let page;
  await expect.poll(() => {
    page = application.windows().find((window) => window.url().startsWith("http://127.0.0.1:3737"));
    return !!page;
  }, { timeout: 120_000 }).toBe(true);
  return { application, page, state: await readJson(paths.state) };
}
async function close(application) {
  const closed = application.waitForEvent("close");
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.close())).catch(() => {});
  await closed;
}
const config = await fs.readFile(paths.settings, "utf8");
let current;
const otherNode = spawn(process.execPath, ["-e", 'process.on("message",m=>{if(m==="exit")process.exit(0)});setInterval(()=>{},1000);'], { windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
try {
  current = await open();
  const mainPid = await current.application.evaluate(() => process.pid);
  assert.equal(current.state.owner, "electron");
  await current.page.waitForLoadState("load");
  await current.application.evaluate(({ shell }) => { shell.openExternal = async (url) => { globalThis.jobsyncTestExternalUrl = url; }; });
  await current.page.evaluate(() => {
    const link = document.createElement("a"); link.id = "desktop-security-test-link";
    link.href = "https://example.invalid/jobs/1"; link.target = "_blank"; link.textContent = "Desktop security test";
    link.style.cssText = "position:fixed;top:70px;right:70px;z-index:2147483647;background:white;padding:12px";
    document.body.appendChild(link);
  });
  await current.page.locator("#desktop-security-test-link").click();
  await expect.poll(() => current.application.evaluate(() => globalThis.jobsyncTestExternalUrl)).toBe("https://example.invalid/jobs/1");
  assert(current.page.url().startsWith("http://127.0.0.1:3737"));
  await current.page.locator("#desktop-security-test-link").evaluate((element) => element.remove());
  mark("External links route to the OS browser API while the app remains on its local origin");
  await current.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().startsWith("http:")).minimize());
  assert((await health(current.state)).ready);
  mark("Minimizing the packaged app keeps its owned service running");
  const duplicate = spawn(executablePath, [], { env, windowsHide: true, stdio: "ignore" });
  await new Promise((resolve, reject) => { duplicate.once("error", reject); duplicate.once("exit", resolve); });
  await expect.poll(() => current.application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().startsWith("http:"));
    return !!window && !window.isMinimized() && window.isFocused();
  })).toBe(true);
  assert.equal((await readJson(paths.state)).pid, current.state.pid);
  mark("Second EXE launch focuses/restores the original window without another backend");
  const metrics = await current.application.evaluate(({ app }) => app.getAppMetrics().map((item) => item.pid));
  const backend = current.state.pid;
  await close(current.application); current = null;
  await gone([...metrics, mainPid, backend]);
  assert.equal(await readJson(paths.state), null);
  assert(alive(otherNode.pid));
  mark("Window close exits Electron, renderer/utility processes and backend; unrelated Node survives");

  current = await open();
  assert.equal(await fs.readFile(paths.settings, "utf8"), config);
  const crashPids = await current.application.evaluate(({ app }) => app.getAppMetrics().map((item) => item.pid));
  const crashMain = await current.application.evaluate(() => process.pid);
  const crashBackend = current.state.pid;
  // Deliberately terminate only the main PID obtained from this owned instance.
  process.kill(crashMain);
  await gone([...crashPids, crashBackend]);
  current = null;
  const stale = await readJson(paths.state);
  assert(!stale || !alive(stale.pid), "A crash may leave metadata, but never a live owned process");
  mark("Unexpected main-process termination closes IPC and leaves no owned orphan processes");
  current = await open();
  assert.notEqual(current.state.instanceId, stale?.instanceId);
  assert.equal(await fs.readFile(paths.settings, "utf8"), config);
  await close(current.application); current = null;
  mark("Application restarts after a crash using the existing configuration and keys");

  const unrelated = net.createServer((socket) => socket.end("test"));
  await new Promise((resolve, reject) => { unrelated.once("error", reject); unrelated.listen(3737, "127.0.0.1", resolve); });
  try {
    const failure = await _electron.launch({ executablePath, env });
    current = { application: failure };
    const splash = await failure.firstWindow();
    await expect(splash.locator("#title")).toHaveText("JobTrack could not start");
    await expect(splash.locator("#status")).toContainText("Port 3737 is unavailable");
    assert(unrelated.listening);
    assert.equal(await readJson(paths.state), null);
    await close(failure); current = null;
    mark("Occupied port produces a visible startup error and never stops the other service");
  } finally { await new Promise((resolve) => unrelated.close(resolve)); }

  const cancelHome = path.join(paths.home, `startup-close-${randomUUID()}`);
  const cancel = await _electron.launch({ executablePath, env: { ...env, JOBTRACK_HOME: cancelHome } });
  current = { application: cancel };
  const startupWindow = await cancel.firstWindow();
  await startupWindow.waitForURL(/^file:/);
  assert(startupWindow.url().startsWith("file:"), "Expected the startup window before the main page");
  const cancelPids = await cancel.evaluate(({ app }) => app.getAppMetrics().map((item) => item.pid));
  const cancelState = await readJson(path.join(cancelHome, "config/instance.json"));
  await close(cancel); current = null;
  await gone([...cancelPids, ...(cancelState ? [cancelState.pid] : [])]);
  mark("Closing the startup window cancels launch and leaves no owned processes");
} finally {
  if (current) await current.application.close().catch(() => {});
  if (otherNode.connected) { const exited = new Promise((resolve) => otherNode.once("exit", resolve)); otherNode.send("exit"); await exited; }
  await fs.mkdir(path.join(paths.home, "verification"), { recursive: true });
  await fs.writeFile(path.join(paths.home, "verification/electron-lifecycle.json"), JSON.stringify(records, null, 2));
}
