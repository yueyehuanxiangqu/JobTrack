# Phase 3A — Core workflow cleanup

The desktop and native launchers retain their existing architecture and data root.
Application naming and the MIT copyright notice are unchanged.

## Removed runtime features

- General AI chat, resume review, job matching and AI cover-letter generation.
- Automations, job-board directories, scheduled searches, scraper runners and cron.
- MCP routes/tokens UI, automation notifications and their background polling.
- Daily Goals, independent Questions, Company Watchlist and independent Contacts UI.
- Structured Resume Builder and Add Skill controls; salary controls and match scores.
- Upstream wiki publishing, wiki tooling and evaluations dedicated to removed features.

Dashboard, the real-data Activity Calendar, Jobs/statuses/notes/timeline, Interviews,
Tasks, Activities, Settings, file uploads/downloads, ZIP restore/rollback, CSV export
and legacy resume/cover-letter PDF exports remain.

## Compatibility boundaries

- No existing migration, business table, relationship or stored attachment is removed.
  Deprecated tables/columns remain archival data for existing databases and backups.
- Legacy Automation rows restored from ZIP are forced to `paused` with `nextRunAt`
  cleared. There is no scheduler import at startup or after restore, nor an API that
  can execute a retired run.
- Company/reference data and contact actions used by jobs/interviewers remain.
- The temporary document library still supports uploaded files and existing resume
  PDF preview/export. Structured editing and AI actions are removed. This is not the
  later per-job CV/Cover Letter attachment implementation.
- AI provider adapters, model selection/connection checks, Ollama Base URL settings,
  API-key encryption/resolution, and small shared file/text helpers remain reusable.
- Existing authentication is unchanged in this first commit; username authentication
  and its additive compatibility migration are a separate Phase 3B commit.

## Validation before the cleanup commit

- Windows locked dependency installation, Prisma Client generation, all 44 existing
  migrations on a fresh isolated database, and native production build: passed.
- TypeScript, ESLint and 177 Vitest files / 2,056 tests: passed.
- Actual Edge browser against the native production server: account registration,
  Dashboard/Activity Calendar, job create/edit/delete and timeline, Tasks/Activities,
  Unicode PDF attachment upload/download, PDF/CSV export, ZIP preflight/restore,
  snapshot/rollback and retained pages passed. Retired pages and AI/MCP routes are 404.
- Test home: `.local-runtime-test/Phase3 测试`. Formal LocalAppData data was not used.
- An initial parallel dependency-install/test attempt hit a Windows native-module
  lock. The test process was stopped; installation and checks were rerun in order.
- Electron packaged-runtime and username migration regression are recorded in the
  Phase 3B delivery report after the final integrated build.

Six runtime dependencies and the node-cron development types were removed.
No existing locked package version, including Next.js/React/Prisma/Electron, changed.
