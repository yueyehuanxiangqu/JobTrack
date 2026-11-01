import JSZip from "jszip";
import { PDF_MAGIC, ZIP_MAGIC, sniffFileType, preflightZip } from "@/lib/files/formats";

describe("shared file container checks", () => {
  it("recognizes PDF and DOCX signatures without parsing their text", () => {
    expect(sniffFileType(Buffer.concat([PDF_MAGIC, Buffer.from("-1.7")]))).toBe("pdf");
    expect(sniffFileType(ZIP_MAGIC)).toBe("docx");
  });
  it.each([Buffer.alloc(0), Buffer.from([0x25, 0x50]), Buffer.from([0x25, 0x50, 0x44, 0x00])])("rejects incomplete and unrelated signatures", bytes => {
    expect(sniffFileType(bytes)).toBeNull();
  });
  it("counts uncompressed sizes before any ZIP content is inflated", async () => {
    const zip = new JSZip();
    zip.file("one.txt", "a".repeat(100)); zip.file("two.txt", "b".repeat(230));
    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    expect(preflightZip(bytes)).toEqual({ entries: 2, uncompressedBytes: 330 });
  });
  it("rejects a truncated archive", () => {
    expect(() => preflightZip(Buffer.from("PK\x03\x04incomplete"))).toThrow("Not a valid ZIP archive");
  });
});
