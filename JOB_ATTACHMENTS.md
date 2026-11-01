# Job documents

Each application has two optional slots: **CV** and **Cover Letter**. Each accepts
one PDF or DOCX file up to 10 MiB (shown as 10 MB in the UI). No resume sections,
content extraction, scoring, templates or AI calls are required.

## Use

Select files in Add Job and click Save. Canceling before Save sends no upload and
creates no file. Saving without either file is supported. Job creation and file
upload are separate requests: if the job was saved but uploading failed or its
response was interrupted, the form explicitly says so. **Retry documents** uses
the saved Job ID, without creating a duplicate. You can also open that saved job
or close the form and finish uploading later. Already-saved business fields are
locked during this document retry.

The job details page has a Documents area. Choose a file and click Upload or
Replace; Download returns the original filename and bytes. Delete requires
confirmation and affects only that slot. Editing a job also offers replacement
file inputs; existing documents stay attached unless explicitly replaced/deleted.

## Data and access

Migration `20261031140000_job_attachments` adds **JobAttachment** with `id`, `jobId`,
`kind`, `fileId`, and byte `size`. Existing File holds the original name, storage
path, MIME type and upload time. A unique `(jobId, kind)` index permits only one
CV and one COVER_LETTER per job; file IDs are also unique. SQLite checks enforce
the kind and size bounds. No old migration, User ID, Job ID, legacy relation or
existing file is rewritten by the migration.

Files stay under the existing local data root:

```text
%LOCALAPPDATA%\JobTrack\data\files\jobs\<SHA-256 of Job ID>\<random File ID>.pdf
%LOCALAPPDATA%\JobTrack\data\files\jobs\<SHA-256 of Job ID>\<random File ID>.docx
%LOCALAPPDATA%\JobTrack\data\files\jobs\.operations\<operation ID>.json
```

Original names are metadata, never disk paths. Requests accept no storage path.
Every read/write/delete checks the authenticated owner through Job; downloads
also check the exact job-specific directory and reject symbolic-link escapes.
Client responses omit server paths. Unicode download names use RFC 5987; downloads
are attachments with no-sniff/no-store headers. Upload bodies are bounded before
multipart parsing, then each file's extension, size and PDF/OOXML container are
validated server-side. The declared MIME type is not trusted.

Replacement writes unique bytes before atomically switching database metadata.
Old bytes remain until the transaction commits. A flushed operation journal names
new and old paths before any write; rollback or process-interruption recovery
removes only files that the database did not commit. Pending cleanup is retried
on the next document operation or server start; an upload/delete response reports
deferred cleanup if Windows temporarily locks a file. Database failure never
requires deleting the old attachment. Deleting a job cleans its own document
records/files. The document lock also protects backup snapshots/restores against
concurrent document changes. No scheduler is introduced.

## Legacy files and backups

The old `/dashboard/profile` route is now **Legacy Files**, a read-only listing
with existing downloads, legacy resume views/PDF exports and cover-letter PDF
exports. There is no global creation/editor/selection workflow in the active UI.
Legacy models, files, existing job associations and compatibility APIs remain;
files are not guessed onto jobs or automatically copied into new document slots.

ZIP format **v2** includes JobAttachment rows and their File metadata/bytes. IDs
and paths are rebuilt through the existing restore map, preserving each document's
job and kind. Missing, invalid or multiply-linked job documents reject the restore
instead of producing a committed attachment without bytes. The original confirmed
wipe, pre-import snapshot and rollback flow are reused. Older v1 ZIPs remain
readable, with an empty new attachment group. Version 2 prevents older apps from
silently dropping the new relationship; older builds cannot import v2 backups.
CSV export remains job information only. ZIPs still exclude account credentials
and provider keys; keep full offline copies of the data root for complete recovery.

No npm dependency, framework upgrade, branding/data-root migration, localization,
AI Autofill or Electron lifecycle change is part of Phase 3C.
