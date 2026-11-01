import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const brand = require('../branding/brand.json');
const config = require('../electron-builder.cjs');
test('desktop and NSIS share the JobTrack identity and selected icon', async () => {
  assert.equal(config.appId, brand.appId); assert.equal(config.productName, brand.name);
  assert.equal(config.nsis.shortcutName, 'JobTrack');
  assert.equal(config.nsis.installerIcon, 'branding/jobtrack.ico');
  assert.equal(config.nsis.uninstallerIcon, 'branding/jobtrack.ico');
  const bytes = await fs.readFile(new URL('../branding/jobtrack.ico', import.meta.url));
  const approved = await fs.readFile(new URL('../branding/icon-proposals/a-j-track/icon.ico', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(approved).digest('hex'));
  assert.equal(bytes.readUInt16LE(2), 1); assert.equal(bytes.readUInt16LE(4), 7);
  const sizes = [];
  for (let n = 0; n < 7; n++) {
    const offset = 6 + n * 16, size = bytes[offset] || 256;
    const image = bytes.subarray(bytes.readUInt32LE(offset + 12), bytes.readUInt32LE(offset + 12) + bytes.readUInt32LE(offset + 8));
    assert.equal(image.readUInt32BE(16), size); assert.equal(image.readUInt32BE(20), size); sizes.push(size);
  }
  assert.deepEqual(sizes, [16,24,32,48,64,128,256]);
  const build = await fs.readFile(new URL('../scripts/desktop/build.mjs', import.meta.url), 'utf8');
  assert.ok(build.includes('fs.copyFile(path.join(projectRoot, "branding/jobtrack.ico")'));
  assert.ok(!build.includes('header.writeUInt32LE'));
});
