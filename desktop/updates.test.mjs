import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import vm from "node:vm";
import fs from "node:fs";
const { createUpdates, registerUpdates, trustedSender } = createRequire(import.meta.url)("./updates.cjs");
function fixture(supported = true) {
  const updater = new EventEmitter(), calls = [], notices = [];
  updater.checkForUpdates = async () => { calls.push("check"); updater.emit("update-available", { version: "0.1.2", secret: "private" }); };
  updater.downloadUpdate = async () => { calls.push("download"); updater.emit("download-progress", { percent: 42.4 }); updater.emit("update-downloaded", { version: "0.1.2", downloadedFile: "private-path" }); };
  const api = createUpdates({ updater, version: "0.1.1", supported, notify: value => notices.push(value),
    cancellationToken: () => ({ cancelled: false, cancel() { this.cancelled = true; } }), restart: async () => calls.push("restart") });
  return { updater, api, calls, notices };
}
test("checks and downloads only on request, disables auto-install/downgrade and prefers differential downloads", async () => {
  const { api, updater, calls, notices } = fixture();
  assert.deepEqual(calls, []); await api.download(); await api.install(); assert.deepEqual(calls, []);
  assert.equal(updater.autoDownload, false); assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowDowngrade, false); assert.equal(updater.allowPrerelease, false); assert.equal(updater.disableDifferentialDownload, false);
  await api.check(); assert.deepEqual(calls, ["check"]); assert.equal(api.snapshot().phase, "available");
  await api.download(); assert.equal(api.snapshot().phase, "downloaded");
  assert.equal(notices.find(n => n.phase === "downloading" && n.percent === 42.4)?.version, "0.1.2");
  assert(!JSON.stringify(notices).includes("private"));
  await api.check(); assert.deepEqual(calls, ["check", "download"]);
  await api.install(); assert.deepEqual(calls, ["check", "download", "restart"]);
});
test("cancels one in-flight download without allowing late completion or parallel requests", async () => {
  const { api, updater, calls } = fixture(); let done;
  updater.downloadUpdate = token => new Promise(resolve => { calls.push("download"); done = () => { assert.equal(token.cancelled, true); updater.emit("update-downloaded", { version: "0.1.2" }); resolve([]); }; });
  await api.check(); const pending = api.download(); await api.download(); await api.check();
  assert.deepEqual(calls, ["check", "download"]); api.cancel(); done(); await pending;
  assert.equal(api.snapshot().phase, "idle"); await api.install(); assert(!calls.includes("restart"));
  await api.check(); assert.equal(api.snapshot().phase, "available");
});
test("bounds progress and reports offline, checksum and unpublished-release errors without raw secrets", async () => {
  const { api, updater } = fixture();
  for (const [code, phase, message] of [["ERR_UPDATER_NO_PUBLISHED_VERSIONS", "no-release", "No Windows update"], ["ERR_UPDATER_CHANNEL_FILE_NOT_FOUND", "error", "missing update files"], ["ERR_CHECKSUM_MISMATCH", "error", "verification failed"], ["ECONNRESET", "error", "connection"]]) {
    updater.checkForUpdates = async () => { throw Object.assign(new Error("private-token raw URL"), { code }); };
    await api.check(); assert.equal(api.snapshot().phase, phase); assert(api.snapshot().message.includes(message)); assert(!JSON.stringify(api.snapshot()).includes("private-token"));
  }
});
test("unsupported developer runs never invoke updater or restart", async () => {
  const { api, calls } = fixture(false); await api.check(); await api.download(); await api.install(); assert.deepEqual(calls, []); assert.equal(api.snapshot().phase, "unsupported");
});
test("only the exact main renderer frame can access fixed no-argument IPC actions", async () => {
  const handlers = new Map(), { api } = fixture();
  const frame = { url: "http://127.0.0.1:3737/dashboard/settings" };
  const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  const event = { sender: window.webContents, senderFrame: frame };
  registerUpdates({ handle: (name, handler) => handlers.set(name, handler) }, () => window, api);
  assert.equal(handlers.size, 5); assert.equal(trustedSender(event, window), true);
  const status = handlers.get("jobtrack:update:state"); assert.equal(status(event).currentVersion, "0.1.1");
  assert.throws(() => status(event, { url: "https://evil.example" }), /denied/);
  for (const forged of [{ ...event, sender: {} }, { ...event, senderFrame: { url: frame.url } }, { ...event, senderFrame: { url: "https://evil.example" } }]) assert.throws(() => status(forged), /denied/);
  frame.url = "http://127.0.0.1:3738/"; assert.throws(() => status(event), /denied/);
});
test("sandbox preload exposes specific methods and strips the Electron event from subscribers", async () => {
  let bridge; const callbacks = new Map(), calls = [];
  const ipcRenderer = { invoke: channel => calls.push(channel), on: (channel, fn) => callbacks.set(channel, fn), removeListener: channel => callbacks.delete(channel) };
  vm.runInNewContext(fs.readFileSync(new URL("./preload.cjs", import.meta.url), "utf8"), { require: name => { assert.equal(name, "electron"); return { ipcRenderer, contextBridge: { exposeInMainWorld: (name, value) => { assert.equal(name, "jobtrackUpdates"); bridge = value; } } }; } });
  assert(Object.isFrozen(bridge)); assert.equal(bridge.invoke, undefined); bridge.check(); assert.deepEqual(calls, ["jobtrack:update:check"]);
  let received; const remove = bridge.subscribe(value => { received = value; }); callbacks.get("jobtrack:update:state")({ sender: "privileged" }, { phase: "idle" }); assert.deepEqual(received, { phase: "idle" }); remove(); assert.equal(callbacks.size, 0);
});
