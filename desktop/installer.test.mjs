import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const lock = require('../package-lock.json');
const config = require('../electron-builder.cjs');

test('independent JobTrack version is consistent with the lockfile and installer name', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.version, pkg.version); assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(pkg.name, 'jobtrack'); assert.equal(config.productName, 'JobTrack');
  assert.equal(config.artifactName.replace('${version}', pkg.version).replace('${ext}', 'exe'), `JobTrack-Setup-${pkg.version}.exe`);
  assert.notEqual(config.appId, 'ca.jobsync.desktop');
});
test('per-user installer creates branded shortcuts and preserves application data on uninstall', () => {
  assert.equal(config.nsis.perMachine, false); assert.equal(config.nsis.allowElevation, false);
  assert.equal(config.nsis.runAfterFinish, false);
  assert.equal(config.nsis.deleteAppDataOnUninstall, false);
  assert.equal(config.nsis.createDesktopShortcut, 'always');
  assert.equal(config.nsis.createStartMenuShortcut, true);
  assert.equal(config.nsis.shortcutName, 'JobTrack');
});
