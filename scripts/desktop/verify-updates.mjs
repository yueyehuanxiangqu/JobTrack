// Opt-in packaged Electron verification. No real installer is executed.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { _electron, expect } from "@playwright/test";
import { localPaths, origin } from "../local/paths.mjs";
import { projectRoot } from "../local/project.mjs";
const paths = localPaths();
assert(paths.home.startsWith(path.join(projectRoot, ".local-runtime-test") + path.sep));
assert(process.env.JOBTRACK_ELECTRON_EXE);
const artifacts = path.join(paths.home, "verification"); await fs.mkdir(artifacts, { recursive: true });
const env = { ...process.env, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` };
delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
const report = [], errors = [];
const pass = message => { report.push({ passed: true, message }); console.log(`PASS ${message}`); };
const app = await _electron.launch({ executablePath: process.env.JOBTRACK_ELECTRON_EXE, env, timeout: 120_000 });
let page, closed = false;
try {
  await expect.poll(() => { page = app.windows().find(w => w.url().startsWith(origin)); return !!page; }, { timeout: 120_000 }).toBe(true);
  page.on("pageerror", e => errors.push(e.message));
  const bridge = await page.evaluate(() => ({ methods: Object.keys(window.jobtrackUpdates), process: typeof process, require: typeof require }));
  assert.equal(bridge.process, "undefined"); assert.equal(bridge.require, "undefined");
  assert.deepEqual(bridge.methods.sort(), ["cancel", "check", "download", "getState", "install", "subscribe"].sort());
  await app.evaluate(({ app, dialog }, home) => {
    const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/package.json");
    const updater = require("electron-updater").autoUpdater;
    const test = globalThis.__jobtrackUpdateTest = { mode: "none", checks: 0, downloads: 0, dialogs: 0, confirm: false };
    updater.checkForUpdates = async () => {
      test.checks++;
      if (test.mode === "none") throw Object.assign(new Error("fixture-private-details"), { code: "ERR_UPDATER_NO_PUBLISHED_VERSIONS" });
      if (test.mode === "offline") throw Object.assign(new Error("fixture-private-details"), { code: "ECONNRESET" });
      updater.emit("update-available", { version: "0.1.2" }); return { updateInfo: { version: "0.1.2" } };
    };
    updater.downloadUpdate = token => new Promise(resolve => {
      test.downloads++; updater.emit("download-progress", { percent: 42 });
      token.onCancel(() => resolve([]));
      test.complete = () => { updater.emit("update-downloaded", { version: "0.1.2" }); resolve([]); };
    });
    dialog.showMessageBox = async () => { test.dialogs++; return { response: test.confirm ? 0 : 1 }; };
    updater.quitAndInstall = (silent, forceRun) => {
      const fs = process.getBuiltinModule("fs"), path = process.getBuiltinModule("path");
      const serviceStopped = !fs.existsSync(path.join(home, "config/instance.json"));
      fs.writeFileSync(path.join(home, "verification/install-mock.json"), JSON.stringify({ serviceStopped, silent, forceRun, dialogs: test.dialogs }));
      app.quit(); // test double: never spawn or execute an installer
    };
  }, paths.home);
  const suffix = randomUUID().slice(0, 8);
  await page.goto(origin + "/signup");
  await page.getByLabel("Username", { exact: true }).fill(`updates-${suffix}`);
  await page.getByLabel("Password", { exact: true }).fill(`Updates-fixture-${suffix}`);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(origin + "/dashboard");
  await page.goto(origin + "/dashboard/settings");
  await page.getByRole("button", { name: "App Updates", exact: true }).click();
  const panel = page.getByRole("region", { name: "App Updates", exact: true });
  await expect(panel.getByRole("button", { name: "Check for updates" })).toBeEnabled();
  assert.equal(await app.evaluate(() => globalThis.__jobtrackUpdateTest.checks), 0);
  pass("Packaged sandboxed preload loads, exposes only update actions and does not check/download on mount");
  await panel.getByRole("button", { name: "Check for updates" }).click();
  await expect(panel.getByRole("status")).toContainText("No Windows update");
  await app.evaluate(() => { globalThis.__jobtrackUpdateTest.mode = "offline"; });
  await panel.getByRole("button", { name: "Check for updates" }).click();
  await expect(panel.getByRole("alert")).toContainText("connection");
  await expect(panel).not.toContainText("fixture-private-details");
  pass("Unpublished release/offline failures are clear, recoverable and redacted");
  await app.evaluate(() => { globalThis.__jobtrackUpdateTest.mode = "available"; });
  await panel.getByRole("button", { name: "Check for updates" }).click();
  assert.equal(await app.evaluate(() => globalThis.__jobtrackUpdateTest.downloads), 0);
  await panel.getByRole("button", { name: "Download update" }).click();
  await expect(panel.getByRole("progressbar")).toHaveAttribute("value", "42");
  await panel.getByRole("button", { name: "Cancel download" }).click();
  await expect(panel.getByRole("status")).toContainText("cancelled");
  await panel.getByRole("button", { name: "Check for updates" }).click();
  await panel.getByRole("button", { name: "Download update" }).click();
  await expect(panel.getByRole("progressbar")).toHaveAttribute("value", "42");
  await app.evaluate(() => globalThis.__jobtrackUpdateTest.complete());
  await expect(panel.getByRole("button", { name: "Restart and install" })).toBeEnabled();
  pass("User-selected download shows progress, can be cancelled/retried and waits for explicit installation");
  await panel.getByRole("button", { name: "Restart and install" }).click();
  await expect(panel.getByRole("button", { name: "Restart and install" })).toBeEnabled();
  assert.equal(await app.evaluate(() => globalThis.__jobtrackUpdateTest.dialogs), 1);
  assert((await page.request.get(origin + "/api/auth/session")).ok());
  pass("Native restart confirmation cancellation keeps the app and owned service running");
  await panel.screenshot({ path: path.join(artifacts, "updates-ready.png") });
  await app.evaluate(() => { globalThis.__jobtrackUpdateTest.confirm = true; });
  const exit = app.waitForEvent("close");
  await panel.getByRole("button", { name: "Restart and install" }).click().catch(() => {});
  await exit; closed = true;
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(artifacts, "install-mock.json"), "utf8")), { serviceStopped: true, silent: false, forceRun: true, dialogs: 2 });
  assert.deepEqual(errors, []);
  pass("Confirmed install closes the owned backend before calling installer; mock installer only, zero renderer errors");
} catch (error) {
  report.push({ passed: false, message: error.message });
  await page?.screenshot({ path: path.join(artifacts, "updates-failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  if (!closed) { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.close())).catch(() => {}); await app.close().catch(() => {}); }
  await fs.writeFile(path.join(artifacts, "updates-ui-report.json"), JSON.stringify({ report, errors }, null, 2));
}
