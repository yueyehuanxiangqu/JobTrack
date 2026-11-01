# Phase 4: responsive desktop layout and cleanup

Work is isolated on `feat/phase4-responsive-cleanup`. `main` remains at
`c5b4f8365d39e9b34f76de16e6ba466fd1b96f90`. No push, release, NSIS installer,
installation, database schema change or Phase 5 work is included.

## Layout changes

- Reuse the existing sidebar and Sheet navigation. Below the desktop breakpoint,
  the drawer includes every core route and the account menu, including Settings
  and Logout. The wide sidebar retains its collapse preference.
- Let Flex/Grid children shrink and let long job titles, companies and URLs wrap.
  Keep all table columns and actions available through local horizontal scrolling.
  The page itself does not need horizontal scrolling.
- Stack forms and settings sections when space is limited. Dialogs and pickers
  respect the available viewport and scroll vertically; Save, Cancel and Export
  stay reachable. PDF preview retains a bounded measurement area.
- Reserve validation-message space for Activity Name. Its existing onTouched
  validation otherwise inserted an error while the next button was being
  clicked, moving the target between pointer down and pointer up. Validation
  rules and save behavior are unchanged.
- Keep the Activity Calendar's real application/activity queries, date grouping,
  counts, hours, year selection and color scale. A minimum chart width preserves
  square days. Local scrolling, legend placement and viewport-clamped hover
  tooltips prevent clipping. No mock data is introduced into the application.
- Preserve font sizes and Electron's original minimum window size of 800 x 600.

The initial 800-pixel viewport exposed a 2,599-pixel job details page and a
2,040-pixel Tasks page with long fixture text. Shared minimum-content sizing and
unbroken text were the causes; global overflow hiding was not used as a fix.

## Verification scope

All runtime checks use isolated homes below this checkout's ignored
`.local-runtime-test/` directory. No personal data home is opened, migrated,
restored, reset or deleted. Logs, screenshots, generated PDFs and ZIPs stay
ignored. The full Vitest suite was run **once**: **169 files / 1,962 tests passed**.
TypeScript and ESLint passed. An initial new UI test had a TypeScript-only
Testing Library option mismatch; that option was corrected before the final
passing TypeScript check and full test run.

The Next.js production build was run **twice**, with both builds passing. The
second build was necessary after the real Electron check exposed the Activity
Name validation-message layout shift. Only the affected UI tests were repeated
after that presentation fix: **5 files / 60 tests passed**, with scoped ESLint
also passing. The full Vitest suite was not repeated. Resource staging was
interrupted, then its official Node checksum request was blocked by the network
sandbox. Subsequent staging uses `--reuse-next`, without another Next.js build.
Only an unpacked Electron directory is requested; the old installer is not a
Phase 4 deliverable.

Development checks cover Dashboard, Jobs/list/details, Interviews, Tasks,
Activities and Settings at CSS viewports equivalent to 800 x 600, 1024 x 768,
1280 x 720, 1366 x 768 and 1920 x 1080, plus representative 80%, 125%, 150% and
200% page zoom. Add/Edit Job, Task and Activity forms, date pickers, narrow
navigation, account menu, settings sections, registration, migration, square
calendar cells and a real January application tooltip were checked separately.
Development viewport emulation is not an actual Electron zoom or Windows DPI test.

Production Electron size/zoom measurements (seven pages per row, 63 page checks):

| Requested outer window | Electron page zoom | Measured CSS viewport |
| --- | --- | --- |
| 800 x 600 | 100% | 788 x 564 |
| 1024 x 768 | 100% | 1010 x 732 |
| 1280 x 720 | 100% | 1266 x 684 |
| 1366 x 768 | 100% | 1352 x 732 |
| 1920 x 1080 | 100% | 1906 x 1044 |
| 800 x 600 | 80% | 985 x 705 |
| 800 x 600 | 125% | 630 x 451 |
| 800 x 600 | 150% | 525 x 376 |
| 800 x 600 | 200% | 394 x 282 |

These are actual BrowserWindow resizing and `webContents.setZoomFactor` checks,
not just browser viewport emulation. The primary display reported scale factor
**1.25 (125%)**. Actual Windows DPI changes to **100%, 150% and 200% were not
performed**. A device pixel ratio of 1 during 80% page zoom does not establish
that Windows was switched to 100% scaling.

The unpacked application runs from a marked temporary copy outside the checkout
because Codex's directory ACL sandbox prevents direct Electron startup in the
checkout. Electron's own sandbox remains enabled, context isolation is enabled,
Node integration is disabled, and the minimum size remains 800 x 600. No ACL or
system security setting is changed. Runtime checks hide system Node from PATH.

### Final runtime results and limitations

- Final-build narrow forms at 100% and 200% page zoom pass: Add/Edit Job, Task,
  Activity, date/time pickers, PDF export dialog controls, settings sections,
  navigation/account menu, registration and migration layout. Wide sidebar
  collapse/expand also passes. No renderer errors were recorded.
- The calendar retains square days and local horizontal scrolling. Its first-
  week tooltip shows one real fixture application and zero hours without being
  clipped. A separate core-flow check confirms one application and one hour of
  actual recorded activity. Date labels and the legend fit vertically.
- Core Electron flows pass with an **explicit Reload jobs after saving**:
  registration, job creation/edit/deletion, interview stage/status consistency,
  Tasks/Activities, local per-job CV, Legacy Unicode PDF download, PDF/CSV export,
  ZIP preflight/restore, attachment recovery, snapshot/rollback, duplicate username
  rejection and isolation between two test users. These checks use real local
  SQLite records and bytes, not mocked server responses.
- **Known pre-existing limitation:** the original `verify-browser.mjs` run fails
  its automatic list-refresh expectation after creating a job in an empty Jobs
  list. The record is correctly saved; the list displays it after **Reload jobs**.
  `AddJob.finishSave` and the list refresh logic are unchanged from `main`.
  A temporary, ignored harness adaptation explicitly clicks the existing Reload
  button after saving to verify the remaining core workflows. This is not
  reported as an automatic-refresh pass, and no business logic fix is included.
- All **8 actual Electron lifecycle checks pass**: external link routing,
  minimize/background service, duplicate-launch focus, X/owned-process cleanup,
  crash cleanup, restart with original keys, occupied-port refusal and closing
  during startup. An unrelated Node process remains alive throughout the checks.
- Stop/restart login verification passes, including rejection of a wrong password,
  normalized username login and downloading the preserved legacy attachment.
- All **9 Node runtime/security tests pass**. TypeScript/full lint passed before
  the final presentation fix; final production build includes passing type/lint
  checks, and scoped ESLint plus the 60 affected UI tests pass afterward.
- The 63-page size matrix is not repeated after the final Activity Name message-
  space fix: closed-page layout is unaffected. The affected open forms are
  retested on the final build. Full Vitest remains exactly one run; Next.js
  production compilation is two runs, the second justified by that UI fix.
- No known overlap or inaccessible main controls remain in the verified layouts.
  Actual Windows DPI 100%/150%/200%, every possible zoom/DPI combination,
  GitHub-hosted CI and signed distribution are not verified here. The application
  remains unsigned; Playwright emits its existing Node DEP0190 warning.

Evidence: ignored `phase4-*` logs and the isolated homes' `verification/` JSON,
screenshots, PDF and ZIP files. The temporary executable copy is removed after
verification. The local unpacked build remains ignored; the old NSIS installer
is not regenerated or presented as the new build.

### Re-running the opt-in layout check

Set `JOBSYNC_HOME` to a disposable initialized fixture inside
`.local-runtime-test/`. The fixture's `verification/account.json` contains
`username`, `password`, `jobId` and optionally `resumeId`; never commit that file.
Use long job/company/URL/file names, populated lists, a January 4 application
and a structured legacy resume when checking PDF layout. The current fixture
uses the 2026 calendar, with one application on January 4 and a completed activity.

Set `JOBSYNC_ELECTRON_EXE` to the current unpacked `JobSync.exe` and run:

```powershell
node scripts/local/verify-responsive.mjs
```

Without that variable the check uses Edge against an already running isolated
local service. `--forms-only` avoids repeating the size matrix while debugging
interactions. Reports and screenshots go to the fixture's `verification/` folder.
The existing `verify-browser.mjs` and desktop `verify-lifecycle.mjs` cover core
data/export and process behavior separately.

## Cleanup method and retained modules

Candidate discovery follows imports/exports and literal dynamic imports from
Next.js pages, layouts, routes, middleware and instrumentation. Each candidate
was then checked against callers, tests, runtime scripts and packaging. A graph
alone is not proof: shared UI primitives, test fixtures, dynamically loaded PDF
assets and future model infrastructure were deliberately retained.

- Keep `src/lib/ai/providers.ts`, provider registries/factories, provider settings,
  encrypted API key storage and AI usage helpers for future model calls.
- Keep unused shared UI primitives (`alert`, `hover-card`, `input-group`,
  `progress`, `scroll-area`) and their dependencies as the existing UI kit.
- Keep `jobSourcesData.ts` and `jobStatusesData.ts`: Add Job tests still use them.
- Keep Legacy Files, resume compatibility APIs/actions, PDF templates, fonts,
  `unpdf`, file storage, backup/restore and all 46 historical migrations.
- Keep shared `scripts/local` runtime/CLI and Electron lifecycle/security code.
  Removing old deployment entrypoints does not remove the Next.js backend.
- Keep LICENSE, upstream copyright, attribution, historical changelog and prior
  validation reports. Those reports describe earlier phases, not current Docker
  support. No tracked wiki or screenshots remain to delete; public assets are
  retained because UI/PDF/packaging load them, including through dynamic paths.
- Keep CI, adjusted from upstream's Node 20/Linux/dev-branch assumptions to
  Node 24/Windows/main. Its GitHub-hosted run is not verified in this local phase.

`mammoth` is the only removed direct npm dependency. Normal npm uninstall removed
nine now-unused transitive packages as well. The lockfile adds no packages and
changes no retained package version. `unpdf` remains required by PDF preview.

The old resume text parser had no runtime caller. Its unchanged PDF/ZIP magic
checks, `sniffFileType` and `preflightZip` now live in
`src/lib/files/formats.ts`; attachment, legacy upload and backup imports use that
module. Archive/magic-check tests remain alongside existing document/backup tests.

## Verified removal list

The following exact tracked files were checked before deletion. No recursive
directory cleanup or user-data cleanup was performed.

### retiredCode

Retired UI, schemas and helpers: no runtime callers after Phase 3; the right-rail provider had no consumers.

- `src/components/admin/contacts-container/ContactRoleFilter.tsx`
- `src/components/admin/contacts-container/useContactsList.ts`
- `src/components/common/SlowResponseWarning.tsx`
- `src/components/IncompleteResumeHint.tsx`
- `src/components/myjobs/TagInput.tsx`
- `src/components/profile/CopyResumeDialog.tsx`
- `src/components/profile/CreateCoverLetter.tsx`
- `src/components/profile/CreateResume.tsx`
- `src/components/profile/ProfileContainer.tsx`
- `src/components/profile/ResumeTable.tsx`
- `src/components/RadialChartSvg.tsx`
- `src/lib/atsBoardUrl.ts`
- `src/lib/automation-logger.ts`
- `src/lib/data/activitiesData.ts`
- `src/lib/data/barChartData.ts`
- `src/lib/questions/createQuestionFromNames.ts`
- `src/models/addCertificationForm.schema.ts`
- `src/models/addContactInfoForm.schema.ts`
- `src/models/AddEductionForm.schema.ts`
- `src/models/addExperienceForm.schema.ts`
- `src/models/addSummaryForm.schema.ts`
- `src/models/agent.model.ts`
- `src/models/copyResumeForm.schema.ts`
- `src/models/coverLetterForm.schema.ts`
- `src/models/createResumeForm.schema.ts`
- `src/models/notification.model.ts`
- `src/models/question.model.ts`
- `src/models/resumeImport.schema.ts`
- `src/models/skills.schema.ts`
- `src/utils/resumeImportStream.utils.ts`
- `src/utils/resumeSections.utils.ts`
- `src/utils/skillImport.utils.ts`
- `src/context/RightRailContext.tsx`

### dedicatedTests

Tests exclusively for removed features: active document/backup/PDF/core tests remain; file container tests replace parser tests.

- `__tests__/IncompleteResumeHint.spec.tsx`
- `__tests__/TagInput.spec.tsx`
- `__tests__/CopyResumeDialog.spec.tsx`
- `__tests__/CreateResume.spec.tsx`
- `__tests__/ProfileContainer.spec.tsx`
- `__tests__/ResumeTable.spec.tsx`
- `__tests__/createQuestionFromNames.spec.ts`
- `__tests__/addCertificationForm.schema.spec.ts`
- `__tests__/addContactInfoForm.schema.spec.ts`
- `__tests__/coverLetterForm.schema.spec.ts`
- `__tests__/resumeSections.utils.spec.ts`
- `__tests__/skillImport.utils.spec.ts`
- `__tests__/RightRailContext.spec.tsx`
- `__tests__/extract-text.spec.ts`

### serverDeployment

Docker/Jenkins/server deployment only: no Electron, npm runtime or packaging references. Desktop is the supported distribution.

- `.dockerignore`
- `Dockerfile`
- `Jenkinsfile`
- `deploy.ps1`
- `deploy.sh`
- `docker-compose.observability.yml`
- `docker-compose.otel.yml`
- `docker-compose.yml`
- `docker-entrypoint.sh`

### relocatedHelpers

Unused text parsing removed; generic file signature/ZIP checks relocated unchanged to src/lib/files/formats.ts.

- `src/lib/ai/import/extract-text.ts`
