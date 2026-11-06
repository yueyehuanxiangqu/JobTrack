import fs from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import JSZip from "jszip";
import { projectRoot } from "../local/project.mjs";

if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Build this Windows x64 distribution on Windows x64.");
const root = path.join(projectRoot, ".desktop-build");
const web = path.join(root, "web");
const runtime = path.join(root, "runtime");
const app = path.join(root, "app");
const nodeVersion = "24.22.1";
const pkg = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
await fs.mkdir(root, { recursive: true });

async function resetBuildDirectory(target) {
  const absolute = path.resolve(target);
  if (path.dirname(absolute) !== root || !["app", "web"].includes(path.basename(absolute))) throw new Error("Refusing to clean a directory outside desktop staging");
  await fs.rm(absolute, { recursive: true, force: true });
  await fs.mkdir(absolute, { recursive: true });
}

async function run(script, args, env = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(projectRoot, script), ...args], {
      cwd: projectRoot, env: { ...process.env, ...env }, windowsHide: true, stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script} failed (${code})`)));
  });
}

async function bundledNode() {
  const cached = path.join(root, "node-download");
  await fs.mkdir(cached, { recursive: true });
  await fs.mkdir(runtime, { recursive: true });
  const name = `node-v${nodeVersion}-win-x64.zip`;
  const archive = path.join(cached, name);
  const base = `https://nodejs.org/dist/v${nodeVersion}`;
  const sumsResponse = await fetch(`${base}/SHASUMS256.txt`, { signal: AbortSignal.timeout(60_000) });
  if (!sumsResponse.ok) throw new Error("Cannot download official Node.js checksums");
  const sums = await sumsResponse.text();
  const expected = sums.split(/\r?\n/).find((line) => line.endsWith(`  ${name}`))?.split(/\s+/)[0];
  if (!expected) throw new Error("Node.js archive missing from official checksum manifest");
  if (!existsSync(archive)) {
    console.log(`Downloading official ${name}`);
    const response = await fetch(`${base}/${name}`, { signal: AbortSignal.timeout(300_000) });
    if (!response.ok) throw new Error(`Node.js download failed: ${response.status}`);
    await fs.writeFile(archive, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = await fs.readFile(archive);
  if (createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error("Node.js archive checksum did not match; remove only this staging archive and retry");
  const zip = await JSZip.loadAsync(bytes);
  for (const name of ["node.exe", "LICENSE"]) {
    const entry = zip.file(`node-v${nodeVersion}-win-x64/${name}`);
    if (!entry) throw new Error(`Missing ${name} in Node.js distribution`);
    await fs.writeFile(path.join(runtime, name), await entry.async("nodebuffer"));
  }
  await fs.writeFile(path.join(runtime, "version.json"), JSON.stringify({ node: nodeVersion, archiveSha256: expected }, null, 2));
}

const env = {
  JOBTRACK_LOCAL_RUNTIME: "1", JOBTRACK_DESKTOP: "1", NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: `file:${path.join(root, "build-only.db").replace(/\\/g, "/")}`,
};
await run("node_modules/prisma/build/index.js", ["generate"], env);
if (!process.argv.includes("--reuse-next")) await run("node_modules/next/dist/bin/next", ["build"], env);
else if (!existsSync(path.join(projectRoot, ".next-desktop/BUILD_ID"))) throw new Error("No desktop production build to reuse");
await resetBuildDirectory(web);
await resetBuildDirectory(app);
await fs.cp(path.join(projectRoot, ".next-desktop/standalone"), web, {
  recursive: true, dereference: true,
  filter: (source) => !path.basename(source).startsWith(".env"),
});
await fs.cp(path.join(projectRoot, ".next-desktop/static"), path.join(web, ".next-desktop/static"), { recursive: true });
await fs.cp(path.join(projectRoot, "public"), path.join(web, "public"), { recursive: true });
await fs.cp(path.join(projectRoot, "prisma"), path.join(web, "prisma"), { recursive: true });
await fs.mkdir(path.join(web, "scripts/local"), { recursive: true });
await fs.mkdir(path.join(app, "scripts/local"), { recursive: true });
for (const destination of [web, app]) {
  await fs.mkdir(path.join(destination, "branding"), { recursive: true });
  await fs.copyFile(path.join(projectRoot, "branding/brand.json"), path.join(destination, "branding/brand.json"));
}
for (const name of ["paths", "project", "runtime", "server", "home-migration", "migrate-home"]) {
  const source = path.join(projectRoot, `scripts/local/${name}.mjs`);
  await fs.copyFile(source, path.join(web, `scripts/local/${name}.mjs`));
  if (!["server", "migrate-home"].includes(name)) await fs.copyFile(source, path.join(app, `scripts/local/${name}.mjs`));
}

// Standalone traces do not cover custom launcher/migration entrypoints. Copy
// installed runtime dependency closures as well, preserving nested versions.
// No npm, compiler, source checkout or registry is needed on the user's PC.
const copied = new Set();
async function packageDir(name, from) {
  let current = from;
  while (true) {
    const candidate = path.join(current, "node_modules", name);
    if (existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Missing runtime dependency ${name}`);
    current = parent;
  }
}
async function copyPackage(source, destination = web) {
  const key = `${destination}|${source}`;
  if (copied.has(key)) return;
  copied.add(key);
  const relative = path.relative(path.join(projectRoot, "node_modules"), source);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Runtime dependency resolved outside the checkout");
  const metadata = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
  const supports = (list, value) => !list || (!list.includes(`!${value}`) && (!list.some((item) => !item.startsWith("!")) || list.includes(value)));
  if (!supports(metadata.os, "win32") || !supports(metadata.cpu, "x64")) return;
  await fs.cp(source, path.join(destination, "node_modules", relative), { recursive: true, dereference: true });
  for (const name of Object.keys(metadata.dependencies || {})) await copyPackage(await packageDir(name, source), destination);
  for (const name of Object.keys(metadata.optionalDependencies || {})) {
    if (name.startsWith("@next/swc-")) continue;
    try { await copyPackage(await packageDir(name, source), destination); } catch (error) { if (!error.message.startsWith("Missing runtime dependency")) throw error; }
  }
}
for (const name of [...Object.keys(pkg.dependencies), "prisma"]) await copyPackage(await packageDir(name, projectRoot));
await copyPackage(await packageDir("electron-updater", projectRoot), app);
await fs.cp(path.join(projectRoot, "node_modules/.prisma"), path.join(web, "node_modules/.prisma"), { recursive: true });
await fs.cp(path.join(projectRoot, "desktop"), path.join(app, "desktop"), { recursive: true, filter: (source) => !source.endsWith(".test.mjs") });
await fs.copyFile(path.join(projectRoot, "LICENSE"), path.join(app, "LICENSE"));
// Copy the selected multi-resolution ICO byte-for-byte. Never downsample its
// optically adjusted 16/32px frames into a single generic frame.
await fs.copyFile(path.join(projectRoot, "branding/jobtrack.ico"), path.join(root, "icon.ico"));
await fs.copyFile(path.join(projectRoot, "branding/jobtrack-256.png"), path.join(app, "desktop/icon.png"));
await fs.writeFile(path.join(app, "package.json"), JSON.stringify({
  name: "jobtrack-desktop", productName: "JobTrack", version: pkg.version,
  description: "JobTrack local job application manager", author: "JobTrack contributors", license: "MIT", main: "desktop/main.cjs",
  dependencies: { "electron-updater": pkg.devDependencies["electron-updater"] },
}, null, 2));
await bundledNode();
console.log(`Desktop resources staged at ${root}`);
await run("node_modules/electron-builder/cli.js", ["--config", "electron-builder.cjs", "--win", "--publish", "never", ...(process.argv.includes("--dir") ? ["--dir"] : [])], {
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
});
if (!process.argv.includes("--dir")) {
  const installer = path.join(projectRoot, "dist-desktop", `JobTrack-Setup-${pkg.version}.exe`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(installer)) hash.update(chunk);
  await fs.writeFile(`${installer}.sha256`, `${hash.digest("hex")}  ${path.basename(installer)}\n`);
}
