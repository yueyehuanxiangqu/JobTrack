# Recorded product direction — not implemented in Phase 2

Keep Dashboard/statistics, the contribution-style Activity Calendar, Jobs/statuses,
Interviews, Tasks, Activities, backup/restore and exports.

Later, inspect dependencies before retiring Daily Goals, Automations/discovery,
the AI chat/review/matching/cover-letter features, Questions, Company Watchlist,
independent Contacts, structured Resume Builder, Add Skill, Salary Range and unused
MCP entrypoints/background execution. Do not blindly drop shared database tables.

Planned changes:

- Username/password registration and login without requiring email; preserve
  secure password hashing, user isolation and compatibility with existing users.
- Independent per-job CV and Cover Letter attachments: PDF/DOCX, upload, filename,
  download, replace and delete; no requirement to select a global resume.
- English, Simplified Chinese and Traditional Chinese; default English and a
  persisted Settings language choice.
- Responsive layouts from 800x600 to 1920x1080 and 80–200% zoom, without clipping,
  overlapping controls, cramped forms or horizontal overflow.
- Keep AI Autofill as the core AI feature: URL or pasted JD, configurable Provider,
  Base URL, API Key and Model, structured draft extraction, unknowns blank, fallback
  to pasted text, human review and explicit save. No automatic applications/search.

Preserve reusable provider/model/key infrastructure until this work is undertaken.
None of these business changes is authorized as part of the Phase 2 implementation.
