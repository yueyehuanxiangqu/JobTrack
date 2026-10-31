# JobTrack

A lightweight, open-source desktop application for tracking and managing job applications.

JobTrack helps individual job seekers organize applications, interviews, tasks, and job-search activity in a local Windows desktop app. It focuses on a simple workflow for keeping track of your own search.

## Features

- **Job application tracking** — Keep application details in one place.
- **Application status management** — Update statuses and review each application's timeline.
- **Activity Calendar** — View daily application counts and time spent on recorded activities.
- **Interview management** — Keep interview rounds and schedules linked to applications.
- **Tasks and Activities** — Organize to-dos and record time spent on your job search.
- **Local data storage** — Store records and uploaded files on your computer.
- **Backup and export** — Create and restore ZIP backups, and export applications to CSV.

## Getting Started

No GitHub Release is available yet. To try the desktop app:

1. On Windows 11 x64, follow the [Windows desktop guide](WINDOWS_DESKTOP.md#build-from-source) to build the installer.
2. Run the generated installer, then open **JobSync** from the desktop or Start menu shortcut.
3. Create a local account with a username and password. Existing email accounts can use the [one-time username setup](USERNAME_MIGRATION.md).

The installed app includes its runtime; daily use does not require Docker, a separate Node.js installation, or an external browser. Data is stored under `%LOCALAPPDATA%\JobSync\`.

See the [Windows desktop guide](WINDOWS_DESKTOP.md) for installation, data storage, and development instructions.

## Project Status

JobTrack is under active development, with a focus on simplifying its interface and feature set. The desktop app and installer still use the JobSync name.

## Acknowledgements

JobTrack is based on the open-source [JobSync](https://github.com/Gsync/jobsync) project by [gsync](https://github.com/Gsync).

JobTrack is distributed under the [MIT License](LICENSE), retaining the original `Copyright (c) 2024 gsync` notice.
