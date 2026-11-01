"use client";
import { useEffect, useState } from "react";
import { getUserSettings } from "@/actions/userSettings.actions";
import { getUserApiKeys, saveApiKey, deleteApiKey } from "@/actions/apiKey.actions";
import { saveAutofillConfiguration } from "@/actions/jobAutofill.actions";
import { AI_PROVIDERS, PROVIDER_REGISTRY, type AiProviderId } from "@/lib/ai/provider-registry";
import { autofillConfigSchema, type AutofillConfig } from "@/models/jobAutofill.schema";
import type { ApiKeyClientResponse } from "@/models/apiKey.model";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export default function AiSettings() {
  const [config, setConfig] = useState<AutofillConfig>({ provider: "openai", model: "", baseUrl: "" });
  const [profiles, setProfiles] = useState<Partial<Record<AiProviderId, { model?: string; baseUrl?: string }>>>({});
  const [keys, setKeys] = useState<ApiKeyClientResponse[]>([]), [key, setKey] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([getUserSettings(), getUserApiKeys()]).then(([settings, stored]) => {
      if (!active) return;
      if (!settings?.success || !stored.success) throw new Error();
      const ai = settings.data?.settings?.ai;
      const provider: AiProviderId = AI_PROVIDERS.includes(ai?.provider) ? ai.provider : "openai";
      const baseUrl = ai?.baseUrl ?? (provider === "ollama" ? stored.data?.find(k => k.provider === "ollama")?.displayValue : "") ?? "";
      setConfig({ provider, model: ai?.model ?? "", baseUrl }); setProfiles(ai?.profiles ?? {}); setKeys(stored.data ?? []);
    }).catch(() => { if (active) setError("Unable to load AI Settings. Reopen this page to try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const entry = PROVIDER_REGISTRY[config.provider], storedKey = keys.find(k => k.provider === config.provider);
  function selectProvider(provider: AiProviderId) {
    setProfiles(old => ({ ...old, [config.provider]: { model: config.model, baseUrl: config.baseUrl } }));
    setConfig({ provider, model: profiles[provider]?.model ?? "", baseUrl: profiles[provider]?.baseUrl ?? "" });
    setKey(""); setMessage(""); setError("");
  }
  function validConfig() {
    if (!autofillConfigSchema.safeParse(config).success || config.provider === "custom" && !config.baseUrl) {
      setError("Enter a Model and a valid HTTP(S) Base URL (required for Custom)."); return false;
    } return true;
  }
  async function save() {
    setError(""); setMessage(""); if (!validConfig()) return; setBusy(true);
    try {
      if (key.trim() && entry.credentialType === "api-key") {
        const result = await saveApiKey({ provider: config.provider, key: key.trim(), sensitive: true });
        if (!result.success || !result.data) throw new Error();
        setKeys(old => [...old.filter(k => k.provider !== config.provider), result.data!]); setKey("");
      }
      const result = await saveAutofillConfiguration(config);
      if (!result?.success) throw new Error();
      setMessage("AI Settings saved.");
    } catch { setError("Could not save AI Settings. Check the configuration and try again."); } finally { setBusy(false); }
  }
  async function removeKey() {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!(await deleteApiKey(config.provider)).success) throw new Error();
      setKeys(old => old.filter(k => k.provider !== config.provider)); setKey(""); setMessage("Stored API Key deleted.");
    } catch { setError("Could not delete the API Key."); } finally { setBusy(false); }
  }
  async function test() {
    setError(""); setMessage(""); if (!validConfig()) return; setBusy(true);
    try {
      const response = await fetch("/api/ai/test-connection", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, ...(key.trim() ? { key: key.trim() } : {}) }), signal: AbortSignal.timeout(25_000) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Connection failed."); return; }
      setMessage("Connection successful. The selected model is callable.");
    } catch { setError("Connection failed or timed out. Check Model and Base URL."); } finally { setBusy(false); }
  }
  if (loading) return <p>Loading AI Settings...</p>;
  return <section className="min-w-0 max-w-xl space-y-4">
    <div><h3 className="text-lg font-medium">AI Settings</h3><p className="text-sm text-muted-foreground">Configure the provider used by Add Job autofill. Model names are entered manually.</p></div>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <div className="space-y-2"><Label htmlFor="ai-provider">Provider</Label>
        <Select value={config.provider} onValueChange={selectProvider}><SelectTrigger id="ai-provider" aria-label="Select AI provider"><SelectValue /></SelectTrigger>
          <SelectContent>{AI_PROVIDERS.map(id => <SelectItem value={id} key={id}>{PROVIDER_REGISTRY[id].displayName}</SelectItem>)}</SelectContent></Select>
      </div>
      {entry.credentialType === "api-key" && <div className="space-y-2"><Label htmlFor="autofill-api-key">API Key</Label>
        <Input id="autofill-api-key" type="password" value={key} autoComplete="off" onChange={e => setKey(e.target.value)} placeholder={storedKey ? "Leave blank to keep the stored key" : "Enter API Key"} />
        <p className="text-sm text-muted-foreground">{storedKey ? `Stored key: ••••${storedKey.last4}` : "No stored key for this provider. A configured environment key can also be used."}</p>
        {storedKey && <Button variant="outline" type="button" onClick={removeKey}>Delete API Key</Button>}
      </div>}
      <div className="space-y-2"><Label htmlFor="autofill-model">Model</Label><Input id="autofill-model" value={config.model} onChange={e => setConfig({ ...config, model: e.target.value })} placeholder="Enter the model name from your provider" /></div>
      <div className="space-y-2"><Label htmlFor="autofill-base-url">Base URL</Label><Input id="autofill-base-url" value={config.baseUrl} onChange={e => setConfig({ ...config, baseUrl: e.target.value })} placeholder={entry.defaultBaseUrl ?? "https://your-provider.example/v1"} />
        <p className="text-sm text-muted-foreground">{config.provider === "custom" ? "OpenAI Chat Completions-compatible endpoint root, usually ending in /v1." : "Leave blank to use the standard endpoint. Ollama uses its server root, without /api."}</p>
      </div>
      <div className="flex flex-wrap gap-2"><Button type="button" onClick={save}>Save AI Settings</Button><Button type="button" variant="outline" onClick={test}>Test Connection</Button></div>
    </fieldset>
    <p className="text-xs text-muted-foreground">Test Connection uses the current fields and a small request. Save settings to use them for Autofill. Testing may use a small number of tokens.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
