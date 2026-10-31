# Phase 3C — per-job documents

Date: 2026-10-31, Windows 11 x64. Base: `db0a33b` (Phase 3A/3B).
Branch: `feat/phase3-job-attachments`. The starting worktree was clean.
No push, formal-user database access, data-root rename or NSIS build.

## Implementation

- New migration `20261031140000_job_attachments` adds one JobAttachment model,
  referencing the existing Job and File. Unique slot/file indexes and kind/size
  checks enforce one CV and one Cover Letter, each at most 10 MiB. Historical
  migrations and legacy tables are retained.
- `src/lib/documents/` provides extension/container validation, bounded multipart
  reads, ownership-scoped storage/downloads, a document/backup lock and durable
  file-operation intents. No AI or content extraction is invoked.
- `src/lib/storagePaths.ts` adds `data/files/jobs` under the unchanged root.
  Generated names and job-specific hashed directories avoid collisions; real-path
  checks reject traversal/link escapes. Paths never come from request parameters.
- `src/app/api/jobs/[jobId]/documents/` exposes owned listing, batch upload,
  download and deletion. Only metadata suitable for the UI is returned.
- AddJob replaces both global library selectors with optional file inputs. Files
  remain in browser memory until Save. A saved Job ID survives upload failure,
  with explicit retry/open/close options. Retrying skips disabled business-field
  validation and does not create a duplicate job.
- JobDetails includes the small JobDocuments panel for upload/download/replace
  and confirmed deletion. Job deletion also removes its own File rows/bytes.
- `/dashboard/profile` now renders read-only LegacyFiles; the navigation label
  changes accordingly. Old resumes, downloads, structured PDF views and legacy
  cover-letter exports stay accessible. Old models/compatibility helpers remain;
  no automatic reassignment or migration of legacy files occurs.
- Existing backup schema/order/scoping/export/import/snapshot flow is extended
  with JobAttachment. Exports write v2; the reader still accepts v1. File bytes,
  kinds and job relationships are validated before restore, and paths/IDs are
  rebuilt through the existing mapping. Missing, malformed, duplicated or
  ambiguously identified new documents are refused without replacing current data.
  File IDs are captured before wipe removes ownership relations, avoiding orphan
  File rows on restore. Existing snapshot/rollback and CSV behavior are retained.
- `src/instrumentation.ts` runs document-journal recovery only. It starts no
  scheduler, automation, AI or polling task. Electron lifecycle code is unchanged.

No runtime or development npm dependencies were added, removed or upgraded.
No tracked source file was deleted; retired global selection code is removed from
the active job workflow. Legacy implementation helpers are retained for compatible
downloads/PDFs and existing data rather than broadly refactoring the old system.
See [storage and user instructions](JOB_ATTACHMENTS.md).

## Graded verification

Development checks were scoped to storage/HTTP/backup and affected form/components.
Detailed output is in ignored `.local-runtime-test/phase3c-*.log` files.

| Check | Result |
|---|---|
| New DB model/formal deploy | PASS in disposable SQLite databases |
| Existing account/job/legacy-file upgrade | PASS through unchanged old migrations plus new migration |
| Optional slots / both kinds / duplicate filenames | PASS |
| Actual bytes / Unicode header / path confinement / owner isolation | PASS |
| Invalid extension, fake PDF/DOCX, generic ZIP, empty/oversized file | PASS |
| Whole-batch validation and one-slot DB uniqueness | PASS |
| Disk write/transaction failure preserves the old file | PASS |
| Interrupted-intent recovery and concurrent replacements | PASS |
| Job deletion / replacement removes superseded File rows and bytes | PASS |
| Backup v2 / v1 compatibility / strict missing-file refusal / rollback | PASS |
| Cancel form before Save / partial-save retry / deletion confirmation | PASS |
| TypeScript | PASS after correcting test-only role query types |
| ESLint | PASS |
| Full Vitest | One run only: 181 files, 2,067 tests; 2,057 passed and 10 failed initially |
| Failed-scope follow-up | PASS: 3 files / 36 tests, resolving all 10 full-run failures |
| Final backup-integrity follow-up | PASS: storage/restore file, 15 tests |
| Next.js production build | PASS; desktop standalone output |
| Actual Electron documents/restart | PASS, 10 groups including a simulated failed upload and explicit retry |
| Final metadata/disk audit | PASS, 46 applied migrations; no missing files, orphan rows/bytes or pending intents |

The full-run failures came from missing new-model/new-path test fixtures and a
retry test clicking before its transition-enabled button was ready. Only those
three files were rerun. **Full Vitest execution count: 1.** All known failures were
resolved; a second full run was intentionally not performed. A late restore-ID
integrity review added a targeted regression to the existing storage test file;
only that file was rerun after the guard.

Production builds: two. The first passed, then the necessary restore-ID integrity
guard changed server code, so the production verification directory was updated
once. Both use `desktop:pack` (`--dir`, `--publish never`); no NSIS is created.
There is no repeated lifecycle/installer test campaign in this phase.

Electron ran the unpacked production EXE copied outside the checkout, with system
Node absent from its PATH. The isolated home was `.local-runtime-test/Phase3C 附件 测试`.
Actual Add Job UI verified no-file, CV-only, Cover-Letter-only and both-slot saves,
cancel-before-save and a simulated upload failure followed by retry on the same
Job ID. Native Electron downloads verified Chinese filenames and byte equality.
Replacement/deletion isolation, confirmation, legacy downloads, v2 ZIP restore,
Activity Calendar loading and close/reopen persistence passed. Runtime keys were
unchanged. Final DB paths matched exactly the on-disk attachment/legacy files.

The test harness needed two corrections: distinguish a file-picker input from
the identically named action button, and give each Electron session a unique
native-download destination with a completion-event wait. Checkpoints skipped the
five, then nine groups already passed; only remaining/failed steps were continued.
No application code or production build was changed for these test corrections.

## Isolation, evidence and limits

DB tests use guarded temporary `jobsync-backup-*` directories. Electron uses a
separate `.local-runtime-test` home with its own keys/database/files. No test record
is written to `%LOCALAPPDATA%\JobSync`. The current app and data directory still
use JobSync naming.

Relevant logs:

- `phase3c-full-vitest.log`, `phase3c-full-failures-verified.log`
- `phase3c-restore-integrity-verified.log`, `phase3c-ui-tests.log`,
  `phase3c-form-retry-verified.log`
- `phase3c-types-verified.log`, `phase3c-final-lint.log`
- `phase3c-production-build.log`, `phase3c-production-final.log`
- `phase3c-electron-documents.log`, `phase3c-electron-resumed.log`,
  `phase3c-electron-restart.log`, `phase3c-final-changed-files-lint.log`

The isolated `verification/job-documents-report.json` combines all 10 passed
groups. `job-documents.png` records the final UI. Temporary external application
copies are removed after verification; isolated evidence and win-unpacked output
remain ignored by Git.

Not performed: formal-user data upgrade, NSIS install/uninstall, a clean VM,
Windows reboot, full legacy multi-browser Playwright suite, cloud AI calls or
unrelated Electron lifecycle repetition. The existing unpdf bundling warning is
unchanged. A stale older `JobSync-Setup-1.1.22.exe` may remain in dist-desktop; it is
not a Phase 3C installer. New unpacked output is only for this phase's testing.

Windows may temporarily lock superseded files. Their cleanup stays recorded and
is retried on the next document operation/start; committed replacement bytes are
kept. Lost/corrupt active bytes are never silently advertised as a complete ZIP.
Legacy PDFs/archived models and compatibility APIs remain read-only in the active
UI. Phase 4, AI Autofill, branding and data-root migration remain deferred.
