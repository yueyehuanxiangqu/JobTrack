# Local runtime for development and diagnostics

For the installable Electron application, see [Windows desktop](WINDOWS_DESKTOP.md).
Daily use is through the Electron application. The former root CMD wrappers have
been retired. The shared Node runtime and optional npm CLI commands below remain
available for development and diagnostics. Desktop and CLI modes share the same
database/configuration root and should be used one at a time.

The current root is `%LOCALAPPDATA%\JobTrack`. See [Data migration](DATA_MIGRATION.md)
for the one-time transition from JobSync, verified offline backup and cleanup.

The native runtime retains Dashboard, Activity Calendar, jobs and interview
timeline, document files, tasks, activities, CSV/PDF export and ZIP backup/restore.
Retired assistant, automation and MCP runtime features have been removed in
Phase 3. It does not require Docker,
WSL, a Windows service, or an external database. The inherited Docker, Jenkins
and server deployment scripts were retired in Phase 4. The optional local npm
CLI is retained for development and diagnostics, and supplies shared runtime
code used by Electron.

## Optional browser-mode setup

1. Install the official Windows **Node.js 24 LTS**, including npm. Node.js 22.12+
   LTS is also accepted. No global npm packages or administrator rights are needed.
2. From the project directory, run `npm run local:setup`.
3. Allow the first installation, Prisma generation, existing migrations and production
   build to finish. First setup needs internet access and can take several minutes.
4. Run `npm run local:start`. The browser opens http://127.0.0.1:3737. Create a local account with
   a username and password. Existing email accounts use the
   [one-time username setup](USERNAME_MIGRATION.md); their original data stays linked.

Use a local writable checkout, not a network share or a read-only installation
directory. Keep this checkout in place while the app is running.

## Optional browser-mode control

- Start: `npm run local:start`.
- Stop: `npm run local:stop`. It waits for requests and Next.js to close.
- Closing the browser leaves the hidden Node.js process running. Windows shutdown
  stops it; next time, run `npm run local:start` again. There is no automatic login startup.
- Repeated starts reuse the authenticated existing instance and open the browser.
- Another program on port 3737 is reported as a conflict and is never stopped.
- Commands report failures and log locations in the terminal. Output uses ASCII
  for compatibility with Windows console code pages; file paths and UI support Unicode.

The runtime binds to IPv4 loopback **127.0.0.1:3737** only. Open that exact address
for consistent login cookies. The launcher sets the detected local IANA time zone
before Next loads any checkout `.env` file. It does not change Windows settings.

## Persistent local files

```text
%LOCALAPPDATA%\JobTrack\
  config\runtime.json           stable authentication and encryption keys
  config\instance.json          current instance identity and private control token
  data\jobsync.db               SQLite database
  data\files\resumes\           uploaded/generated resume attachments
  data\files\jobs\              independent per-job CV/Cover Letter files
  data\backups\<user-id>\        pre-import ZIP recovery snapshots
  logs\initialization.log       dependency, Prisma and build output
  logs\server-<timestamp>.log    server output
```

On this computer the normal root resolves to `C:\Users\yueye\AppData\Local\JobTrack`.
No native database is stored in the source tree. The launcher generates keys only
once and refuses to replace a damaged existing configuration. **Keep runtime.json
when moving/restoring the entire installation**: losing its encryption key makes
previously saved provider keys unreadable. Do not publish this file or instance.json.

The existing in-app ZIP backup includes business data and resume files; it does
not include passwords, provider API keys or runtime secrets. It remains the preferred
way to transfer business data, including from Docker to the native runtime. Native
mode does not automatically open or modify a Docker database or move its files.
New exports use ZIP format v2 for job documents. Current versions also restore v1
backups; older builds cannot read v2. See [job document storage](JOB_ATTACHMENTS.md).
For a complete offline filesystem copy, stop JobTrack first and copy the entire
local root, including config and all SQLite sidecar files if present. Do not copy a
live database file by itself.

Logs are retained for diagnosis, without automatic rotation in this phase. Old log
files can be archived manually after stopping the app; keep databases and config.

## Updates and maintenance

Stop the app before updating this checkout. On the next start the launcher checks
the lockfile, Prisma schema, source/assets and build configuration. Dependencies
are installed only when missing/changed, and production output is built only when
missing/changed. The existing `prisma migrate deploy` runs on each start and is a
no-op when no migrations are pending. It never uses `db push`, reset, or a seed
that replaces existing data. Registration still seeds the original account defaults.

Native output is `.next-local`; Docker output remains `.next/standalone`. Never
run a native rebuild while a native server from this checkout is running. The
launcher rejects setup/rebuild when its own native instance is running.

Optional commands, run from the project directory:

```powershell
npm run local:setup
npm run local:start
npm run local:status
npm run local:stop
node scripts/local/cli.mjs setup --rebuild
npm run test:local-runtime
```

For automated verification only, set **JOBTRACK_HOME** to an absolute isolated test
directory, and add `--no-browser` to `start`. The same override must be present for
start, status and stop. Production users should leave JOBTRACK_HOME unset.

## Process ownership and troubleshooting

The launcher serializes concurrent initialization using a Windows named pipe,
which is released automatically when its owner exits. The background server has
a separate control pipe authenticated with a random per-launch token and instance
ID. Stop requests are sent to this server, never to an arbitrary stored PID or all
node.exe processes. A private health check verifies the same identity and reads the
SQLite User table before the browser opens. It does not bypass application login.

If the identity file is stale and the recorded process has exited, the next start
discards only that identity file. If the recorded PID exists but identity cannot be
verified, the launcher refuses to stop/replace anything. Inspect the stated server
log and restart Windows if necessary. Do not delete data to resolve a port conflict.

During shutdown, existing HTTP requests have up to 60 seconds to close. A grace
timeout is logged as a failure; only the authenticated JobTrack server itself exits.
Finish uploads and backup/restore operations before stopping. Normal SQLite
transaction recovery still applies after crashes or power loss.

## Activity Calendar finding (unchanged)

`src/actions/dashboard/charts.ts:getActivityCalendarData` reads the authenticated
user's real SQLite records for the last 365 days. It counts jobs with `applied=true`
by applied date, and sums stored activity duration by start date into hours.
`ActivityCalendar.tsx` consumes this data; it does not import mock data. Its color
value is the application count and its tooltip also displays activity hours.
The Nivo contribution-style heatmap, date range and empty-account behavior have
not been redesigned in this runtime-only phase.

## Verification

See [Phase 1 validation](PHASE1_VALIDATION.md) for the checks actually executed,
their results and any remaining limitations. MIT License and original copyright
remain in LICENSE.
