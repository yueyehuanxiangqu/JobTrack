// Real electron-updater over an owned loopback release server. Downloads only;
// installation is forbidden and all cache writes stay in the isolated home.
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import http from "node:http";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { _electron, expect } from "@playwright/test";
import { localPaths, origin } from "../local/paths.mjs";
import { projectRoot } from "../local/project.mjs";
const paths = localPaths();
assert(paths.home.startsWith(path.join(projectRoot, ".local-runtime-test") + path.sep));
assert(process.env.JOBTRACK_ELECTRON_EXE);
const pkg = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
const name = `JobTrack-Setup-${pkg.version}.exe`, oldName = "JobTrack-Setup-0.1.0.exe";
const artifact = path.join(projectRoot, "dist-desktop", name), old = path.join(projectRoot, "dist-desktop", oldName);
const metadata = await fs.readFile(path.join(projectRoot, "dist-desktop/latest.yml"));
const total = (await fs.stat(artifact)).size;
const requests = [], fake = Buffer.from("MZ fixture only: never execute this checksum-failure payload.".repeat(20));
const badInfo = Buffer.from(JSON.stringify({ version: "9.9.9", files: [{ url: "JobTrack-Setup-9.9.9.exe", sha512: Buffer.alloc(64).toString("base64"), size: fake.length }], path: "JobTrack-Setup-9.9.9.exe", sha512: Buffer.alloc(64).toString("base64") }));
const routes = new Map([["/latest.yml", metadata], [`/${name}`, artifact], [`/${name}.blockmap`, artifact + ".blockmap"], [`/${oldName}.blockmap`, old + ".blockmap"], ["/bad/latest.yml", badInfo], ["/bad/JobTrack-Setup-9.9.9.exe", fake]]);
const server = http.createServer(async (req, res) => {
  try {
    const item = routes.get(new URL(req.url, "http://127.0.0.1").pathname);
    if (!item) { res.writeHead(404).end(); return; }
    const size = Buffer.isBuffer(item) ? item.length : (await fs.stat(item)).size;
    let start = 0, end = size - 1, status = 200;
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d+)$/);
    if (req.headers.range && !range) { res.writeHead(416).end(); return; }
    if (range) { start = Number(range[1]); end = Number(range[2]); status = 206; }
    if (start > end || end >= size) { res.writeHead(416).end(); return; }
    const headers = { "Content-Length": end - start + 1, "Accept-Ranges": "bytes" };
    if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    requests.push({ path: req.url, range: !!range, bytes: end - start + 1 });
    res.writeHead(status, headers);
    if (req.method === "HEAD") res.end();
    else if (Buffer.isBuffer(item)) res.end(item.subarray(start, end + 1));
    else createReadStream(item, { start, end }).on("error", () => res.destroy()).pipe(res);
  } catch { res.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const cacheBase = path.join(paths.home, "verification/update-sdk-cache");
const cacheName = "jobtrack-desktop-updater";
await fs.mkdir(path.join(cacheBase, cacheName), { recursive: true });
await fs.copyFile(old, path.join(cacheBase, cacheName, "installer.exe"));
await fs.copyFile(old + ".blockmap", path.join(cacheBase, cacheName, "current.blockmap"));
const env = { ...process.env, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` };
delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
const app = await _electron.launch({ executablePath: process.env.JOBTRACK_ELECTRON_EXE, env, timeout: 120_000 });
let report;
try {
  await expect.poll(() => app.windows().some(w => w.url().startsWith(origin)), { timeout: 120_000 }).toBe(true);
  report = await app.evaluate(async ({ app }, args) => {
    const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/package.json");
    const { NsisUpdater } = require("electron-updater");
    const requireUpdater = process.getBuiltinModule("module").createRequire(require.resolve("electron-updater"));
    const fs = process.getBuiltinModule("fs"), crypto = process.getBuiltinModule("crypto");
    const make = (url, cache, current) => {
      const sdk = new NsisUpdater({ provider: "generic", url, useMultipleRangeRequest: false });
      sdk.autoDownload = false; sdk.autoInstallOnAppQuit = false; sdk.disableWebInstaller = true;
      sdk.logger = { info() {}, warn() {}, error() {}, debug() {} }; sdk.on("error", () => {});
      Object.defineProperty(sdk.app, "baseCachePath", { value: cache });
      Object.defineProperty(sdk.app, "version", { value: current });
      sdk.currentVersion = new (requireUpdater("semver").SemVer)(current);
      sdk.quitAndInstall = () => { throw new Error("Installation is forbidden in download verification."); };
      return sdk;
    };
    const sdk = make(args.base, args.cache, "0.1.0");
    const check = await sdk.checkForUpdates();
    const files = await sdk.downloadUpdate();
    if (!files[0].startsWith(args.cache + process.getBuiltinModule("path").sep)) throw Error("Updater escaped test cache");
    const hash = crypto.createHash("sha256"); for await (const chunk of fs.createReadStream(files[0])) hash.update(chunk);
    const bad = make(args.base + "/bad", args.cache + "-bad", args.version);
    await bad.checkForUpdates(); let checksumRejected = false;
    try { await bad.downloadUpdate(); } catch (error) { checksumRejected = error.code === "ERR_CHECKSUM_MISMATCH"; }
    return { version: check.updateInfo.version, sha256: hash.digest("hex"), checksumRejected };
  }, { base, cache: cacheBase, version: pkg.version });
  const expected = createHash("sha256"); for await (const chunk of createReadStream(artifact)) expected.update(chunk);
  assert.equal(report.version, pkg.version); assert.equal(report.sha256, expected.digest("hex")); assert.equal(report.checksumRejected, true);
  const transfer = requests.filter(r => r.path === `/${name}`);
  report.rangeRequests = transfer.filter(r => r.range).length;
  report.fullDownloads = transfer.filter(r => !r.range).length;
  report.bytesTransferred = transfer.reduce((n, r) => n + r.bytes, 0); report.fullSize = total;
  assert(report.rangeRequests > 0, "Differential HTTP range requests were not attempted");
  console.log("PASS real NSIS SDK downloads the exact new installer through an isolated local feed and rejects a wrong SHA-512.");
  console.log(JSON.stringify(report));
} finally {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.close())).catch(() => {});
  await app.close().catch(() => {}); await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(paths.home, "verification/update-download-report.json"), JSON.stringify({ report, requests }, null, 2));
}
