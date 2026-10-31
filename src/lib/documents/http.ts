import { NextResponse } from "next/server";
import { DocumentError } from "./validation";
import { documentKind } from "./service";
import { MAX_DOCUMENT_BYTES } from "@/models/jobAttachment.model";

export function documentFailure(error: unknown) {
  return NextResponse.json({ error: error instanceof DocumentError ? error.message : "Document operation failed. Existing files were kept; retry or reopen the job's Documents section." }, { status: error instanceof DocumentError ? error.status : 500 });
}
export async function documentForm(request: Request) {
  const limit = 2 * MAX_DOCUMENT_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new DocumentError("Upload is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DocumentError("Choose a file.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new DocumentError("Upload is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new DocumentError("Invalid file upload."); }
  const inputs = [];
  for (const [key, file] of form.entries()) {
    const kind = documentKind(key);
    if (!(file instanceof File)) throw new DocumentError("Choose a PDF or DOCX file.");
    if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentError("Each file must be 10 MB or smaller.", 413);
    inputs.push({ kind, name: file.name, bytes: Buffer.from(await file.arrayBuffer()) });
  }
  return inputs;
}
export function fileDownload(file: { fileName: string; mimeType: string; bytes: Buffer }) {
  const encoded = encodeURIComponent(file.fileName).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return new NextResponse(new Uint8Array(file.bytes), { headers: {
    "Content-Type": file.mimeType,
    "Content-Disposition": `attachment; filename="document${file.fileName.toLowerCase().endsWith(".docx") ? ".docx" : ".pdf"}"; filename*=UTF-8''${encoded}`,
    "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
  } });
}
