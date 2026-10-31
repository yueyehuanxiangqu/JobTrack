"use client";
import { useCallback, useEffect, useState } from "react";
import { DOCUMENT_KINDS, DOCUMENT_LABELS, DocumentKind, JobDocument, documentInputError } from "@/models/jobAttachment.model";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { SelectedDocuments } from "./DocumentInputs";

export default function JobDocuments({ jobId }: { jobId: string }) {
  const [documents, setDocuments] = useState<JobDocument[]>([]);
  const [files, setFiles] = useState<SelectedDocuments>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<DocumentKind | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/documents`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDocuments(result.documents); setError("");
    } catch { setError("Could not load documents. Retry to view them."); }
    finally { setLoading(false); }
  }, [jobId]);
  useEffect(() => { void load(); }, [load]);
  async function change(kind: DocumentKind, remove = false) {
    const file = files[kind];
    if (!remove && (!file || documentInputError(file))) { setError(file ? documentInputError(file)! : "Choose a file first."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      if (file) body.set(kind, file);
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/documents${remove ? `/${kind}` : ""}`, { method: remove ? "DELETE" : "PUT", ...(remove ? {} : { body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDocuments(result.documents); setFiles((current) => ({ ...current, [kind]: undefined }));
      setMessage(result.warning ?? `${DOCUMENT_LABELS[kind]} ${remove ? "deleted" : "saved"}.`);
      setDeleting(null);
    } catch (failure) { setError(`${failure instanceof Error ? failure.message : "Document operation failed."} Retry here; your other documents are unchanged.`); }
    finally { setBusy(false); }
  }
  return <Card>
    <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Optional files used for this application. PDF or DOCX, up to 10 MB each.</p>
      {loading ? <p>Loading documents…</p> : DOCUMENT_KINDS.map((kind) => {
        const current = documents.find((doc) => doc.kind === kind);
        return <div key={kind} className="space-y-2 rounded-md border p-3" data-testid={`document-${kind}`}>
          <h3 className="font-medium">{DOCUMENT_LABELS[kind]}</h3>
          {current && <p className="break-all text-sm">{current.fileName}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {current && <Button asChild variant="outline" size="sm"><a href={`/api/jobs/${encodeURIComponent(jobId)}/documents/${kind}`} download>Download {DOCUMENT_LABELS[kind]}</a></Button>}
            {current && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setDeleting(kind)}>Delete {DOCUMENT_LABELS[kind]}</Button>}
          </div>
          <Input key={`${kind}-${current?.uploadedAt ?? "empty"}`} type="file" aria-label={`${current ? "Replace" : "Upload"} ${DOCUMENT_LABELS[kind]}`} accept=".pdf,.docx" disabled={busy} onChange={(event) => setFiles((value) => ({ ...value, [kind]: event.target.files?.[0] }))} />
          {files[kind] && <p className="break-all text-sm">Selected: {files[kind]!.name}</p>}
          <Button type="button" size="sm" disabled={busy || !files[kind]} onClick={() => void change(kind)}>{current ? "Replace" : "Upload"} {DOCUMENT_LABELS[kind]}</Button>
        </div>;
      })}
      {error && <div role="alert" className="text-sm text-destructive">{error} <Button type="button" variant="link" onClick={() => void load()} disabled={busy}>Reload documents</Button></div>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <DeleteAlertDialog pageTitle={deleting ? DOCUMENT_LABELS[deleting] : "document"} open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }} alertDescription="Only this job's document will be removed. Other jobs and legacy files are unchanged." onDelete={() => { if (deleting && !busy) void change(deleting, true); }} />
    </CardContent>
  </Card>;
}
