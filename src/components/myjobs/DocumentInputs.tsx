"use client";
import { DOCUMENT_KINDS, DOCUMENT_LABELS, DocumentKind, documentInputError, JobDocument } from "@/models/jobAttachment.model";
import { Input } from "../ui/input";

export type SelectedDocuments = Partial<Record<DocumentKind, File>>;
export function DocumentInputs({ files, onChange, disabled, existing = [] }: {
  files: SelectedDocuments; onChange: (files: SelectedDocuments) => void; disabled?: boolean; existing?: JobDocument[];
}) {
  return <fieldset className="space-y-3 md:col-span-2" disabled={disabled}>
    <legend className="mb-2 font-medium">Documents (optional)</legend>
    <p className="text-sm text-muted-foreground">One CV and one Cover Letter per job. PDF or DOCX, up to 10 MB each. Files upload when you save.</p>
    <div className="grid gap-4 md:grid-cols-2">{DOCUMENT_KINDS.map((kind) => {
      const file = files[kind];
      const current = existing.find((doc) => doc.kind === kind);
      return <label key={kind} className="space-y-2 text-sm">
        <span className="block font-medium">{DOCUMENT_LABELS[kind]}</span>
        {current && <span className="block break-all">Current: {current.fileName}</span>}
        <Input type="file" aria-label={DOCUMENT_LABELS[kind]} accept=".pdf,.docx" onChange={(event) => onChange({ ...files, [kind]: event.target.files?.[0] })} />
        {file && <span className="block break-all">Selected: {file.name}</span>}
        {file && documentInputError(file) && <span className="block text-destructive" role="alert">{documentInputError(file)}</span>}
      </label>;
    })}</div>
  </fieldset>;
}
