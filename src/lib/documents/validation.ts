import "server-only";
import path from "node:path";
import JSZip from "jszip";
import { preflightZip } from "@/lib/files/formats";
import { MAX_DOCUMENT_BYTES } from "@/models/jobAttachment.model";

export class DocumentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function validateDocument(name: string, bytes: Buffer) {
  const fileName = path.win32.basename(path.posix.basename(name));
  if (!fileName || fileName.length > 255 || /[\x00-\x1f\x7f]/.test(fileName)) throw new DocumentError("Invalid file name (maximum 255 characters).");
  const extension = path.extname(fileName).toLowerCase();
  if (![".pdf", ".docx"].includes(extension)) throw new DocumentError("Choose a PDF or DOCX file.");
  if (!bytes.length) throw new DocumentError("The file is empty.");
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new DocumentError("Each file must be 10 MB or smaller.", 413);
  if (extension === ".pdf") {
    if (!/^%PDF-\d\.\d/.test(bytes.subarray(0, 8).toString("ascii")) || !bytes.subarray(-1024).includes(Buffer.from("%%EOF"))) {
      throw new DocumentError("The file is not a valid PDF.");
    }
    return { fileName, extension, mimeType: "application/pdf" };
  }
  try {
    const header = preflightZip(bytes);
    if (header.entries > 2048 || header.uncompressedBytes > 50 * 1024 * 1024) throw new Error("ZIP limit");
    const zip = await JSZip.loadAsync(bytes);
    // Check the OOXML container, without parsing or analyzing resume contents.
    if (!zip.file("[Content_Types].xml") || !zip.file("word/document.xml") || !zip.file("_rels/.rels")) throw new Error("Not OOXML Word");
  } catch { throw new DocumentError("The file is not a valid DOCX document."); }
  return { fileName, extension, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
}
