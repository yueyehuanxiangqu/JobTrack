"use client";
import { useEffect, useRef, useState } from "react";
import { type AutofillResult, MAX_JD_CHARS, extractedJobSchema } from "@/models/jobAutofill.schema";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
export function JobAutofill({ onApply, disabled }: { onApply: (result: AutofillResult, overwrite: boolean) => void; disabled?: boolean }) {
  const [source, setSource] = useState<"url" | "text">("url");
  const [url, setUrl] = useState(""), [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function autofill() {
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/jobs/autofill", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source === "url" ? { source, url } : { source, text }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]) });
      const data = await response.json(); if (controller.signal.aborted) return;
      if (!response.ok) { setError(data.error ?? "AI Autofill failed. Your form has not been changed."); return; }
      const fields = extractedJobSchema.parse(data.fields);
      onApply({ fields }, overwrite);
      setMessage("Autofill complete. Existing entries were kept unless replacement was allowed. Review every field, then click Save.");
    } catch { if (!controller.signal.aborted) setError("AI Autofill failed or timed out. Your form has not been changed; try again or enter details manually."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="min-w-0 space-y-3 rounded-md border p-3" aria-label="Import Job Details">
    <h3 className="font-medium">Import Job Details</h3>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Job import source">
      <Button size="sm" type="button" variant={source === "url" ? "secondary" : "outline"} disabled={busy || disabled} onClick={() => setSource("url")}>Recruitment URL</Button>
      <Button size="sm" type="button" variant={source === "text" ? "secondary" : "outline"} disabled={busy || disabled} onClick={() => setSource("text")}>Paste JD</Button>
    </div>
    {source === "url" ? <div className="space-y-2"><Label htmlFor="autofill-job-url">Recruitment URL</Label><Input id="autofill-job-url" type="url" value={url} disabled={busy || disabled} onChange={e => setUrl(e.target.value)} /></div> :
      <div className="space-y-2"><Label htmlFor="autofill-jd">Job description to import</Label><Textarea id="autofill-jd" value={text} rows={5} maxLength={MAX_JD_CHARS} disabled={busy || disabled} onChange={e => setText(e.target.value)} /></div>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={overwrite} disabled={busy || disabled} onChange={e => setOverwrite(e.target.checked)} />Allow replacement of fields I have already filled in</label>
    <p className="text-xs text-muted-foreground">This JD will be sent to the AI provider configured in Settings. No CV or Cover Letter is sent. Autofill never saves a job.</p>
    <Button type="button" onClick={autofill} disabled={busy || disabled || (source === "url" ? !url.trim() : text.trim().length < 20)}>{busy ? "Extracting..." : "AI Autofill"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
