# JobTrack

A lightweight, open-source desktop application for tracking and managing job applications.

JobTrack helps individual job seekers organize applications, interviews, and tasks in a local Windows desktop app. It focuses on a simple workflow for keeping track of your own search.

## Features

- **Job application tracking** — Keep application details in one place.
- **AI Autofill** — Import a public recruitment URL or pasted JD into a draft with basic details, concise summary bullets and salary when explicitly stated. Review and edit before saving. See [AI Autofill](AI_AUTOFILL.md) for provider setup.
- **Application status management** — Update statuses and review each application's timeline.
- **Activity Calendar** — View daily application counts with fixed integer color bands.
- **Interview management** — Keep interview rounds and schedules linked to applications.
- **Tasks** — Organize to-dos, categories, priorities and due dates.
- **Local data storage** — Store records and uploaded files on your computer.
- **Job documents** — Keep one optional CV and one optional Cover Letter per application, with PDF/DOCX upload, download, replacement and deletion. Older library documents remain accessible under Legacy Files.
- **Backup and export** — Create and restore ZIP backups, and export applications to CSV.
- **In-app updates** — Check for a new Windows release, choose when to download it, then restart to install. Differential downloads are used when available.

## Getting Started

The current Windows test version is **0.1.2**. No publicly downloadable Windows release is currently available. To try the desktop app:

1. On Windows 11 x64, follow the [Windows desktop guide](WINDOWS_DESKTOP.md#build-from-source) to build the installer.
2. Run the generated installer, then open **JobTrack** from the desktop or Start menu shortcut.
3. Create a local account with a username and password. Existing email accounts can use the [one-time username setup](USERNAME_MIGRATION.md).

The installed app includes its runtime; daily use does not require Docker, a separate Node.js installation, or an external browser. Data is stored under `%LOCALAPPDATA%\JobTrack\`.

See the [Windows desktop guide](WINDOWS_DESKTOP.md) for installation, data storage, and development instructions.

From version 0.1.1, open **Settings → App Updates** (also available in **Support**) to check, download and install published updates. Older versions need a one-time manual installation of 0.1.1 or later. Until a Windows release with update files is published, there is no online update to download. See [Updates](UPDATES.md).

Upgrading from a JobSync desktop build? See the [local data migration guide](DATA_MIGRATION.md) before removing old data or using an older executable.

## Project Status

JobTrack is under active development, with a focus on simplifying its interface and feature set. The desktop application uses the JobTrack name and icon.

## Acknowledgements

JobTrack is based on the open-source [JobSync](https://github.com/Gsync/jobsync) project by [gsync](https://github.com/Gsync).

JobTrack is distributed under the [MIT License](LICENSE), retaining the original `Copyright (c) 2024 gsync` notice.
