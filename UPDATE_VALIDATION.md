# JobTrack 0.1.1 update verification

This revision adds user-controlled Windows NSIS updates without upgrading
Next.js, Prisma, Electron or electron-builder. The root version and lockfile
are 0.1.1; current README/Windows instructions match. Older reports retain
their original tested versions. The only added direct dependency is pinned
`electron-updater` 6.8.12, a desktop build dependency staged as a production
dependency of the separate Electron app. Its exact runtime dependency closure
is included in ASAR; it is not added to the Next.js backend dependencies.

## Behavior and boundaries

- Settings and Support expose check/download/cancel/restart-install actions.
  Mounting the UI does not check or download; there is no new polling loop.
- Differential download is enabled. Normal exit does not install a waiting
  update; native restart confirmation defaults to Cancel. The owned backend
  stops and its instance record is removed before `quitAndInstall` is called.
- Only stable versions are offered, with downgrades disabled. Download hashes
  and the SDK's default signature behavior are retained; no verification is
  disabled. The current installer remains unsigned.
- The preload has no general IPC, filesystem, command or feed-setting method.
  Main process handlers accept no parameters and require the exact main
  renderer frame at `http://127.0.0.1:3737`. Errors/status are sanitized.
- Feed configuration is fixed to the JobTrack GitHub repository. No GitHub
  credential is embedded or borrowed from an AI provider.
- Before 0.1.1, a one-time manual upgrade is needed to receive the updater.
  Future public Releases need the matching EXE, blockmap and `latest.yml`.
  Source Push alone does not publish those assets.

## Passed checks

- 12 desktop Node tests: existing security/brand/installer cases, updater
  manual policy, cancellation, retry, safe errors, IPC authorization and
  sandbox preload surface/subscription cleanup.
- 13 local runtime Node tests: initialization, paths, migration protection,
  shutdown and separate native/Docker outputs.
- 10 targeted Vitest tests: App Updates UI and version behavior.
- TypeScript, ESLint, Next.js production build and Windows NSIS build.
- Packaged payload audit: 23,953 filesystem files plus updater ASAR resource
  and feed/dependency checks. No credentials/user data/test artifacts were
  found; the original MIT license and exact seven-frame ICO were retained.
- Five packaged Electron UI/lifecycle groups using a dedicated test home:
  real preload/IPC and renderer isolation, no automatic requests, no-release
  and offline errors, manual download/progress/cancel/retry, downloaded state,
  native confirmation cancellation, and owned-backend shutdown before install.
  The actual installer call was replaced by a test double; it did not execute.
  There were zero renderer errors.
- Real electron-updater/NSIS SDK with an owned loopback update feed, actual
  0.1.0/0.1.1 installers and blockmaps, and an isolated cache. The SDK made
  **16 HTTP range requests**, transferring **2,026,968 bytes** to reconstruct
  the exact **260,386,981-byte** new installer. There were **zero full-installer
  downloads**. Independent SHA-256 comparison matched the build. This local
  result is not a guaranteed size reduction for future releases.
- A separate intentionally wrong SHA-512 fixture was rejected by the real
  SDK before installation. No real update installer or uninstaller was run.
- Formal `%LOCALAPPDATA%\JobTrack` and migration recovery backup file-path/
  SHA-256 inventories match before and after all isolated verification. The
  old JobSync source backup and existing installed application are untouched.
  All test apps, owned backend processes and loopback feed servers were closed.

No full Vitest rerun was needed: this change touches the desktop update
boundary and a new settings component, with direct tests, real SDK transfer,
packaged UI/lifecycle checks and a production build. Business tables, job
mutation/attachment logic and historical database migrations are unchanged.

## Publication limits

Unauthenticated GitHub requests to the repository and Releases endpoints both
returned **404**. Credentialed Git fetch succeeds, but public repository/release
availability cannot be confirmed. The GitHub connector also returned 404.
Repository visibility was not changed. A public download source must be
available before ordinary clients can receive online updates. No live GitHub
Release-to-installed-app upgrade is claimed; actual installer execution and
Windows reboot were not repeated in this revision.

README and Windows instructions now explain this distinction. AI Autofill
documentation was also corrected to describe the already implemented concise
summary, source-quoted optional salary and scoped-JD extraction.

## Local package

- File: `dist-desktop/JobTrack-Setup-0.1.1.exe`
- Size: **260,386,981 bytes** (248.32 MiB).
- SHA-256: `a8ee3184548a9d5f740e56a4f3ecb0b1f85273adb923c9ceab876ff4d00c853b`.
- Matching `.exe.blockmap`, `.exe.sha256` and `latest.yml` are generated.
  All binaries, test caches and private fixture records remain Git-ignored.
- The build uses `--publish never`. No Release or installer asset is uploaded
  by the source push. See [UPDATES.md](UPDATES.md) for future release steps.
