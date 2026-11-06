// Inspect a built Windows distribution without reading any user data or keys.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { projectRoot } from '../local/project.mjs';
const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const pkg = require('../../package.json');
const base = path.join(projectRoot, 'dist-desktop/win-unpacked');
const findings = [];
let files = 0;
async function visit(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name), relative = path.relative(base, full).replaceAll('\\', '/');
    if (e.isSymbolicLink()) { findings.push({ file: relative, reason: 'unexpected link' }); continue; }
    if (e.isDirectory()) { await visit(full); continue; }
    files++;
    if (/(^|\/)(\.env(?:\..*)?|runtime\.json|instance\.json)$|\.(db(?:-wal|-shm|-journal)?|sqlite3?|log|docx)$/i.test(relative) || /(^|\/)(\.local-runtime-test|backups|verification)(\/|$)/i.test(relative)) findings.push({ file: relative, reason: 'configuration/user data/test artifact' });
    if (/(^|\/)jobsync(?:[-_][^/]*)?\.(exe|ico|svg|png)$/i.test(relative) || /^resources\/web\/public\/.*\.pdf$/i.test(relative)) findings.push({ file: relative, reason: 'obsolete brand resource or unexpected public document' });
    // Vendor modules contain examples, certificates and documentation. Only
    // first-party web assets are subject to this extra content/key scan.
    if (relative.startsWith('resources/web/') && !relative.includes('/node_modules/') && /\.(json|mjs|cjs|js|html|txt)$/.test(relative)) {
      const bytes = await fs.readFile(full);
      if (/(?:\bsk-[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9_]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[A-Z0-9]{16}|\bAIza[A-Za-z0-9_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(bytes.toString('utf8'))) findings.push({ file: relative, reason: 'credential pattern; review required' });
    }
  }
}
await visit(base);
const archive = path.join(base, 'resources/app.asar');
const packedPkg = JSON.parse(asar.extractFile(archive, 'package.json'));
if (packedPkg.version !== pkg.version || packedPkg.productName !== 'JobTrack') findings.push({ reason: 'ASAR identity/version mismatch' });
if (packedPkg.dependencies?.['electron-updater'] !== pkg.devDependencies['electron-updater']) findings.push({ reason: 'Desktop updater dependency missing or mismatched' });
const requireUpdater = createRequire(require.resolve('electron-updater'));
const config = requireUpdater('js-yaml').load(await fs.readFile(path.join(base, 'resources/app-update.yml'), 'utf8'));
if (config.provider !== 'github' || config.owner !== 'yueyehuanxiangqu' || config.repo !== 'JobTrack' || config.private !== false || config.token || config.requestHeaders) findings.push({ reason: 'Unexpected update source or embedded credentials' });
for (const file of ['desktop/preload.cjs', 'desktop/updates.cjs', 'node_modules/electron-updater/package.json']) {
  let bytes;
  try { bytes = asar.extractFile(archive, file); }
  catch { bytes = asar.extractFile(archive, path.normalize(file)); }
  if (!bytes.length) findings.push({ reason: 'Missing packaged updater resource', file });
}
const image = asar.extractFile(archive, 'desktop/icon.png');
if (!image.equals(await fs.readFile(path.join(projectRoot, 'branding/jobtrack-256.png')))) findings.push({ reason: 'Electron icon differs from selected A' });
const ico = await fs.readFile(path.join(projectRoot, 'branding/jobtrack.ico'));
const exe = await fs.readFile(path.join(base, 'JobTrack.exe'));
const frames = [];
const installer = await fs.readFile(path.join(projectRoot, `dist-desktop/JobTrack-Setup-${pkg.version}.exe`));
const installerFrames = [];
for (let i = 0; i < ico.readUInt16LE(4); i++) {
  const n = 6 + i * 16, bytes = ico.subarray(ico.readUInt32LE(n + 12), ico.readUInt32LE(n + 12) + ico.readUInt32LE(n + 8));
  const size = ico[n] || 256, embedded = exe.includes(bytes); frames.push({ size, embedded });
  if (!embedded) findings.push({ reason: 'Executable icon frame missing', size });
  const installerEmbedded = installer.includes(bytes); installerFrames.push({ size, embedded: installerEmbedded });
  if (!installerEmbedded) findings.push({ reason: 'NSIS installer icon frame missing', size });
}
const license = asar.extractFile(archive, 'LICENSE');
if (!license.equals(await fs.readFile(path.join(projectRoot, 'LICENSE')))) findings.push({ reason: 'Original MIT license differs' });
const report = { passed: findings.length === 0, version: pkg.version, filesInspected: files, iconFrames: frames, installerIconFrames: installerFrames, licenseSha256: createHash('sha256').update(license).digest('hex'), findings };
await fs.mkdir(path.join(projectRoot, '.local-runtime-test'), { recursive: true });
await fs.writeFile(path.join(projectRoot, '.local-runtime-test/phase6c-package-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (findings.length) process.exitCode = 1;
