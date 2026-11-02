# Phase 6A / 6B verification

This is the historical 6A/6B report. Later installation checks are recorded in [PHASE6C_VALIDATION.md](PHASE6C_VALIDATION.md).

Branch: `feat/phase6-branding-data-migration`. No Push, Release or NSIS installer is part of this phase.

## Implemented

- JobTrack package/product identity, window/splash/page titles, visible navigation/auth/support names, export filenames and PDF creator metadata.
- AppUserModelID `io.github.yueyehuanxiangqu.jobtrack`; desktop/Start menu shortcut and future NSIS names/icons configured for JobTrack. The installed old version is not replaced by an unpacked build.
- Approved A — J-Track SVG, favicon, 256px Electron PNG and seven-frame Windows ICO. Staging copies the ICO intact. Unselected B/C assets and proposal-only gallery/generation files were removed; selected A sources and selection record remain.
- Default `%LOCALAPPDATA%\JobTrack` home and `JOBTRACK_*` runtime variables; one-time verified JobSync home migration, absolute attachment/recovery-journal rebasing, external full backup, explicit verified cleanup and safe interruption retry.
- Development Electron resources resolve beside `.desktop-build/app`, keeping the optional staged development entrypoint consistent with the build layout.
- Original MIT license, upstream acknowledgement, historical schema migrations, encryption salt/formats, password hashes and backup format remain compatible. No dependency version changes.

## Passed

- One complete Vitest run: **175 files / 2,032 tests**.
- Node runtime, migration safety and desktop checks: **17 tests**. Coverage includes stable configuration, default paths, process/destination conflict refusal, missing files, corrupt backup, changed source/keys, interrupted promotion/deletion, explicit cleanup, idempotence and source-checkout protection.
- TypeScript, full ESLint and scoped checks for subsequently updated verification/main-process files.
- Production Next.js build and unpacked Windows Electron packaging. Runtime-only updates reuse the Next build; no NSIS target was generated.
- Electron core regression: **18 groups** covering accounts, Jobs/timeline, Interviews, Tasks/Activities, Activity Calendar, CSV/PDF, legacy upload/download, ZIP export/preflight/restore/snapshot/rollback and shutdown.
- Electron Mock AI regression: **5 groups**, including encrypted per-provider configuration, draft autofill, manual review, per-job CV/Cover Letter and sandbox/isolation. No real or paid AI API calls.
- Automatic migration of an isolated legacy home: **6 groups**, including existing-password login, stable keys/provider records, rebased CV/Cover Letter byte-identical downloads, post-migration ZIP restore, and verified deletion of the isolated old home.
- Staged development entrypoint starts successfully with the corrected resource directory and an isolated home.
- All seven approved ICO PNG frames are embedded byte-for-byte in the Windows executable. ProductName/FileDescription are JobTrack; native Windows shell extraction shows A — J-Track. The 16/32px variants and 256px artwork retain the approved geometry.

## Real user-home status

The actual legacy home was backed up, checksummed and promoted to JobTrack. SQLite integrity and foreign-key checks passed; the database initially contained one account and one job, with no file or API Key records. Stable configuration and business values were preserved during migration.

The owner then confirmed that they had never registered an account and explicitly authorized deleting all existing unused accounts. The migrated database and its sidecars were separately archived and checksummed beside the full backup. A fresh empty database was initialized with official Prisma migrations before replacing the inactive database. Stable runtime keys were kept. The formal home now has **zero accounts, jobs, files and API Key records**, ready for the owner's first registration; no formal test account was created.

The final production app was verified at the actual JobTrack home and displayed the first-registration page. The old `%LOCALAPPDATA%\JobSync` user directory was then deleted only after the complete backup and target database were revalidated. A subsequent startup/shutdown again displayed registration and **did not recreate JobSync**. The complete recoverable backup remains under `%LOCALAPPDATA%\JobTrack-Migration-Backups\<migration-id>`, including the additional retired-database archive. See [DATA_MIGRATION.md](DATA_MIGRATION.md) for recovery and cleanup mechanics.

Real attachments/encrypted provider records were absent, so their migration is verified with isolated fixtures rather than claimed against the real home. Login to the unused real legacy account was not tested or recovered; the owner chose a fresh start instead. Original-password login was verified with the isolated migration fixture.

## Deferred / not verified

- Actual installation, shortcut creation, taskbar pin replacement, NSIS install/uninstall and code signing: Phase 6C.
- Existing installed JobSync binaries/shortcuts are unchanged and should not be used after migration, since old binaries can recreate their old home.
- The original `F:\Programming\Applications\jobsync` source backup is outside all migration/deletion targets and remains untouched.

Detailed logs, fixture credentials, databases and user-home reports remain outside Git under the ignored `.local-runtime-test/` directory or the local AppData backup. They are not included in the commit.
