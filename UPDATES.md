# Windows updates

From **0.1.1**, open **Settings → App Updates**, or the update section of
**Support**. Checking does not download anything. Choose **Download update**
to see progress; **Cancel download** leaves the current installation intact.
After download verification, **Restart and install** asks for native confirmation.
Save open forms first. The owned Next.js/Node service is stopped before the
NSIS updater starts, and the app reopens after installation. Closing normally
does not install a waiting update. No polling or automatic downloads are added.

Updates use the public Windows releases in
[`yueyehuanxiangqu/JobTrack`](https://github.com/yueyehuanxiangqu/JobTrack/releases).
Version 0.1.2 is published with its matching installer, block map and update metadata.
No GitHub token is embedded or needed for a public release source.
The renderer cannot supply an update URL, file path, command or feed. Its
sandboxed preload exposes only update status/check/download/cancel/install;
main-frame and exact-origin checks protect those IPC calls. Existing key,
database and attachment storage are not exposed to the updater UI.

The NSIS updater prefers differential downloads using block maps and HTTP
range requests. Missing old maps/cache, server limitations or changed package
layout can require a full download. Small source edits do not guarantee a
small download. Downloaded bytes are checked against release metadata; the
current unsigned distribution does not establish a code-signed publisher.
The standard updater cache is separate from user data, normally under
`%LOCALAPPDATA%\jobtrack-desktop-updater`. Accounts, stable keys, SQLite files,
CVs and Cover Letters remain under `%LOCALAPPDATA%\JobTrack`.

## First upgrade and release availability

Versions **before 0.1.1 have no updater**, so install 0.1.1 or later manually
once. Close JobTrack and run its new installer over the old installation.
Do not uninstall or remove the data directory to update.

Pushing source code alone does not publish an app update. The public
[0.1.2 release](https://github.com/yueyehuanxiangqu/JobTrack/releases/tag/v0.1.2)
contains the required Windows update assets. Future versions need the same
release process after building and reviewing their artifacts.

## Preparing a future release

1. Give every changed tester/distribution build a new version. Update
   `package.json`, both root versions in `package-lock.json`, and current user
   documentation together. Never replace a published version with different
   installer bytes. Historical validation reports retain their original versions.
2. Run the relevant checks and `npm run desktop:build` on Windows x64. Core
   frameworks and the selected multi-size icon do not need changing to release.
3. After review, publish a stable GitHub Release with a matching tag (for
   example `v0.1.2`) and these generated files from the **same build**:
   - `JobTrack-Setup-0.1.2.exe`
   - `JobTrack-Setup-0.1.2.exe.blockmap`
   - `latest.yml`
   - optionally the matching `.exe.sha256` checksum for manual verification.
4. Keep older release assets available for differential updates. Do not edit
   generated hashes or reuse a tag for a different build. Only stable releases
   are offered; downgrades and prereleases are disabled.

`desktop:build` always uses `--publish never`, so building and pushing do not
upload an installer or create a release. Full installers remain available for
first installation and manual recovery. No update operation is intended to
remove the user's data directory or migration recovery backups.
