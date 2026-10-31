export const DOCUMENT_KINDS = ["CV", "COVER_LETTER"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_LABELS: Record<DocumentKind, string> = { CV: "CV", COVER_LETTER: "Cover Letter" };
export interface JobDocument {
  kind: DocumentKind;
  fileName: string;
  size: number;
  uploadedAt: string;
}
export function documentInputError(file: File): string | null {
  if (!/\.(pdf|docx)$/i.test(file.name)) return "Choose a PDF or DOCX file.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Each file must be 10 MB or smaller.";
  return null;
}
