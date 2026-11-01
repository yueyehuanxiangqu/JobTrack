// Connect only to the isolated app launched through the real installed shortcut.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { localPaths } from "../local/paths.mjs";
import { projectRoot } from "../local/project.mjs";
import { readJson, waitReady } from "../local/runtime.mjs";

const paths = localPaths();
assert(paths.home.startsWith(path.join(projectRoot, ".local-runtime-test") + path.sep));
const state = await readJson(paths.state);
assert.equal(state?.owner, "electron");
await waitReady(paths, state);
const port = (await fs.readFile(path.join(paths.config, "electron/DevToolsActivePort"), "utf8")).split("\n")[0];
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
let page;
await expect.poll(() => {
  page = browser.contexts()[0].pages().find((item) => item.url().startsWith("http://127.0.0.1:3737"));
  return !!page;
}, { timeout: 30_000 }).toBe(true);
await page.waitForLoadState("load");
await page.screenshot({ path: path.join(paths.home, "verification/shortcut-desktop.png"), fullPage: true });
assert((await page.title()).includes("JobTrack"));
console.log("PASS Installed desktop shortcut opens the standalone JobTrack application");
await page.evaluate(() => window.close()).catch(() => {});
await browser.close().catch(() => {});
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === "ESRCH") return false; throw error; } };
await expect.poll(() => [state.pid, state.parentPid].some(alive), { timeout: 70_000 }).toBe(false);
assert.equal(await readJson(paths.state), null);
console.log("PASS Closing the shortcut-launched window exits its GUI and backend");
