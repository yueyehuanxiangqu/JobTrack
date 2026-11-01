// Opt-in integration check. Seed JobSync with verify-ai-autofill first.
// Uses fake credentials and attachments only; never opens the real user home.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { _electron, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { projectRoot } from '../local/project.mjs';
import { verifyHomeMigration, finalizeHomeMigration } from '../local/home-migration.mjs';

const root = process.env.JOBTRACK_MIGRATION_TEST_ROOT;
if (!root || !path.resolve(root).startsWith(path.join(projectRoot, '.local-runtime-test') + path.sep)) throw Error('Use an isolated migration test root.');
const source = path.join(root, 'JobSync'), target = path.join(root, 'JobTrack');
const account = JSON.parse(await fs.readFile(path.join(source, 'verification/autofill-account.json'), 'utf8'));
const configBefore = await fs.readFile(path.join(source, 'config/runtime.json'));
const sourceDb = new PrismaClient({ datasources: { db: { url: 'file:' + path.join(source, 'data/jobsync.db').replace(/\\/g, '/') } } });
const beforeFiles = await sourceDb.file.findMany();
const beforeKeys = await sourceDb.apiKey.findMany();
const documents = await sourceDb.jobAttachment.findMany();
const bytes = new Map(await Promise.all(beforeFiles.map(async f => [f.id, await fs.readFile(f.filePath)])));
await sourceDb.$disconnect();
const db = new PrismaClient({ datasources: { db: { url: 'file:' + path.join(target, 'data/jobsync.db').replace(/\\/g, '/') } } });
const env = { ...process.env, LOCALAPPDATA: root };
delete env.JOBTRACK_HOME; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const report = [], artifacts = path.join(root, 'verification'); await fs.mkdir(artifacts, { recursive: true });
const mark = step => { report.push({ step, passed: true }); console.log('PASS ' + step); };
let app;
try {
  app = await _electron.launch({ executablePath: process.env.JOBTRACK_ELECTRON_EXE, env, timeout: 120000 });
  let page;
  await expect.poll(() => { page = app.windows().find(w => w.url().startsWith('http://127.0.0.1:3737')); return !!page; }, { timeout: 120000 }).toBe(true);
  page.setDefaultTimeout(30000); await page.waitForLoadState('networkidle');
  expect(await app.evaluate(({ app }) => app.getName())).toBe('JobTrack');
  await expect(page).toHaveTitle(/JobTrack/);
  expect(await app.evaluate(({ app }) => app.getPath('userData'))).toBe(path.join(target, 'config/electron'));
  for (const [size, name] of [['small', '16'], ['normal', '32']]) {
    const image = await app.evaluate(async ({ app }, size) => { const i = await app.getFileIcon(app.getPath('exe'), { size }); return { data: i.toPNG().toString('base64'), size: i.getSize() }; }, size);
    await fs.writeFile(path.join(artifacts, `windows-icon-${name}.png`), Buffer.from(image.data, 'base64'));
    expect(image.size.width).toBeGreaterThan(0);
  }
  mark('Packaged JobTrack identity, window title, Windows executable icon and default migrated home');
  await page.goto('http://127.0.0.1:3737/signin');
  await page.getByLabel('Username', { exact: true }).fill(account.username);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3737/dashboard');
  expect(await fs.readFile(path.join(target, 'config/runtime.json'))).toEqual(configBefore);
  expect(await db.apiKey.findMany()).toEqual(beforeKeys);
  expect((await verifyHomeMigration({ LOCALAPPDATA: root })).encryptedKeys).toBeGreaterThan(0);
  mark('Original account logs in after automatic migration; stable config and encrypted provider records preserved');
  await page.goto('http://127.0.0.1:3737/dashboard/settings'); await page.waitForLoadState('networkidle');
  await page.getByLabel('Select AI provider', { exact: true }).click();
  await page.getByRole('option', { name: 'Google Gemini', exact: true }).click();
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('fixture-gemini');
  await expect(page.getByRole('button', { name: 'Delete API Key', exact: true })).toBeVisible();
  await expect(page.getByLabel('API Key', { exact: true })).toHaveValue('');
  mark('Saved model/provider profile and masked stored key load without any real API request');
  for (const document of documents) {
    const response = await page.request.get(`http://127.0.0.1:3737/api/jobs/${document.jobId}/documents/${document.kind}`);
    expect(response.ok()).toBe(true); expect(await response.body()).toEqual(bytes.get(document.fileId));
  }
  for (const file of await db.file.findMany()) expect(file.filePath.startsWith(target + path.sep)).toBe(true);
  mark('Both rebased CV and Cover Letter download with byte-identical content');
  const backup = await page.request.get('http://127.0.0.1:3737/api/backup/export'); expect(backup.ok()).toBe(true);
  expect(backup.headers()['content-disposition']).toContain('jobtrack-backup-');
  const multipart = { file: { name: 'migration.zip', mimeType: 'application/zip', buffer: await backup.body() } };
  const preview = await page.request.post('http://127.0.0.1:3737/api/backup/import/preflight', { multipart }); expect(preview.ok()).toBe(true);
  const restore = await page.request.post('http://127.0.0.1:3737/api/backup/import', { multipart: { ...multipart, confirmWipe: 'true' } }); expect(restore.ok()).toBe(true);
  for (const document of await db.jobAttachment.findMany()) {
    const response = await page.request.get(`http://127.0.0.1:3737/api/jobs/${document.jobId}/documents/${document.kind}`);
    expect(response.ok()).toBe(true);
    const downloaded = await response.body();
    expect([...bytes.values()].some(b => b.equals(downloaded))).toBe(true);
  }
  mark('ZIP export/preflight/restore works after migration and restores both document byte streams');
} finally {
  if (app) { const closed = app.waitForEvent('close'); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.close())).catch(() => {}); await closed; }
  await db.$disconnect();
  await fs.writeFile(path.join(artifacts, 'migration-report.json'), JSON.stringify(report, null, 2));
}
const final = await finalizeHomeMigration({ LOCALAPPDATA: root }, { userValidated: true });
expect(final.status).toBe('complete');
await expect(fs.stat(source)).rejects.toMatchObject({ code: 'ENOENT' });
const manifestBytes = await fs.readFile(path.join(final.backup, 'manifest.json'));
console.log('PASS Verified isolated old-home cleanup; recoverable manifest SHA-256 ' + createHash('sha256').update(manifestBytes).digest('hex'));
