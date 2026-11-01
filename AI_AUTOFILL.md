# AI Autofill

AI Autofill fills an Add Job draft from a recruitment URL or pasted job
description. It does not create an application until you click **Save**. It does
not read CVs/Cover Letters, match applicants, search for jobs or submit applications.

## Configure a provider

Open **Settings → AI Settings**. Select a provider, enter its model name and
save the configuration. Model names are entered manually; the app does not
substitute a hardcoded model. Cloud providers need an API key, unless one is
already configured in the runtime environment.

| Provider | Protocol | Default Base URL |
| --- | --- | --- |
| OpenAI | OpenAI Chat Completions | `https://api.openai.com/v1` |
| Google Gemini | Native Gemini generateContent | `https://generativelanguage.googleapis.com/v1beta` |
| DeepSeek | Existing DeepSeek SDK | `https://api.deepseek.com` |
| OpenRouter | OpenAI Chat Completions-compatible | `https://openrouter.ai/api/v1` |
| Ollama | Native Ollama chat | `http://127.0.0.1:11434` |
| Custom / OpenAI-compatible API | OpenAI Chat Completions-compatible | User supplied |

Leave Base URL blank to use the standard endpoint, except for Custom, which
requires it. Use the endpoint root (usually ending in `/v1` for compatible
services); Ollama uses its server root without `/api`. User-configured local
endpoints are supported. URLs cannot contain credentials, query strings or
fragments. A native Anthropic integration is not added in this phase; an
OpenAI-compatible gateway is a separate protocol, not an Anthropic Base URL.

**Test Connection** uses the current fields, including an unsaved key if supplied,
with one small model request (at most 32 output tokens). Save the settings before
using Autofill. Failed tests report safe errors for credentials/permissions,
missing models, rate limits, rejected requests or timeouts. Test requests may use
a small number of tokens on a real provider.

Keys are password-masked. An empty key input keeps the stored key. New/updated
cloud keys use the existing per-user/per-provider AES-256-GCM storage and stable
runtime encryption secret. The client receives only key metadata and the final
four characters, never a decrypted stored key. **Delete API Key** deletes only
the selected provider's database key; it does not delete environment variables.
Older plaintext cloud records are not automatically rewritten; saving a key
again uses encryption. Model/endpoint profiles use the existing UserSettings
JSON record; no database migration is needed.

## Import and review

1. Open **New Job → Import Job Details**.
2. Enter a public recruitment URL, or choose **Paste JD** and paste its text.
3. Click **AI Autofill**. The JD is sent to the configured AI endpoint. No local
   attachments or resume profile content are included.
4. Review the fields and make corrections. Existing entries are preserved unless
   **Allow replacement of fields I have already filled in** is enabled. Untouched
   form defaults may be replaced; unknown type/mode fields become empty.
5. Complete required fields such as Source or an unknown Location/Job Type.
   Click the existing **Save** button when ready.

The extracted JSON contains only:

```json
{
  "company": null,
  "jobTitle": null,
  "location": null,
  "workplaceType": null,
  "jobType": null,
  "jobUrl": null
}
```

Workplace Type is `REMOTE`, `HYBRID` or `ONSITE`; Job Type is `FT`, `PT` or `C`,
matching the existing form. Unsupported types such as Internship remain unknown
rather than creating new enums. Missing fields become null. Wrong types, invalid
enums or extra fields are rejected by a strict server-side Zod schema.

For URL imports the program supplies the exact original input URL; it ignores
AI-invented links. Pasted imports do not invent a URL. The original extracted or
pasted JD is escaped and placed in the existing editor without asking AI to
rewrite it. AI-generated company/title/location names that are not already in
the dropdowns remain visible in-memory draft options. They are resolved through
the existing owner-scoped lookup actions only when Save is clicked. Canceling
Autofill does not create those records. Original manual Create-option behavior
is retained for user-initiated lookup creation.

## Retrieval and limits

The backend checks JSON-LD JobPosting data before readable main/article/body
text. HTML is parsed without executing scripts or loading subresources. No
browser automation, cookies, authentication bypass or scraping retries are used.

Recruitment requests permit only public HTTP(S) destinations on ports 80/443.
All DNS results are checked, the connection is pinned to a validated IP, and each
redirect is revalidated. Local/private/reserved addresses and HTTPS-to-HTTP
redirects are rejected. Requests have a 10-second deadline, at most 3 redirects
and a 1 MB response limit; unsupported/non-text/compressed responses are rejected.
Job websites receive neither AI keys nor browser cookies.

Restricted, JavaScript-only or unreadable pages use this fallback:

> Unable to retrieve the job description. Please paste the job description manually.

JD input is limited to 40,000 characters. Extraction is one JSON-mode SDK call,
validated against the strict application schema, with a 30-second deadline,
1,000 output-token budget and no automatic retries. Connection tests have a
20-second deadline. Provider responses and request bodies are size-bounded;
provider redirects are disallowed. Concurrent AI requests from the same user are
rejected until the active request completes. Errors do not clear the form.

Recruitment text is untrusted data, separated from system instructions. There
are no tools, follow-up web actions or attachment reads in the model call.
AI output can still be inaccurate: review it before Save. The selected model
and endpoint must support JSON output; not every compatible service/model does.
Live paid providers and access to particular job boards are not guaranteed by
mock-based testing.

## Verification

- TypeScript and ESLint pass. The targeted suite covers 14 files / 209 tests.
- The full Vitest suite was run **once**: **175 files / 2,032 tests passed**.
- One production build and a test-only unpacked Electron build pass. No NSIS
  installer, Release, installation or reinstallation is performed.
- All six SDK protocols are exercised with mocked HTTP. Tests cover URL parsing,
  DNS/IP/redirect/size/abort defenses, JSON-LD/text extraction, missing/null and
  malformed output, key isolation/encryption, UI drafts, manual preservation,
  explicit overwrite, attachment retries and Jobs reload callbacks.
- Actual Electron uses an isolated home under `.local-runtime-test/Phase5 autofill`
  and an owned loopback mock API, without paid keys. It verifies Custom and Gemini
  configuration/protocols, encrypted keys, blocked local recruitment URLs, paste
  autofill, zero pre-Save records, manual corrections, both PDF/DOCX attachment
  slots and byte-identical downloads, automatic Jobs refresh, real calendar
  counts, invalid-JSON recovery and provider-scoped key deletion. Electron
  sandbox/context isolation remain enabled and Node integration remains disabled.
- Two initial harness failures were fixed in the harness only: polling before a
  settings row existed and the existing `Select Job Status` accessible name.
  No full tests or production builds were repeated for these harness fixes.

The opt-in harness is `scripts/local/verify-ai-autofill.mjs`. Set `JOBTRACK_HOME`
to a disposable directory inside this checkout's `.local-runtime-test`, and
`JOBTRACK_ELECTRON_EXE` to the current unpacked executable. Reports/screenshots
stay ignored in that home's `verification/` directory. Never use personal data
or a real paid API key for this harness.

## Implementation and dependencies

Server code is in `src/lib/job-autofill/`, the two authenticated API routes
`/api/jobs/autofill` and `/api/ai/test-connection`, and the validated configuration
save action. Provider factories and encrypted key actions are reused. The UI
extends existing AI Settings/Add Job/Combobox components, makes the type radios
controlled, and synchronizes external form changes into Tiptap. Existing Jobs
refresh, attachment logic, database schema, all migrations, Electron security,
MIT License and upstream copyright are retained.

Only two direct dependencies are added: `parse5@7.3.0` (already present through
development tooling, now explicit at runtime) and `ipaddr.js@2.2.0` for IP-range
validation. The lockfile adds only ipaddr.js; retained package versions do not
change. No AI SDK, framework or database major version is upgraded.

Protocol references: [OpenAI JSON output guidance](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat),
[AI SDK structured output](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text),
[OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai),
[Google provider](https://ai-sdk.dev/providers/ai-sdk-providers/google).
Implementation is checked against the installed AI SDK 6 types; the current
online SDK documentation may describe a later major version.

## Changed file inventory

- `AI_AUTOFILL.md`
- `README.md`
- `__tests__/AddJob.spec.tsx`
- `__tests__/AiSettings.spec.tsx`
- `__tests__/autofillKeyStorage.spec.ts`
- `__tests__/jobAutofillHttp.spec.ts`
- `__tests__/jobAutofillSchema.spec.ts`
- `__tests__/jobAutofillService.spec.ts`
- `__tests__/jobDescriptionExtraction.spec.ts`
- `__tests__/provider-registry.spec.ts`
- `__tests__/publicJobUrl.spec.ts`
- `package-lock.json`
- `package.json`
- `scripts/local/verify-ai-autofill.mjs`
- `scripts/local/verify-responsive.mjs`
- `src/actions/apiKey.actions.ts`
- `src/actions/jobAutofill.actions.ts`
- `src/app/api/ai/test-connection/route.ts`
- `src/app/api/jobs/autofill/route.ts`
- `src/components/ComboBox.tsx`
- `src/components/TiptapEditor.tsx`
- `src/components/myjobs/AddJob.tsx`
- `src/components/myjobs/JobAutofill.tsx`
- `src/components/settings/AiSettings.tsx`
- `src/components/settings/ApiKeySettings.tsx`
- `src/components/settings/SettingsSidebar.tsx`
- `src/lib/ai/provider-registry.server.ts`
- `src/lib/ai/provider-registry.ts`
- `src/lib/ai/providers.ts`
- `src/lib/job-autofill/http.ts`
- `src/lib/job-autofill/job-description.ts`
- `src/lib/job-autofill/public-page.ts`
- `src/lib/job-autofill/service.ts`
- `src/models/ai.model.ts`
- `src/models/apiKey.model.ts`
- `src/models/apiKey.schema.ts`
- `src/models/jobAutofill.schema.ts`
- `src/models/userSettings.model.ts`
