// One-time, fail-closed native home migration. Never touches a source checkout.
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash, randomUUID, pbkdf2Sync, createDecipheriv } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const brand = require('../../branding/brand.json');
const exists = async file => { try { await fs.lstat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fileHash(file) { const digest = createHash('sha256'); for await (const chunk of createReadStream(file)) digest.update(chunk); return digest.digest('hex'); }
const inside = (root, file) => { const r = path.relative(root, file); return r !== '' && !r.startsWith('..') && !path.isAbsolute(r); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function atomic(file, value) {
  const tmp = file + '.tmp'; await fs.writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 }); await fs.rename(tmp, file);
}
function locations(env) {
  if (!env.LOCALAPPDATA || !path.isAbsolute(env.LOCALAPPDATA)) throw Error('LOCALAPPDATA must be absolute.');
  const parent = path.resolve(env.LOCALAPPDATA);
  return { parent, source: path.join(parent, brand.legacyDataDirectory), target: path.join(parent, brand.dataDirectory), journal: path.join(parent, '.jobtrack-home-migration.json') };
}
async function directory(root) {
  if (!(await fs.lstat(root)).isDirectory() || (await fs.lstat(root)).isSymbolicLink() || path.resolve(await fs.realpath(root)).toLowerCase() !== path.resolve(root).toLowerCase()) throw Error('Migration directories cannot be links or junctions.');
}
export async function inventory(root) {
  await directory(root);
  const entries = [];
  async function visit(relative) {
    for (const name of (await fs.readdir(path.join(root, relative))).sort()) {
      const rel = path.join(relative, name), full = path.join(root, rel), stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) throw Error('Migration refused a link or junction; original data was kept.');
      if (stat.isDirectory()) { entries.push({ path: rel, directory: true }); await visit(rel); }
      else if (stat.isFile()) entries.push({ path: rel, size: stat.size, sha256: await fileHash(full) });
      else throw Error('Migration refused an unsupported filesystem entry.');
    }
  }
  await visit(''); return entries;
}
async function copyTree(source, target, entries) {
  await fs.mkdir(target, { recursive: true }); await directory(target);
  for (const entry of entries) {
    if (!inside(source, path.join(source, entry.path)) || !inside(target, path.join(target, entry.path))) throw Error('Unsafe manifest path.');
    const out = path.join(target, entry.path);
    if (entry.directory) await fs.mkdir(out, { recursive: true });
    else { await fs.mkdir(path.dirname(out), { recursive: true }); await fs.copyFile(path.join(source, entry.path), out); }
  }
}
async function quiet(source, target, { checkProcesses = true } = {}) {
  for (const root of [source, target]) {
    const stateFile = path.join(root, 'config/instance.json');
    if (await exists(stateFile)) {
      const state = await read(stateFile);
      for (const pid of [state.pid, state.parentPid].filter(Number.isInteger)) {
        if (pid <= 0) throw Error('Unsafe recorded process identity.');
        try { process.kill(pid, 0); throw Error('Close the existing desktop app and local service before migrating.'); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    }
  }
  if (checkProcesses && process.platform === 'win32') {
    const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '@(Get-Process -Name JobSync -ErrorAction SilentlyContinue).Count'], { windowsHide: true });
    if (Number(stdout.trim()) !== 0) throw Error('Close JobSync before migrating its data.');
  }
  await new Promise((resolve, reject) => {
    const server = net.createServer(); server.once('error', () => reject(Error('Port 3737 is occupied. Close the app/service before migration; no process was stopped.')));
    server.listen(3737, '127.0.0.1', () => server.close(resolve));
  });
}
async function guard(paths, action) {
  // Own both the old launcher mutex and a stable migration mutex. Windows
  // releases these automatically on crash, so an interrupted copy can retry.
  const id = hash(process.platform === 'win32' ? paths.source.toLowerCase() : paths.source).slice(0, 24);
  const names = process.platform === 'win32' ? [`\\\\.\\pipe\\jobsync-${id}-launcher`, `\\\\.\\pipe\\jobtrack-${id}-migration`] : [path.join(paths.parent, '.old-launcher.sock'), path.join(paths.parent, '.migration.sock')];
  const servers = [];
  try {
    for (const name of names) {
      const server = net.createServer(socket => socket.end()); servers.push(server);
      await new Promise((resolve, reject) => { server.once('error', () => reject(Error('Another launcher or migration is active. Retry after it closes.'))); server.listen(name, resolve); });
    }
    return await action();
  } finally { for (const server of servers.reverse()) if (server.listening) await new Promise(resolve => server.close(resolve)); }
}
function validateJournal(p, j) {
  if (j.version !== 1 || !/^[a-f0-9-]{36}$/.test(j.id) || j.source !== p.source || j.target !== p.target || j.backup !== path.join(p.parent, 'JobTrack-Migration-Backups', j.id) || j.stage !== path.join(p.parent, '.JobTrack-migration-' + j.id)) throw Error('Invalid migration journal; no user data was changed.');
}
function mappedPath(file, oldRoot, newRoot) {
  const full = path.resolve(file);
  if (inside(oldRoot, full)) return path.join(newRoot, path.relative(oldRoot, full));
  if (inside(newRoot, full)) return full;
  throw Error('An attachment references a path outside the managed home. Migration requires manual review.');
}
async function databaseCheck(home, source, target, rebase) {
  const database = path.join(home, 'data/jobsync.db');
  if (!(await exists(database))) throw Error('The legacy database is missing; original data was kept.');
  const settings = await read(path.join(home, 'config/runtime.json'));
  if (settings.version !== 1 || typeof settings.authSecret !== 'string' || settings.authSecret.length < 32 || typeof settings.encryptionKey !== 'string' || settings.encryptionKey.length < 32) throw Error('Invalid runtime keys; original data was kept.');
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: 'file:' + database.replace(/\\/g, '/') } } });
  try {
    const integrity = await db.$queryRawUnsafe('PRAGMA integrity_check');
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') throw Error('SQLite integrity check failed.');
    if ((await db.$queryRawUnsafe('PRAGMA foreign_key_check')).length) throw Error('SQLite foreign key check failed.');
    const tables = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const dump = async () => {
      const result = {};
      for (const { name } of tables) {
        const rows = await db.$queryRawUnsafe('SELECT * FROM "' + name.replace(/"/g, '""') + '"');
        // File paths are the only business values allowed to change.
        if (name === 'File') for (const row of rows) row.filePath = mappedPath(row.filePath, source, target);
        result[name] = hash(JSON.stringify(rows, (_, value) => typeof value === 'bigint' ? value.toString() : value));
      }
      return result;
    };
    const before = await dump();
    const files = tables.some(t => t.name === 'File') ? await db.$queryRawUnsafe('SELECT id, filePath FROM File') : [];
    if (rebase) await db.$transaction(async tx => {
      for (const file of files) await tx.$executeRawUnsafe('UPDATE File SET filePath = ? WHERE id = ?', mappedPath(file.filePath, source, target), file.id);
    });
    for (const file of files) {
      const newPath = mappedPath(file.filePath, source, target);
      const actual = path.join(home, path.relative(target, newPath));
      if (!inside(path.join(home, 'data/files'), actual) || !(await exists(actual)) || (await fs.lstat(actual)).isSymbolicLink()) throw Error('An attachment is missing or outside managed storage.');
      if (path.resolve(await fs.realpath(actual)).toLowerCase() !== path.resolve(actual).toLowerCase()) throw Error('An attachment directory cannot be a link or junction.');
    }
    const keys = tables.some(t => t.name === 'ApiKey') ? await db.$queryRawUnsafe('SELECT encryptedKey, iv FROM ApiKey') : [];
    for (const row of keys) if (row.iv) {
      const [salt, iv] = row.iv.includes('.') ? row.iv.split('.') : [null, row.iv];
      const key = pbkdf2Sync(settings.encryptionKey, salt ? Buffer.from(salt, 'base64') : 'jobsync-api-key-encryption', 100000, 32, 'sha256');
      const combined = Buffer.from(row.encryptedKey, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(combined.subarray(-16)); decipher.update(combined.subarray(0, -16)); decipher.final();
    }
    if (!equal(before, await dump())) throw Error('Unexpected database values changed during migration.');
    return { integrity: true, foreignKeys: true, businessRowsUnchanged: true, attachments: files.length, encryptedKeys: keys.filter(k => k.iv).length };
  } finally { await db.$disconnect(); }
}
async function rebaseJournals(stage, source, target) {
  const dir = path.join(stage, 'data/files/jobs/.operations');
  if (!(await exists(dir))) return;
  for (const name of await fs.readdir(dir)) {
    if (!name.endsWith('.json')) throw Error('Unknown document recovery journal; manual review is required.');
    const file = path.join(dir, name), entries = await read(file);
    if (!Array.isArray(entries)) throw Error('Invalid document recovery journal.');
    for (const entry of entries) entry.filePath = mappedPath(entry.filePath, source, target);
    await atomic(file, entries);
  }
}
async function verifyBackup(j) {
  const manifest = await read(path.join(j.backup, 'manifest.json'));
  const actual = await inventory(path.join(j.backup, 'snapshot'));
  if (!equal(manifest, actual)) throw Error('Migration backup checksum failed. The original directory will not be deleted.');
  return manifest;
}
async function verifyTarget(j) {
  await directory(j.target);
  const marker = await read(path.join(j.target, 'config/home-migration.json'));
  if (marker.id !== j.id) throw Error('Destination migration identity does not match. Nothing was deleted.');
  const original = await fs.readFile(path.join(j.backup, 'snapshot/config/runtime.json'));
  if (!original.equals(await fs.readFile(path.join(j.target, 'config/runtime.json')))) throw Error('Stable authentication/encryption keys changed. Nothing was deleted.');
}
export async function prepareHomeMigration(env = process.env, options = {}) {
  if (env.JOBTRACK_HOME) return { status: 'isolated-override' };
  const p = locations(env);
  if (!(await exists(p.source))) return { status: 'not-needed' };
  if (await exists(path.join(p.source, '.git')) || !(await exists(path.join(p.source, 'config/runtime.json'))) || !(await exists(path.join(p.source, 'data/jobsync.db')))) throw Error('The legacy location is not a managed user-data home. Source checkouts are never migrated.');
  return guard(p, async () => {
    await directory(p.source);
    let j = await exists(p.journal) ? await read(p.journal) : null;
    if (j) validateJournal(p, j);
    // Recover the crash window between the atomic directory rename and the
    // journal update, without adopting an unrelated pre-existing directory.
    if (j?.phase === 'promoting' && await exists(p.target) && !(await exists(j.stage))) {
      await verifyBackup(j); await verifyTarget(j);
      j.phase = 'promoted'; await atomic(p.journal, j);
    }
    if (j && ['promoted', 'deleting'].includes(j.phase)) { await verifyBackup(j); await verifyTarget(j); return { status: 'awaiting-user-validation', backup: j.backup }; }
    await quiet(p.source, p.target, options);
    if (await exists(p.target)) throw Error('JobTrack already contains a separate directory. Nothing was overwritten. Resolve the conflict before migration.');
    if (j?.phase === 'complete') throw Error('A legacy directory appeared after completed migration. Manual review is required.');
    if (!j) {
      const id = randomUUID();
      j = { version: 1, id, ...p, phase: 'copying', backup: path.join(p.parent, 'JobTrack-Migration-Backups', id), stage: path.join(p.parent, '.JobTrack-migration-' + id) };
      await atomic(p.journal, j);
    }
    const sourceManifest = await inventory(p.source);
    await fs.mkdir(j.backup, { recursive: true });
    const manifestFile = path.join(j.backup, 'manifest.json');
    if (await exists(manifestFile)) {
      if (!equal(sourceManifest, await read(manifestFile))) throw Error('Legacy data changed since backup. Nothing was overwritten; manual review is required.');
    }
    await copyTree(p.source, path.join(j.backup, 'snapshot'), sourceManifest);
    await atomic(manifestFile, sourceManifest); await verifyBackup(j);
    if (!equal(sourceManifest, await inventory(p.source))) throw Error('Legacy data changed during copying. Original data was kept.');
    // A stage can be reused only if named by our validated journal.
    if (await exists(j.stage)) { await directory(j.stage); await fs.rm(j.stage, { recursive: true }); }
    await copyTree(path.join(j.backup, 'snapshot'), j.stage, sourceManifest);
    if (!equal(sourceManifest, await inventory(j.stage))) throw Error('Staging copy checksum failed.');
    j.checks = await databaseCheck(j.stage, p.source, p.target, true);
    await rebaseJournals(j.stage, p.source, p.target);
    await fs.rm(path.join(j.stage, 'config/instance.json'), { force: true });
    await atomic(path.join(j.stage, 'config/home-migration.json'), { id: j.id });
    if (await exists(p.target)) throw Error('Destination appeared during migration. Nothing was overwritten.');
    j.phase = 'promoting'; await atomic(p.journal, j);
    await fs.rename(j.stage, p.target);
    j.phase = 'promoted'; await atomic(p.journal, j);
    return { status: 'awaiting-user-validation', backup: j.backup, checks: j.checks };
  });
}
export async function verifyHomeMigration(env = process.env) {
  const p = locations(env), j = await read(p.journal); validateJournal(p, j);
  await verifyBackup(j); await verifyTarget(j);
  return databaseCheck(p.target, p.source, p.target, false);
}
export async function finalizeHomeMigration(env = process.env, { userValidated = false, ...options } = {}) {
  if (!userValidated) throw Error('Verify the migrated account login and application before explicitly confirming cleanup.');
  const p = locations(env);
  return guard(p, async () => {
    const j = await read(p.journal); validateJournal(p, j);
    if (j.phase === 'complete' && !(await exists(p.source))) return { status: 'complete' };
    if (!['promoted', 'deleting'].includes(j.phase)) throw Error('Migration is not ready for cleanup.');
    await quiet(p.source, p.target, options); await directory(p.target);
    const manifest = await verifyBackup(j);
    await verifyTarget(j);
    const checks = await databaseCheck(p.target, p.source, p.target, false);
    if (await exists(p.source)) {
      // Resume a partial deletion only if every remaining entry still matches
      // the verified backup. Unexpected files or edits stop cleanup.
      const current = await inventory(p.source);
      const expected = new Map(manifest.map(e => [e.path, e]));
      if (j.phase !== 'deleting' && !equal(current, manifest) || current.some(e => !equal(e, expected.get(e.path)))) throw Error('Legacy files changed. Original data was kept; cleanup requires manual review.');
      j.phase = 'deleting'; j.userValidated = true; await atomic(p.journal, j);
      // Exact siblings derived from LOCALAPPDATA, validated above. Never a repo.
      if (path.dirname(p.source) !== p.parent || path.basename(p.source) !== 'JobSync' || p.source === p.target) throw Error('Unsafe cleanup target.');
      await fs.rm(p.source, { recursive: true });
    }
    j.phase = 'complete'; j.completedAt = new Date().toISOString(); await atomic(p.journal, j);
    return { status: 'complete', backup: j.backup, checks };
  });
}
