# Phase 2 — Electron Windows desktop validation

Historical report: Phase 3 later retired the root CMD wrappers and simplified
business features. See WINDOWS_DESKTOP.md and the Phase 3 validation reports for
current behavior. Results below describe the original Phase 2 installation.

Date: 2026-10-30 (Europe/Amsterdam). Windows 11 x64, OS build 10.0.26200.
Base: feat/windows-local-runtime, commit 2bb99d7, JobSync 1.1.22.
Implementation branch: feat/electron-desktop. No push or publication was performed.

## Delivered artifact

```text
F:\Programming\Applications\jobsync\dist-desktop\JobSync-Setup-1.1.22.exe
F:\Programming\Applications\jobsync\dist-desktop\JobSync-Setup-1.1.22.exe.sha256
```

Installer: 264,291,279 bytes (about 252 MiB), Windows x64 NSIS, current-user mode.
SHA-256:

```text
e65cafc7fe94181239eac5591068b4d09055e9cce020f61a9a5987a9603abc7a
```

Electron 45.2.0, electron-builder 26.18.0, bundled official Node.js 24.22.1.
Next.js 15.5.25, React 19.2.4 and Prisma 6.19.0 are unchanged. The lockfile was
checked against Phase 1: no existing package version changed. New dependencies
are desktop build tools and their dependency graph.

## Isolation and actual installation

- The initial worktree was clean; a new feature branch was created from Phase 1.
- Business tests used `.local-runtime-test\桌面 测试`; native compatibility checks
  reused the isolated Phase 1 home `.local-runtime-test\本地 测试`.
- NSIS was actually installed outside the checkout at
  `C:\Users\yueye\AppData\Local\Programs\JobSync Phase2 测试`.
- Its current-user HKCU uninstall entry and both shortcut targets were inspected
  in the real installation user's context, not the sandbox account's HKCU.
- Testing outside the checkout prevents missing modules from resolving from the
  developer repository's node_modules. Desktop child environments also strip
  NODE_PATH/NODE_OPTIONS and use the packaged runtime executable explicitly.
- The ordinary `%LOCALAPPDATA%\JobSync` database was not used for test records.
- Installation, uninstall and reinstall retained the isolated database/config
  byte-for-byte. Final test installations and shortcuts are removed after tests;
  test data, reports and the distributable remain available for inspection.

## Checks executed

| Check | Actual result |
|---|---|
| Clean Windows npm ci | PASS; final lockfile installed 1045 packages |
| Prisma Client and original 44 migrations | PASS; Windows generation, initial deploy and repeat no-op deploy |
| Next desktop production build | PASS; standalone build, static assets, type checks |
| Phase 1 native production mode | PASS; production build, authenticated health, start/stop, existing data |
| Lint | PASS |
| Existing Vitest suite | PASS; 297 files, 3523 tests |
| Native launcher Node tests | PASS; 6 tests |
| Desktop security Node tests | PASS; 3 tests |
| Actual packaged EXE | PASS; app.isPackaged asserted, not Electron dev mode |
| Actual NSIS install/uninstall/reinstall | PASS; current-user installation in a Unicode/space path outside source |
| Desktop/Start menu shortcuts | PASS; actual targets inspected, desktop link launched through Windows ShellExecute |
| Bundled Node only | PASS; system Node/npm removed from application PATH; CIM confirmed resources/runtime/node.exe |
| Window and renderer isolation | PASS; sandbox/contextIsolation true, Node integration false, renderer process/require undefined |
| Registration/login | PASS; original forms and existing-account login after reopening |
| Phase 1 compatibility | PASS; existing Phase 1 account/attachment read by installed Electron, original key file hash unchanged |
| Jobs | PASS; original create/edit/delete UI, applied state and stage records |
| Dashboard/calendars | PASS; Dashboard, original Activity Calendar and Daily Goals, real test records |
| Tasks/Activities | PASS; original forms saved real records |
| Unicode attachment | PASS; PDF upload, native file path, byte-identical download, repeat after reopening |
| PDF export | PASS; original resume dialog produced an actual PDF through Electron native download handling |
| CSV export | PASS; exported test job |
| ZIP backup/restore | PASS; export, preflight, confirmed restore, attachment bytes, snapshot and rollback |
| Other business pages | PASS; Interviews, Profile, Automations, Settings loaded without page errors |
| External navigation | PASS; click routed to OS browser API, app stayed local; external API was spied to avoid opening an unrelated site |
| Minimize | PASS; backend remained healthy |
| Second launch | PASS; original window restored/focused and backend PID unchanged |
| Normal window close | PASS; Electron metrics PIDs, main and backend exited; another Node process stayed alive |
| Unexpected main termination | PASS; no owned orphan processes, then successful restart with original keys |
| Port occupied | PASS; visible startup error, unrelated listener kept running |
| Close startup window | PASS in the final actual NSIS installation; early IPC cancellation leaves no owned process |
| Installed-source integrity | PASS; installed ASAR/main/helpers and backend compared to repository source hashes |

Window-close tests invoke Electron's BrowserWindow.close (the same close event
path as X) or window.close on the shortcut-launched application; they do not claim
a human physically clicked every control. Shortcut inspection used the actual
installer-created link. A temporary remote-debugging argument was passed only by
the test harness for screenshot/close verification; the stored shortcut has no
debugging arguments and normal launches open no debugging port.

The host still has developer Node installed. Absence from PATH and the observed
bundled backend path demonstrate runtime independence; this was not a clean VM
with Node physically uninstalled. End-user installation requires no npm command.

## Resolved implementation/test issues

1. electron-builder's generic directory copy omits a root node_modules. The first
   incomplete resource bundle showed a clear error and stopped its backend. An
   explicit node_modules mapping and afterPack completeness assertions fixed it.
2. This coding environment sets ELECTRON_RUN_AS_NODE. Tests remove it, and release
   fuses disable RunAsNode and NODE_OPTIONS injection. The real shortcut also ran
   successfully in this environment. Backend Node environments are sanitized.
3. An ordinary navigation could cancel the first load with ERR_ABORTED. It is now
   ignored as a navigation cancellation instead of incorrectly stopping the service.
4. Playwright's Electron context did not emit its browser download event even though
   the native PDF download succeeded. The test now verifies the actual downloaded
   file bytes after the native download's completed event, without changing
   production download behavior. Checking file existence alone had exposed a
   Windows EBUSY race while Chromium still held the output file open.
5. Hard termination can leave instance.json after Windows has already terminated the
   process tree. Tests require no live owned PID and verify safe identity replacement
   on next start; they do not mistake metadata for a running service.
6. A startup-window close could precede creation of the backend control pipe. Native
   parent IPC disconnect now cancels that phase, and the backend checks pre-existing
   disconnect state. Ownership cleanup waits for startup to settle. A fresh-home
   cancellation regression was added and passed.
7. Desktop dependency maps, declarations and tests are excluded from distribution,
   retaining runtime code and licenses. No business module was removed to reduce size.

## Not verified / limitations

- No separate clean Windows VM, ARM64 machine or second non-admin account was used.
  NSIS is explicitly per-user/non-elevating; HKCU registration was verified.
- Reinstall was tested. A future different-version upgrade with new business
  migrations, power loss during an active migration, and OS reboot were not injected.
- Real cloud AI, Ollama model runs and external MCP clients were not connected.
  Their routes/providers/UI remain unchanged; local Ollama-unreachable logs are expected.
- Native save-dialog interaction and SmartScreen behavior for an internet-downloaded
  unsigned installer were not manually driven. The installer is unsigned.
- Responsive redesign, all DPI/zoom combinations and multilingual UI are Phase 3 work.
- Logs do not rotate automatically. Long active work may be interrupted by exit;
  HTTP/migration shutdown has a bounded grace period and only owned processes can
  be terminated as a final fallback.
- Existing unpdf webpack and node-cron source-map warnings remain non-blocking.
  Playwright 1.57 reports a Windows shell-launch deprecation warning in the test
  harness; the application itself starts its backend directly without a shell.
- The existing Activity form's default five-minute duration can cross midnight
  while retaining today's end date, causing its normal validation to reject Save.
  This was observed at 23:55. Explicit valid start/end times work and are now used
  by the integration harness. The business form is unchanged in Phase 2.

Activity Calendar data was also traced without changing the component:
`src/app/dashboard/page.tsx` calls `getActivityCalendarData` in
`src/actions/dashboard/charts.ts`. It queries the signed-in user's real applied
jobs by appliedDate and real activities by startTime/duration through Prisma,
then groups local dates into counts and hours. `ActivityCalendar.tsx` renders
those props; it does not generate mock activity records.

## Files

Added:

- `desktop/main.cjs`, `security.cjs`, `security.test.mjs`, `splash.html`, `splash.js`
- `electron-builder.cjs`
- `scripts/desktop/build.mjs`, `verify-lifecycle.mjs`, `verify-shortcut.mjs`
- `WINDOWS_DESKTOP.md`, `PHASE2_VALIDATION.md`, `PHASE3_BACKLOG.md`

Modified:

- `package.json`, `package-lock.json`, `next.config.mjs`, `tsconfig.json`
- `.gitignore`, `.dockerignore`, `eslint.config.mjs`, `vitest.config.ts`
- `scripts/local/runtime.mjs`, `server.mjs`, `verify-browser.mjs`
- `README.md`, `WINDOWS_LOCAL.md`

Unchanged: main branch, both CMD launchers, Dockerfile, docker-compose.yml, MIT
License/copyright, business components/actions/models and all existing migrations.

## Reproduce and local evidence

```powershell
npm ci
npm run desktop:build
npm run lint
npm test -- --maxWorkers=4
npm run test:desktop
npm run test:local-runtime

$env:JOBSYNC_HOME = Join-Path (Get-Location) '.local-runtime-test\桌面 测试'
$env:JOBSYNC_ELECTRON_EXE = 'C:\path\to\installed\JobSync.exe'
node scripts/local/verify-browser.mjs
node scripts/local/verify-browser.mjs --login-only
node scripts/desktop/verify-lifecycle.mjs
```

The verification scripts refuse the formal data directory. Remove JOBSYNC_HOME
before everyday use. The build always passes `--publish never`.

Ignored local evidence under `.local-runtime-test`: phase2-final-vitest.log,
phase2-native-regression.log, final-release-installed-browser.log,
final-release-installed-login.log, final-release-installed-lifecycle.log,
desktop-lifecycle-cancel-fixed.log,
phase1-to-desktop-compat.log, phase2-installation-report.json and the verification
directories containing JSON reports, PDFs, backups and screenshots.

Final installed-package functionality, reopen/login, all eight lifecycle checks
and installed-source integrity passed. The dedicated test installation was
uninstalled with database/config hashes unchanged. Phase 3 directions are
recorded, not implemented automatically; the implementation commit is recorded
in this branch's Git history.
