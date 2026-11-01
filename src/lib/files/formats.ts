// Shared server-side file container checks. No document text parsing.

// Magic bytes for file-type sniffing (Buffer — server-only, not in constants.ts)
export const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
export const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK local file header

export function sniffFileType(buf: Buffer): "pdf" | "docx" | null {
  if (buf.subarray(0, 4).equals(PDF_MAGIC)) return "pdf";
  if (buf.subarray(0, 4).equals(ZIP_MAGIC)) return "docx";
  return null;
}

// Parse ZIP Central Directory to sum uncompressed sizes and count entries
export function preflightZip(buf: Buffer): { entries: number; uncompressedBytes: number } {
  const EOCD_SIG = 0x06054b50;
  const CD_SIG = 0x02014b50;

  let eocdOffset = -1;
  const searchStart = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Not a valid ZIP archive");

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (cdOffset >= buf.length) throw new Error("Not a valid ZIP archive");

  let offset = cdOffset;
  let uncompressedBytes = 0;
  let entries = 0;

  while (entries < totalEntries && offset + 46 <= buf.length) {
    if (buf.readUInt32LE(offset) !== CD_SIG) break;
    uncompressedBytes += buf.readUInt32LE(offset + 24);
    const filenameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    entries++;
    offset += 46 + filenameLen + extraLen + commentLen;
  }

  return { entries, uncompressedBytes };
}
