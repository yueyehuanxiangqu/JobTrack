import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, randomBytes, createCipheriv, pbkdf2Sync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { prepareHomeMigration, verifyHomeMigration, finalizeHomeMigration, inventory } from './home-migration.mjs';
import { projectRoot } from './project.mjs';

const options = { checkProcesses: false };
async function fixture() {
  const parent = path.join(projectRoot, '.local-runtime-test', 'migration-' + randomUUID(), '中文 空格');
  const source = path.join(parent, 'JobSync'), target = path.join(parent, 'JobTrack');
  await fs.mkdir(path.join(source, 'config'), { recursive: true });
  await fs.mkdir(path.join(source, 'data/files/jobs'), { recursive: true });
  const settings = { version: 1, authSecret: randomBytes(32).toString('base64'), encryptionKey: randomBytes(32).toString('base64') };
  await fs.writeFile(path.join(source, 'config/runtime.json'), JSON.stringify(settings));
  const db = new PrismaClient({ datasources: { db: { url: 'file:' + path.join(source, 'data/jobsync.db').replace(/\\/g, '/') } } });
  const attachment = path.join(source, 'data/files/jobs', 'cv.pdf');
  await fs.writeFile(attachment, 'private fixture CV bytes');
  const salt = randomBytes(16), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', pbkdf2Sync(settings.encryptionKey, salt, 100000, 32, 'sha256'), iv);
  const encrypted = Buffer.concat([cipher.update('fixture-not-a-real-api-key'), cipher.final(), cipher.getAuthTag()]).toString('base64');
  try {
    await db.$executeRawUnsafe('CREATE TABLE User(id TEXT PRIMARY KEY, password TEXT)');
    await db.$executeRawUnsafe('INSERT INTO User VALUES (?, ?)', 'owner', 'unchanged-password-hash');
    await db.$executeRawUnsafe('CREATE TABLE File(id TEXT PRIMARY KEY, filePath TEXT)');
    await db.$executeRawUnsafe('INSERT INTO File VALUES (?, ?)', 'cv', attachment);
    await db.$executeRawUnsafe('CREATE TABLE ApiKey(encryptedKey TEXT, iv TEXT)');
    await db.$executeRawUnsafe('INSERT INTO ApiKey VALUES (?, ?)', encrypted, salt.toString('base64') + '.' + iv.toString('base64'));
  } finally { await db.$disconnect(); }
  return { parent, source, target, env: { LOCALAPPDATA: parent }, attachment };
}
test('full backup, rebased attachments, stable secrets and idempotent explicit cleanup', async () => {
  const f = await fixture(), before = await inventory(f.source);
  const result = await prepareHomeMigration(f.env, options);
  assert.equal(result.status, 'awaiting-user-validation');
  assert.deepEqual(await inventory(f.source), before);
  assert.deepEqual(await inventory(path.join(result.backup, 'snapshot')), before);
  assert.equal((await verifyHomeMigration(f.env)).encryptedKeys, 1);
  assert.equal((await prepareHomeMigration(f.env, options)).status, 'awaiting-user-validation');
  await assert.rejects(finalizeHomeMigration(f.env), /explicitly confirming/);
  assert.equal((await finalizeHomeMigration(f.env, { ...options, userValidated: true })).status, 'complete');
  await assert.rejects(fs.stat(f.source), { code: 'ENOENT' });
  assert.equal((await prepareHomeMigration(f.env, options)).status, 'not-needed');
  assert.equal((await finalizeHomeMigration(f.env, { ...options, userValidated: true })).status, 'complete');
  assert.equal(await fs.readFile(path.join(f.target, 'data/files/jobs/cv.pdf'), 'utf8'), 'private fixture CV bytes');
});
test('destination conflicts and active recorded processes never overwrite or delete originals', async () => {
  const f = await fixture(), before = await inventory(f.source);
  await fs.mkdir(f.target); await fs.writeFile(path.join(f.target, 'sentinel'), 'other data');
  await assert.rejects(prepareHomeMigration(f.env, options), /separate directory/);
  assert.deepEqual(await inventory(f.source), before);
  await fs.writeFile(path.join(f.source, 'config/instance.json'), JSON.stringify({ pid: process.pid }));
  await assert.rejects(prepareHomeMigration(f.env, options), /Close/);
  assert.equal(await fs.readFile(path.join(f.target, 'sentinel'), 'utf8'), 'other data');
});
test('backup corruption, changed source and changed stable keys block final cleanup', async () => {
  const f = await fixture(); const { backup } = await prepareHomeMigration(f.env, options);
  const snap = path.join(backup, 'snapshot/data/files/jobs/cv.pdf');
  await fs.writeFile(snap, 'damaged');
  await assert.rejects(finalizeHomeMigration(f.env, { ...options, userValidated: true }), /backup checksum/);
  await fs.copyFile(f.attachment, snap);
  await fs.writeFile(f.attachment, 'changed after migration');
  await assert.rejects(finalizeHomeMigration(f.env, { ...options, userValidated: true }), /Legacy files changed/);
  await fs.copyFile(snap, f.attachment);
  await fs.writeFile(path.join(f.target, 'config/runtime.json'), '{}');
  await assert.rejects(finalizeHomeMigration(f.env, { ...options, userValidated: true }), /keys changed/);
  assert.ok(await fs.stat(f.source));
});
test('interrupted promotion and partial deletion resume without repeating business changes', async () => {
  const f = await fixture(); await prepareHomeMigration(f.env, options);
  const file = path.join(f.parent, '.jobtrack-home-migration.json');
  const j = JSON.parse(await fs.readFile(file, 'utf8')); j.phase = 'promoting'; await fs.writeFile(file, JSON.stringify(j));
  assert.equal((await prepareHomeMigration(f.env, options)).status, 'awaiting-user-validation');
  j.phase = 'deleting'; await fs.writeFile(file, JSON.stringify(j));
  await fs.unlink(f.attachment);
  assert.equal((await finalizeHomeMigration(f.env, { ...options, userValidated: true })).status, 'complete');
});
test('isolated overrides never inspect or create the real default home', async () => {
  assert.equal((await prepareHomeMigration({ JOBTRACK_HOME: 'test-home' })).status, 'isolated-override');
});
test('missing attachments stop before promotion and keep original bytes', async () => {
  const f = await fixture(); await fs.unlink(f.attachment);
  await assert.rejects(prepareHomeMigration(f.env, options), /attachment is missing/);
  await assert.rejects(fs.stat(f.target), { code: 'ENOENT' });
  assert.ok(await fs.stat(f.source));
});
test('source checkouts are rejected before any backup or cleanup operation', async () => {
  const f = await fixture(); await fs.mkdir(path.join(f.source, '.git'));
  await assert.rejects(prepareHomeMigration(f.env, options), /Source checkouts are never migrated/);
  await assert.rejects(fs.stat(f.target), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.join(f.parent, 'JobTrack-Migration-Backups')), { code: 'ENOENT' });
});
