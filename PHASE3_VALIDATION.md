# Phase 3A + 3B validation

Date: 2026-10-31 (Europe/Amsterdam). Windows 11 x64.
Baseline: `feeb629` on main. Work branch: `feat/phase3-cleanup-auth`.
No push, release, installation over an existing app, or formal-user data access.

## Scope and cleanup

The first commit removes 458 files. Final integration removes one additional
unreferenced AI cover-letter component and two retired-only E2E files:
**461 deleted files in total**. The retired
features include chat/agent, resume review, matching, AI letter generation,
automation/search/scraper/cron execution, MCP endpoints, Daily Goals, independent
Questions/Contacts/Watchlist screens, structured Resume Builder, salary and Add
Skill controls. Wiki, its publishing workflow/tooling and retired-feature evals
are removed. See [compatibility boundaries](PHASE3_CLEANUP.md).

Seven direct npm dependencies are removed:

- Runtime: `@ai-sdk/react`, `@modelcontextprotocol/sdk`, `node-cron`, `p-limit`,
  `react-goal-calendar`, `use-stick-to-bottom`.
- Development: `@types/node-cron`.

The lockfile loses 111 package entries; **zero existing package versions change**.
Windows `npm ci` installs 975 packages. Next 15.5.25, React 19.2.4, Prisma 6.19.0,
Electron 45.2.0 and electron-builder 26.18.0 remain unchanged.

Company, Contact, Resume, File, Skill/Tag, Question and deprecated automation/chat
database models remain for relationships, legacy PDFs and backup compatibility.
Jobs retain company/contact links; interviewers remain usable. The retained file
library supports uploads/downloads and legacy PDF output. Its file-backed CVs no
longer require structured sections to be selected or made default. This is not
the deferred per-job attachment implementation.

Provider adapters, model/key settings, connection checks, supported Base URL
settings and encrypted key resolution remain. No retired scheduler startup hook,
cron import, post-restore restart or executable MCP/chat route remains. Restored
automations are paused with no next run, tested by normalization and round-trip
backup tests. Archived rows are not deleted or reactivated.

Final integration also removes the unused AI import toggle/effect/session marker
from CreateResume and stale automation/wiki/MCP instructions. Ordinary document
upload remains. Old Playwright scenarios for salary/skills, structured resume
editing, independent Contacts, Questions and automation quick actions are removed;
job/company contacts and document-title tests remain. Their login helper now uses
explicit `JOBTRACK_E2E_USERNAME` / `JOBTRACK_E2E_PASSWORD` test-account credentials.
Application branding and icons are unchanged.

## Authentication and migration

Important files:

- `src/models/auth.schema.ts`: canonical username and password validation.
- `src/lib/auth/accounts.ts`: atomic registration/seeding, bcrypt verification,
  one-time legacy account claim and safe authentication result.
- `src/actions/auth.actions.ts`, `src/auth.ts`, `src/auth.config.ts`: server actions,
  Credentials provider, user-ID sessions and username propagation.
- `src/components/auth/{SignupForm,SigninForm,LegacyMigrationForm}.tsx` and
  `src/app/(auth)/migrate-account/page.tsx`: normal username UI and explicit legacy flow.
- `prisma/schema.prisma` and the new
  `prisma/migrations/20261031110000_username_authentication/migration.sql`.
- Backup manifest/export/import/snapshot modules and API routes: optional
  `sourceUsername` identity while retaining old email-only ZIP support.
- `__tests__/usernameAccounts.spec.ts`, `__tests__/usernameUpgrade.spec.ts` and
  `scripts/local/verify-browser.mjs`: isolated DB and actual UI regressions.

Usernames are trimmed, lowercase, 3–32 ASCII characters, with validation in both
forms and server code. SQLite `NOCASE` uniqueness also rejects case-only direct
writes. The actual username column is used; new-account email is NULL. Password
hashing, sessions, logout and user-ID ownership checks remain in place.

The new migration atomically copies User, preserving IDs, password hashes,
original emails, creation timestamps and default-resume relationships. All 44
historical migrations and LICENSE are byte-identical to the baseline. No business
table is dropped; no reset or db push is used. Existing keys are reused.

An existing account verifies its original email/password before setting a unique
username once. The compare-and-set update changes only username. Wrong proofs,
duplicates and repeated claims are rejected. Tests verify unchanged legacy jobs,
resume metadata/file bytes, tasks, activities and decryption of a saved API key.
Formal 44-to-45 migration, foreign-key integrity and repeat no-op deploy are tested.
See [user instructions](USERNAME_MIGRATION.md).

## Checks and isolation

| Check | Result |
|---|---|
| Windows npm ci / Prisma Client generation | PASS |
| Fresh SQLite migrate deploy and old 44-migration upgrade | PASS, 45 migrations; repeat deploy is a no-op |
| TypeScript and ESLint | PASS |
| Full Vitest suite | PASS, 179 files / 2,048 tests |
| Native launcher and desktop security Node tests | PASS, 9 tests |
| Native production build/start/stop | PASS with isolated data |
| Username registration/login, wrong password, case/space duplicate | PASS, unit DB and real UI |
| Legacy account claim with original records/files | PASS, DB tests, native browser and packaged Electron |
| Multi-user ownership | PASS, another real user cannot read the owner's job/file |
| Jobs create/edit/delete, status/timeline | PASS, actual original UI |
| Interviews | PASS, scheduled stage/notes/duration, synchronized job status and list |
| Dashboard / Activity Calendar | PASS, real one-application/one-hour tooltip; chart not redesigned |
| Tasks / Activities | PASS, original forms persist records |
| Unicode PDF upload/download | PASS, local bytes identical after download and restore |
| CSV / legacy resume PDF | PASS, actual CSV content and native PDF download |
| ZIP export/preflight/confirmed restore/snapshot/rollback | PASS, preserved file bytes and account identity |
| Retired routes and navigation | PASS, core pages render, retired pages/chat/MCP return 404 |
| Final packaged EXE | PASS, outside checkout, bundled Node with system Node absent from PATH |
| Close/minimize/single instance/crash recovery/port conflict/startup cancel | PASS, all 8 actual Electron lifecycle checks; unrelated Node survives |
| Stop/restart and persisted CV | PASS, stable keys, normalized username login and identical file bytes |
| Remaining Playwright project discovery | PASS, Chromium --list; full legacy multi-browser suite not run |

Tests never use `%LOCALAPPDATA%\JobSync`. Native checks use
`.local-runtime-test/Phase3 测试`. Packaged checks use
`.local-runtime-test/Electron Phase3 验证`, initially a copy of the isolated
44-migration fixture with a legacy job, attached CV, task and activity. Fixtures,
credentials, keys, logs, screenshots and generated packages are ignored by Git.

The packaged app is copied outside the checkout to prevent fallback imports from
the developer node_modules. `app.isPackaged` is asserted and the application PATH
contains only Windows system directories. Sandbox/contextIsolation are true;
renderer Node integration is off. The host still has developer Node installed:
this is not a clean VM with Node physically removed.

## Artifacts, evidence and limits

The installer remains named `dist-desktop/JobSync-Setup-1.1.22.exe`, 260,853,936 bytes
(about 249 MiB). Its adjacent `.sha256` matches this SHA-256:

```text
60bac985d96bac1ada17098e739445030bae4ec4c98cddd874f07692a7728a14
```

Build outputs are not committed or uploaded. The application, data root and
installer version have not been renamed. The final unpacked production EXE was
tested outside the checkout; the temporary external app copies were then removed.

Local evidence includes `.local-runtime-test/phase3-a-setup.log`,
`phase3-b-setup.log`, `phase3-regression-complete.log`, `phase3-runtime-tests-final.log`,
`phase3-lint-delivery.log`, `phase3-typecheck-e2e-final.log`,
`phase3-desktop-build-complete.log`, `phase3-electron-legacy.log`,
`phase3-electron-core-complete.log`, `phase3-electron-restart-complete.log`,
`phase3-electron-lifecycle-verified.log` and `phase3-playwright-list.log`.
JSON reports and screenshots remain in the isolated home's `verification/`.

Resolved checks during implementation included outdated auth test expectations,
fresh-build TypeScript result narrowing, JSX text escaping, and Playwright
selectors for the actual Select/Nivo CSS output. The startup-cancel lifecycle test
also had to wait for the initial about:blank window to load its file URL before
closing it. Final results above are reruns;
an initial failed attempt is not treated as a pass.

Not reverified in this phase: the full retained legacy Playwright multi-browser
suite, running the NSIS install/uninstall wizard or Windows
shortcuts, reboot behavior, a clean VM, real paid provider API calls and the user's
formal database. Phase 2's installer evidence remains historical, not a claim of
a new Phase 3 installation test. The unsigned installer remains subject to normal
Windows publisher/reputation prompts. Next still reports the existing unpdf
import.meta bundling warning; PDF upload/download and legacy PDF export pass.

The temporary global document library and read-only structured legacy resumes
remain until Phase 3C. Per-job CV/Cover Letter attachments, languages/layout work,
AI Autofill and branding are not implemented here.

For the optional legacy Playwright suite, configure an isolated development
database/home and test account first, then pass its username/password through the
two environment variables above. Do not point that suite's development server at
formal-user data. The opt-in native/Electron verification scripts used here enforce
an isolated home inside `.local-runtime-test` and provide the tested core UI path.
