> Historical report: this records a pre-Phase-6 build. Current JobTrack branding, data paths and migration procedures are documented in [DATA_MIGRATION.md](DATA_MIGRATION.md). Original commands and observations below are preserved as historical evidence.

# Phase 1 validation — Windows native local runtime

Historical report: the root CMD wrappers described below were retired after
Phase 3. For current desktop use see WINDOWS_DESKTOP.md; optional development
CLI commands are documented in WINDOWS_LOCAL.md. Results below describe Phase 1.

Executed on Windows on 2026-10-30, with Node.js 24.22.1 and npm 11.19.1.
Base: main, JobSync 1.1.22, commit 2bd2284879d2037883cbd21ee3283cf27138a671.
Implementation branch: feat/windows-local-runtime. No GitHub push was performed.

## Isolation and project protection

- The initial Git worktree was clean. The implementation uses a separate branch.
- Tests used `F:\Programming\Applications\jobsync\.local-runtime-test\本地 测试`
  and a second fresh root `.local-runtime-test\全新 首次`. Unit fixtures also use
  dedicated temporary directories. No test used the normal LocalAppData database.
- Test homes, credentials, runtime secrets, attachments, logs and native build
  output are ignored by Git. The test server was stopped after verification.
- Dockerfile, docker-compose.yml, LICENSE, schema.prisma and all migration history
  are unchanged. Existing package versions in the lockfile are unchanged.
- No database reset, data-loss push, or cleanup of user data was executed.

## Results

| Check | Result / evidence |
|---|---|
| Windows `npm ci` | PASS; lockfile installation completed, including the final declared jsdom dev dependency |
| Prisma Client | PASS; generated Prisma Client 6.19.0 on Windows |
| First database initialization | PASS; all 44 original migrations applied in a fresh Unicode/space directory |
| Repeat migrations | PASS; `migrate deploy` reported no pending migrations |
| Native production build | PASS; Next.js 15.5.25 production build, type checks and embedded lint completed |
| Explicit lint | PASS; `npm run lint` |
| Full Vitest regression | PASS; 297 files, 3523 tests (`npm test -- --maxWorkers=4`) |
| Launcher unit tests | PASS; 6 tests (`npm run test:local-runtime`) |
| Runtime without Docker | PASS; native Node server passed private authenticated HTTP/SQLite health check |
| Network binding | PASS; Windows Get-NetTCPConnection showed only 127.0.0.1:3737 |
| Default browser launch | PASS; actual start .cmd returned success and an Edge window titled Sign In / JobSync appeared |
| Account registration and login | PASS; original browser UI; existing account login repeated after stop/restart |
| Jobs | PASS; original Add/Edit/Delete UI; applied flag and timeline persisted |
| Dashboard / calendars | PASS; Dashboard, Activity Calendar and Daily Goals Calendar rendered; saved screenshot shows a real application in the heatmap |
| Other preserved pages | PASS; Interviews, Tasks, Activities, Profile, Automations and Settings loaded without browser page errors |
| Unicode PDF attachment | PASS; upload, file stored under native data root, byte-identical download; repeated after restart |
| PDF export | PASS; original resume export dialog downloaded a valid PDF |
| CSV export | PASS; original API exported the test job |
| ZIP backup / restore | PASS; export, preflight, confirmed replacement of only the isolated test account, attachment bytes, pre-import snapshot and rollback |
| Safe stop | PASS; actual stop .cmd ended its instance, removed instance metadata and kept all data |
| Unrelated Node protection | PASS; another test Node process remained alive; fabricated metadata pointing at its live PID was refused |
| Port conflict | PASS; a separate listener on 3737 remained alive while the launcher reported the conflict |
| Concurrent starts | PASS; concurrent warm starts retained one PID; concurrent cold starts produced one identified server |
| Daily cached start | PASS; no npm install or production rebuild; BUILD_ID unchanged |
| Working directory independence | PASS; CLI and both Unicode .cmd entry points executed from a different working directory |
| Persistence | PASS; users, jobs, resumes, files and timeline row counts and config bytes matched after stop/restart |
| Docker fallback | Configuration/unit checks PASS; actual Docker container execution NOT RUN |
| Real Windows reboot | NOT RUN; process stop/restart and persistence were tested |
| Cloud AI / Ollama / external MCP clients | NOT RUN; code/providers preserved; no live model credentials used |

The default-browser screenshot inspection was stopped by computer-use because it
could not establish the current browser URL confidently. No further Windows UI
actions were attempted. This does not replace the successful isolated Edge
Playwright tests or their saved screenshots; native UI screenshot inspection is
recorded as incomplete.

## Initial failures and their resolution

1. Prisma 6's missing-database probe returned a bare Schema Engine error for a new
   SQLite file. Exclusive creation of an empty file (`wx`) before deploy resolved
   this in a fresh test home. Existing files are never overwritten. The full schema
   and indexes still come exclusively from the original migration history.
2. A directory-relative `import.meta.url` shared with webpack initially prevented
   compilation. Launcher-only project discovery was separated from the pure shared
   paths module. Subsequent native builds passed.
3. Upstream Vitest configuration requires jsdom but did not declare it directly.
   jsdom 26.1.0 is now a pinned development dependency, using the version already
   present as an optional lockfile entry. No framework dependency was upgraded.
4. Backup integration setup used npx as an executable (not portable to Windows).
   It now calls the installed Prisma JS CLI with Node and uses formal migrations.
   Both test database connections are closed before narrowly guarded temp cleanup.
5. A backup preview test matched both the count "12" and a time formatted as
   "12:00 PM" in the local timezone. Its assertion now matches the exact count.
6. Real Unicode attachment download failed because raw Unicode was written into a
   ByteString HTTP header. The download route now uses a UTF-8 filename* parameter
   for non-ASCII names, preserving existing ASCII behavior. A regression test and
   browser byte comparison passed.
7. Early browser script attempts had over-broad locators and did not await an edit
   save; those verification-only issues were corrected. Final browser report passes.

## Warnings and remaining limitations

- The existing unpdf dependency emits an import.meta webpack warning. Compilation
  succeeds. AI resume import itself was not exercised with a live model.
- node-cron emits a missing-source-map warning under Vitest; all tests pass.
- npm 11 prints lifecycle-script approval notices. Explicit Prisma generation and
  engine download completed successfully; no npm security settings were weakened.
- The tests did not physically move the checkout to a Unicode path. Unicode/space
  data paths and different working directories were tested. Launcher child paths
  use argument arrays and are anchored to the checkout rather than the caller CWD.
- Logs do not yet rotate automatically. Long HTTP requests have a 60-second shutdown
  grace period; finish active long AI/automation work before stopping.
- This is a local Node.js runtime, not an EXE or Windows service. The production
  bundle remains in this checkout, and dependency changes require initialization.

## Files added

- `启动 JobSync.cmd`, `停止 JobSync.cmd`
- `scripts/local/cli.mjs`, `paths.mjs`, `project.mjs`, `runtime.mjs`, `server.mjs`
- `scripts/local/runtime.test.mjs`, `verify-browser.mjs`, `verify-lifecycle.mjs`
- `src/lib/storagePaths.ts`
- `__tests__/storagePaths.spec.ts`
- `WINDOWS_LOCAL.md`, `PHASE1_VALIDATION.md`

## Files modified

- `.gitignore`, `README.md`, `package.json`, `package-lock.json`
- `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`
- `src/lib/resumeFiles.ts`
- `src/lib/backup/import.ts`, `normalize.ts`, `snapshot.ts`
- `src/app/api/profile/resume/route.ts`
- `__tests__/DataSettings.spec.tsx`, `backupRoundTrip.spec.ts`,
  `helpers/backupTestDb.ts`, `resume-download-route.spec.ts`

## Reproduce integration checks

After installing dependencies, with Node.js 24 LTS, from the checkout:

```powershell
$env:JOBSYNC_HOME = Join-Path (Get-Location) '.local-runtime-test\本地 测试'
node scripts/local/cli.mjs start --no-browser
node scripts/local/verify-browser.mjs
node scripts/local/verify-lifecycle.mjs
node scripts/local/verify-browser.mjs --login-only
node scripts/local/cli.mjs stop
```

These verification scripts refuse the normal LocalAppData home. They intentionally
leave their isolated fixtures/logs for inspection. They are never run by the daily
start/stop launchers. Remove JOBSYNC_HOME from the environment before normal use.

Local evidence (ignored by Git): `.local-runtime-test/vitest-passed.log`,
`本地 测试/logs/`, and `本地 测试/verification/` containing browser/lifecycle reports,
dashboard.png, resume-export.pdf and backup.zip.
