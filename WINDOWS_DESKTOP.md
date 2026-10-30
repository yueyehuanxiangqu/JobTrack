# JobSync Windows desktop

This phase adds an Electron desktop shell to the existing Next.js application.
It preserves all business screens, authentication, AI providers, automations,
data models and migration history. MIT License and upstream copyright remain.

## Install and use

1. Run `JobSync-Setup-1.1.22.exe` on Windows 11 x64. It installs for the current
   account and creates desktop and Start menu shortcuts. No Node.js, npm,
   Prisma, Docker, external browser or Windows service is needed.
2. Open **JobSync**. A small startup window remains visible while the local
   database is checked/migrated. The main window appears after an authenticated
   health check and the first page has rendered.
3. Minimize to keep working in the background. Open the shortcut again to restore
   and focus the same window. There is no system tray or minimize-to-tray mode.
4. Use **X** to exit. The app stops its owned service before completing exit.
   Daily use does not require either CMD launcher.

The installer is unsigned. Windows may identify its publisher as unknown or show
a SmartScreen reputation prompt. Code signing is a future distribution step;
it is not required to build or run the local installation. No Windows security
settings are changed by this project.

The installer uses current-user mode (normally `%LOCALAPPDATA%\Programs\JobSync`),
without elevation or service registration. Updates are manual: close the app,
then install the new installer. Automatic updates are not configured.

## Data and upgrades

The Phase 1 root and formats remain unchanged:

```text
%LOCALAPPDATA%\JobSync\
  config\runtime.json           original stable authentication/encryption keys
  config\instance.json          private identity of the currently owned backend
  config\electron\              Electron cookies/cache/preferences
  data\jobsync.db
  data\files\resumes\
  data\backups\
  logs\desktop-<timestamp>.log
  logs\desktop-migrations.log
```

Installer resources are separate from these files. First start creates missing
configuration but never regenerates existing keys or truncates an existing
database. Schema initialization/upgrades run `prisma migrate deploy` against the
unchanged migration history; `db push` and reset are not used.

Uninstallation defaults to preserving data and keys. Reinstalling uses them
again. Keep `config/runtime.json` with full offline backups; the in-app ZIP backup
does not include credentials or encryption keys. See WINDOWS_LOCAL.md for backup
boundaries and safe filesystem copying after stopping the app.

The CMD and desktop modes use the same root and port. Close one before starting
the other. Electron refuses to adopt/kill a pre-existing service on port 3737.
If another application occupies the port, an error identifies the conflict and
no process belonging to that application is stopped.

`JOBSYNC_HOME` is an absolute test override. Leave it unset in ordinary use.

## Runtime and lifecycle

- The packaged main process uses shared Phase 1 helpers for paths, keys,
  environment, instance locking, control messages and health checks.
- A bundled, checksum-verified official Node.js 24.22.1 executable launches the
  shared server script. It binds only to `127.0.0.1:3737`.
- Electron and Node maintain a private IPC channel. Window close sends an
  authenticated stop request and waits for the exact owned ChildProcess. If the
  GUI crashes, IPC disconnect also makes the backend shut itself down.
  A hard OS termination may leave a stale instance.json; it does not represent
  a running service and is replaced safely on the next successful startup.
- Active migrations are allowed to finish before shutdown; normal HTTP requests
  have a 60-second grace period. A final timeout can terminate only the owned
  child handle. The application never kills node.exe by name or a stored arbitrary PID.
- The native and desktop startup locks serialize initialization. Electron also
  uses its built-in single-instance lock, scoped to the selected user-data home.
- Startup errors are shown in the local startup window with a log path. A failed
  startup stops the service it created. Error windows can be closed normally.

The frontend receives no preload bridge. Context isolation and Chromium sandbox
are enabled; Node integration, workers' Node integration and webviews are disabled.
Permissions are denied except sanitized clipboard writes from the application's
own window/origin, preserving existing Copy buttons without clipboard-read access.
Only the application's exact loopback origin
is loaded in its main window; HTTP(S)/mailto links open through the system browser,
while privileged/malformed URLs are blocked. Redirects to remote content are blocked.
API keys and database access remain in the local server.

Packaged Electron fuses disable RunAsNode and NODE_OPTIONS environment injection
and require the application code to load from its ASAR. The separate backend
Node executable has no Electron or frontend privileges.

Downloads use a normal Windows save dialog. Browser authentication and business
forms are unchanged. Logging currently has no automatic rotation.

## Build from source

Maintainers need Windows x64, Node.js 24 LTS, npm and internet access for the
first Electron, Node.js and NSIS downloads. End users do not need these tools.

```powershell
npm ci
npm run desktop:build
```

The installer is written to `dist-desktop\JobSync-Setup-1.1.22.exe`, alongside
`dist-desktop\win-unpacked\JobSync.exe` for packaged-directory testing.
`npm run desktop:pack` produces only the packaged directory. `desktop:start`
is a developer convenience after staging and is not an end-user requirement.

The build uses `.next-desktop` with Next's standalone output. `.next-local` stays
exclusive to Phase 1, and the original `.next/standalone` Docker mode remains.
The staging script copies public/static files, migration history, Prisma Client,
Windows query/schema engines, and the installed production dependency closures.
Generic electron-builder copies skip a root node_modules, so it has an explicit
resource mapping. An after-pack check refuses an incomplete backend/runtime.
The native engines are outside ASAR; they run under bundled Node rather than
Electron, so no Electron ABI rebuild of Prisma is needed.

The application ASAR contains only desktop code and shared helpers. The web
runtime lives under `resources/web`, and official Node plus its license under
`resources/runtime`. Developer `.env` files and user databases are not packaged.
The original vector logo supplies the 256px Windows icon.

Packaging deliberately retains runtime dependency closures for reliable
offline execution, so this distribution is larger than a browser-only frontend.
Type declarations, source maps and dependency test/example directories are excluded;
runtime code and dependency licenses remain. No business feature is removed.

Developer-only `node scripts/desktop/build.mjs --reuse-next` reuses a previously
verified production web build while restaging and repackaging desktop changes.
Use the full build after web/configuration changes.

## Tests and future work

See PHASE2_VALIDATION.md for actual results and limitations. Test helpers under
scripts/desktop refuse formal user-data directories. They can inspect installed
Electron through Playwright without changing the application's renderer privileges.

Phase 3 product directions are recorded in PHASE3_BACKLOG.md. They are not
implemented by this desktop-only phase.
