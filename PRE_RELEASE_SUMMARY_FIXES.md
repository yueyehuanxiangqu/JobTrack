# JobTrack 0.1.0 — JD extraction and summary fixes

## Changes

The old extractor selected the first JobPosting without checking which vacancy
it described, then fell back to concatenated main/article/body text. It also
flattened paragraph boundaries. Autofill copied that entire prose into one
description paragraph, including unrelated content from broad page containers.

The extractor now selects a unique current JobPosting by the validated final
URL or a unique visible title, rejecting ambiguous multi-job data. A short
structured teaser may fall back to a scoped job-description region or a
single-job main/article with a responsibilities heading. Nested independent
regions are rejected instead of concatenated. Navigation, cookie/consent,
related/recommended jobs, forms, dialogs, headers, footers and hidden elements
are excluded; paragraph and list boundaries remain. Generic body/main dumps
and unsupported/dynamic pages ask the user to paste the JD instead.

Existing protocol/IP/DNS pinning, redirect checks, timeout and response-size
limits are unchanged. Fetch now also returns the revalidated final URL for
posting selection; the Job URL field still keeps the original user input.

AI returns a strict schema of basic fields, `summary` (at most six non-empty,
single-line points), and nullable `salary`. Its prompt requests 3–6 concise,
independent responsibilities/priorities, fewer when evidence is insufficient,
professional terminology, deduplication and no invented facts. Missing basic
facts remain null. No separate requirements or other AI sections are added.

Summary uses existing `Job.description`, as escaped HTML `ul/li/p` items.
Exact duplicate points are collapsed. The existing Tiptap editor is reused
with only its bullet-list control in this form; no editor or other dependency
was added. Lists have spacing, normal wrapping and overflow protection. A
new or explicitly edited summary is normalized to list items at Save.
Untouched legacy descriptions remain byte-for-byte as loaded, including when
editing other job fields. No historical JD is rewritten in bulk. Autofill
does not return or save an additional copy of the fetched source description.

Salary uses existing nullable `Job.salaryRange`: one optional text input and
a detail-card display. The prompt asks for the exact original amount, currency,
pay period and gross/net wording. The server accepts it only when it is an
exact quote from the source JD and contains a currency and amount; otherwise
it becomes null. The app performs no estimates, conversions or salary analysis.
Model interpretation still requires the user's review before saving.

Job Due Date is removed from Add/Edit, along with its default generation and
legacy “Expired” badge override. The database column and old values remain
compatible; omitted dates are not overwritten on edit. Status, Applied Date,
interview dates and Task Due Date retain their existing behavior. Existing
source selection and other unrelated job workflows are retained.

Autofill remains a draft: no job/company/title is created until Save. Existing
manual summary, salary and basic fields stay intact unless replacement is
explicitly allowed. The existing list refresh and per-job document upload
paths are reused; attachments never enter the AI request.

## Validation

- First targeted batch: 142 tests across extraction, provider SDK mock requests,
  strict schema, summary formatting, Add/Edit Job, details, cards/table and
  Task form — passed.
- Compatibility batch: 197 tests across URL safety, extraction, job actions,
  Add/Edit Job and backup schema/real SQLite ZIP round trips — passed. This
  includes assertions added after the first batch; overlapping files were
  rerun for those changes.
- Final extractor refinement: 15 tests — passed, including nested regions
  that must not merge separate vacancies.
- TypeScript, ESLint and production/NSIS build — passed.
- Packaged payload audit: 23,953 files, no credential-pattern/user-data/test
  artifact findings. Original MIT license and all seven selected ICO frames
  match in both application and installer — passed.
- No real AI API requests, paid tokens or live recruitment-site crawling.
- No full Vitest rerun: changes are localized, with direct UI, action, network
  safety and real backup round-trip coverage; no schema, dependency, provider
  protocol or credential-storage changes.

The opt-in isolated Electron helper `scripts/local/verify-ai-autofill.mjs`
passed **six end-to-end groups** on the new packaged application: rendered
bullets, manual corrections, Save/list refresh, reopening/editing, optional
salary, both document downloads, Activity Calendar, provider configuration,
invalid JSON handling and renderer isolation. Five local mock API requests
were made; there were no renderer errors. The app and backend exited cleanly.

The user first saved and closed the installed app; it was never forcibly
closed or updated. Only an independent ignored `JOBTRACK_HOME` was used.
Focused layout verification then checked the saved summary at normal size
and a narrow 900px window with 150% application zoom: two independent list
items remained inside the viewport with no horizontal content overflow.
Native Electron screenshots were visually reviewed. A zoom-related clipping
problem in automation screenshots was resolved in the verification helper
using native capture and DOM scrolling; no app code or rebuild was needed.
No fresh installation/uninstallation or full machine reboot was repeated.

## Data and release boundary

No formal user database was cleared, restored, migrated or intentionally
written by this work. Destructive backup round trips use temporary databases.
The existing installed app was not replaced. File-path/content SHA-256
inventories of `%LOCALAPPDATA%\JobTrack` and migration recovery backups,
captured after the user closed the app, match after isolated testing.
The old source backup is untouched.
No dependency, historical migration, license, acknowledgement, brand config,
icon, application ID or version changed. No merge, Push or GitHub Release.

## Updated local installer

- Path: `F:\Programming\Applications\JobTrack\dist-desktop\JobTrack-Setup-0.1.0.exe`
- Size: **260,056,124 bytes** (248.01 MiB).
- SHA-256: `c3ea7eb425669fe9e6a76a13d4926a7f9b1189ab8712b8c0800b3083e08330ab`
- A matching `.exe.sha256` sidecar is present. Generated binaries and private
  verification artifacts remain Git-ignored.
- This unsigned installer was generated once for this change and has not been
  installed over the user's existing copy. Close JobTrack before testing it.

Extraction intentionally favors a manual-paste fallback over an ambiguous
import; not every ATS layout or language is recognized. AI summaries still
need human review. Windows code signing/distribution status is unchanged.
