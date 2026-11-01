# Username authentication

Normal registration and sign-in now use **Username + Password**. No email or
mail service is required. Accounts and their records remain local to this app.

## New accounts

Choose a username of 3–32 ASCII characters. Letters, digits, periods, underscores
and hyphens are accepted; the first character must be a letter or digit. Leading
and trailing spaces are removed, and usernames are stored in lowercase. For
example, ` Alice.Test ` and `alice.test` identify the same account. A database
unique index with SQLite `NOCASE` collation also prevents case-only duplicates.

New passwords require at least six characters and at most 72 UTF-8 bytes, matching
the existing bcrypt storage limit. Passwords are hashed; neither the hash nor
runtime keys are returned to the browser. There is no email password-reset service.

## Existing email accounts

1. Start the updated app. The launcher applies the new migration automatically;
   do not reinitialize or reset the database.
2. On the sign-in page, select **Have an existing email account? Set your username**.
3. Enter the original account email, its current password and your chosen username.
4. After successful verification, the app signs in to the same account. Use the
   new username and the original password for subsequent sign-ins.

This transition is allowed once per account. An occupied username or incorrect
password leaves the account unchanged. No new user is created: the original ID,
password hash, email, default resume and all related records remain in place.
Passwords supported by the old login remain usable during and after migration.
An already signed-in legacy user can also use **Set username** in the user menu.

Keep the original email spelling used at registration for this one-time check.
The normal sign-in form does not accept email as a replacement for username.

## Database and backup compatibility

Migration `20261031110000_username_authentication` follows the 44 unchanged
historical migrations. It copies the User table atomically, retaining all original
columns and values, makes `email` nullable and adds nullable unique `username`.
Legacy usernames remain null until their owners verify their credentials.
No business tables, attachments, encryption keys or archived feature data are
deleted. Prisma `migrate deploy` is used; `db push` and reset are not used.

New-account emails are SQL NULL, never invented addresses or usernames stored in
an email column. Authentication and data ownership continue to use the user ID.

ZIP backups retain format version 1. Their manifest may now include
`sourceUsername`; old email-only manifests remain readable. Identity previews use
the username when both accounts have one, otherwise the original nonempty email.
Backup restore does not replace the current account or migrate its credentials.
The confirmation before replacing application data remains required.

Before upgrading your own installation, close it and keep an offline copy of
`%LOCALAPPDATA%\JobTrack\`, including `config/runtime.json`, database and files.
The in-app ZIP export excludes account credentials and runtime keys. See
[Windows local storage](WINDOWS_LOCAL.md) for the existing backup boundaries.

The app and installer still use the JobTrack name and existing data directory.
These changes do not introduce per-job attachments or new AI functionality.
