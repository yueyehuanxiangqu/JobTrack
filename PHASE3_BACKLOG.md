# Product direction

Phase 3A removes the retired assistant, automation scheduler, Daily Goals and
other nonessential screens. Shared provider/key infrastructure and archived data
remain. See [cleanup boundaries](PHASE3_CLEANUP.md).

Phase 3B implements username/password accounts and an explicit, password-verified
transition for existing email accounts. See [account migration](USERNAME_MIGRATION.md)
and [validation](PHASE3_VALIDATION.md).

The following work is deferred and is **not implemented** by these changes:

- **Phase 3C:** independent CV and Cover Letter attachments per job, including
  upload/download/replace/delete without selecting a global resume. The current
  shared document library remains until that replacement is implemented.
- **Phase 4:** English, Simplified Chinese and Traditional Chinese; persisted
  language settings and responsive layout improvements for small windows/zoom.
- **Phase 5:** user-initiated AI Autofill from a URL or pasted JD, with configurable
  provider/key/model, structured draft extraction, unknown fields left blank and
  explicit review/save. No automatic applications or scheduled searches.

Application branding, installer names and the existing LocalAppData location have
not been changed. Keep the MIT License and upstream copyright notice.
