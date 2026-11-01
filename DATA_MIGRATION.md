# JobTrack native data migration (Phase 6B)

The default Windows data root is now `%LOCALAPPDATA%\JobTrack`. `JOBTRACK_HOME` is an absolute test override; setting it prevents any automatic inspection or migration of the real user home. The old `JOBSYNC_HOME` environment variable is no longer used.

## One-time migration

On first native desktop/CLI start, if `%LOCALAPPDATA%\JobSync` exists:

1. Refuse migration while the old app/service is active or port 3737 is occupied. No process is killed. A named-pipe mutex also excludes the old launcher and concurrent migrations.
2. Refuse an unrelated existing JobTrack destination. Never merge or overwrite two independent databases.
3. Inventory every old file and directory, rejecting links/junctions. Copy to `%LOCALAPPDATA%\JobTrack-Migration-Backups\<id>\snapshot`, and verify sizes and SHA-256 checksums. The backup includes the SQLite database/sidecars, configuration keys, attachments, backups, logs and Electron profile.
4. Copy that verified snapshot to an owned staging directory. Verify the copy before changing anything.
5. Check SQLite integrity/foreign keys, preserve authentication/password hashes and all business values, authenticate encrypted API Key records using the existing stable encryption key, and check all referenced attachment files. Only `File.filePath` values under the old home are rebased to the new home. Pending attachment-recovery journals are rebased too. Unknown external paths or missing attachments stop promotion.
6. Atomically promote the stage to JobTrack, then start the app there. No ongoing fallback writes to JobSync are performed. `data/jobsync.db` intentionally keeps its internal filename; this does not imply use of the old root and avoids unnecessary SQLite sidecar renaming.

The original directory remains until actual account/application verification is complete. This is a temporary safety checkpoint, not a second active data root.

After checking the migrated account login, records and documents, close the application and use:

```powershell
node scripts/local/migrate-home.mjs verify
node scripts/local/migrate-home.mjs finalize --confirm-user-validation
```

The final command requires explicit confirmation that user-level validation has been completed. It rechecks shutdown, backup checksums, destination identity, stable keys, SQLite, attachment references and encrypted records. It then deletes **only** the exact `%LOCALAPPDATA%\JobSync` user-data directory. The separate `F:\Programming\Applications\jobsync` source backup is never a migration or deletion target.

An incomplete/unverified migration must not be finalized. Keep the old root and report the pending validation instead.

## Failure and recovery

- A journal at `%LOCALAPPDATA%\.jobtrack-home-migration.json` records copying, promotion, deletion and completion. It contains paths/state, never plaintext keys or passwords.
- Interrupted copying can be retried. A crash immediately after directory promotion is recognized by the migration ID in `JobTrack\config\home-migration.json`.
- Backup corruption, changed original files or changed stable keys prevent cleanup. A partial deletion can be retried only when every remaining entry matches the verified backup. Unknown new files stop cleanup.
- Do not manually remove the journal, stage or backup to bypass a conflict. Preserve both datasets for manual review.
- The verified full backup is retained outside the old root after cleanup. To recover, stop all JobTrack/JobSync processes, verify its manifest, and restore into an **empty** directory. Never copy it over a live database. It contains private data and credentials, so keep it private. In-app ZIP backups remain compatible but do not include account credentials or `config/runtime.json`.
- Historical Prisma migrations, database business fields, password algorithms, encryption formats and the legacy decryption salt are unchanged. Native startup still runs official `prisma migrate deploy`.

## Branding and packaging

The selected icon is A — J-Track. `branding/brand.json` owns the desktop identity and home directory name. `branding/jobtrack.ico` retains its seven 16–256px frames, including tuned 16/32px artwork. Desktop staging copies that file intact; `branding/jobtrack-256.png` is used by Electron. The web logo and favicon use the same approved artwork.

The AppUserModelID is `io.github.yueyehuanxiangqu.jobtrack`, and future desktop/Start menu shortcuts and NSIS outputs use JobTrack. Phase 6A/6B does not produce or install a new NSIS installer. Existing installed JobSync shortcuts/installations remain old until a later explicitly authorized installer upgrade; do not use the old executable after migration because it can recreate its old home.
