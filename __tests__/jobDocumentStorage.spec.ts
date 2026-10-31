// @vitest-environment node
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import db from "@/lib/db";
import { APP_CONSTANTS } from "@/lib/constants";
import { seedAccount } from "./helpers/backupTestDb";
import { putDocuments, downloadDocument, deleteDocument, listDocuments, deleteJobWithDocuments } from "@/lib/documents/service";
import { documentPath, recoverDocumentFiles, withDocumentJournal } from "@/lib/documents/files";
import { buildBackupZip } from "@/lib/backup/export";
import { importBackup } from "@/lib/backup/import";
import { GET as getFile, DELETE as deleteFile } from "@/app/api/jobs/[jobId]/documents/[kind]/route";
import { PUT } from "@/app/api/jobs/[jobId]/documents/route";

const ctx = await vi.hoisted(async () => {
  const helpers = await import("./helpers/backupTestDb");
  const value = helpers.makeTestDbUrl(); helpers.deploySchema(value.url); return value;
});
const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) };
});
vi.mock("@/auth", () => ({ auth: async () => session.userId ? { user: { id: session.userId } } : null }));
const originalRoot = APP_CONSTANTS.UPLOADS_DIR;
const root = path.join(ctx.dir, "中文 uploads");
const pdf = Buffer.from("%PDF-1.7\nlocal test document\n%%EOF");
let docx: Buffer;
let owner: string, other: string, compat: string;
let first: string, second: string, foreign: string;
async function job(userId: string, label: string) {
  const Company = await db.company.create({ data: { createdBy: userId, label, value: label } });
  const title = await db.jobTitle.create({ data: { createdBy: userId, label, value: label } });
  const status = await db.jobStatus.findUniqueOrThrow({ where: { value: "applied" } });
  return (await db.job.create({ data: { userId, companyId: Company.id, jobTitleId: title.id, statusId: status.id, description: "Existing job description", jobType: "Full-time", createdAt: new Date(), applied: true, appliedDate: new Date() } })).id;
}
beforeAll(async () => {
  vi.stubEnv("JOBSYNC_LOCAL_RUNTIME", "0");
  (APP_CONSTANTS as { UPLOADS_DIR: string }).UPLOADS_DIR = root;
  owner = await seedAccount(db, "documents@example.test"); other = await seedAccount(db, "other@example.test"); compat = await seedAccount(db, "compat@example.test");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'); zip.file("_rels/.rels", "<Relationships/>");
  docx = await zip.generateAsync({ type: "nodebuffer" });
}, 120_000);
beforeEach(async () => {
  first = await job(owner, `first-${randomUUID()}`); second = await job(owner, `second-${randomUUID()}`); foreign = await job(other, `other-${randomUUID()}`);
  session.userId = owner;
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const row of await db.job.findMany({ select: { id: true, userId: true } })) await deleteJobWithDocuments(row.userId, row.id);
});
afterAll(async () => {
  await db.$disconnect();
  (APP_CONSTANTS as { UPLOADS_DIR: string }).UPLOADS_DIR = originalRoot; vi.unstubAllEnvs();
  if (path.dirname(path.resolve(ctx.dir)) !== path.resolve(os.tmpdir()) || !path.basename(ctx.dir).startsWith("jobsync-backup-")) throw new Error("Unexpected test directory");
  fsSync.rmSync(ctx.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

it("keeps documents optional and accepts both slots without changing the Job ID or fields", async () => {
  const before = await db.job.findUniqueOrThrow({ where: { id: first } });
  expect(await listDocuments(owner, first)).toEqual([]);
  const result = await putDocuments(owner, first, [{ kind: "CV", name: "履歷 #1.pdf", bytes: pdf }, { kind: "COVER_LETTER", name: "求職信.docx", bytes: docx }]);
  expect(result.documents).toHaveLength(2);
  expect(await db.job.findUniqueOrThrow({ where: { id: first } })).toEqual(before);
  expect((await downloadDocument(owner, first, "CV")).bytes).toEqual(pdf);
  expect((await downloadDocument(owner, first, "COVER_LETTER")).bytes).toEqual(docx);
  expect(result.documents[0]).not.toHaveProperty("filePath");
});
it("isolates same-named files on different jobs and deletes/replaces only the chosen slot", async () => {
  for (const id of [first, second]) await putDocuments(owner, id, [{ kind: "CV", name: "same.pdf", bytes: pdf }]);
  const old = await db.jobAttachment.findFirstOrThrow({ where: { jobId: first }, include: { File: true } });
  const unrelated = await db.jobAttachment.findFirstOrThrow({ where: { jobId: second }, include: { File: true } });
  expect(old.File.filePath).not.toBe(unrelated.File.filePath);
  await putDocuments(owner, first, [{ kind: "CV", name: "new.docx", bytes: docx }]);
  await expect(fs.access(old.File.filePath)).rejects.toThrow();
  expect(await db.file.findUnique({ where: { id: old.fileId } })).toBeNull();
  await deleteDocument(owner, first, "CV");
  expect(await listDocuments(owner, first)).toEqual([]);
  expect((await downloadDocument(owner, second, "CV")).bytes).toEqual(pdf);
  expect(await db.jobAttachment.count({ where: { jobId: first } })).toBe(0);
});
it("enforces one file per slot in both the API and database", async () => {
  const input = { kind: "CV" as const, name: "cv.pdf", bytes: pdf };
  await expect(putDocuments(owner, first, [input, input])).rejects.toThrow("at most one");
  await putDocuments(owner, first, [input]);
  const existing = await db.jobAttachment.findFirstOrThrow({ where: { jobId: first } });
  await expect(db.jobAttachment.create({ data: { ...existing, id: randomUUID() } })).rejects.toMatchObject({ code: "P2002" });
});
it.each([
  ["bad.exe", pdf], ["fake.pdf", Buffer.from("not a pdf")], ["fake.docx", Buffer.from("PK\x03\x04not a Word document")], ["empty.pdf", Buffer.alloc(0)], ["oversized.pdf", Buffer.alloc(10 * 1024 * 1024 + 1)],
])("rejects invalid upload %s without changing the old CV", async (name, bytes) => {
  await putDocuments(owner, first, [{ kind: "CV", name: "original.pdf", bytes: pdf }]);
  await expect(putDocuments(owner, first, [{ kind: "CV", name, bytes }])).rejects.toThrow();
  expect((await downloadDocument(owner, first, "CV")).bytes).toEqual(pdf);
  expect(await db.jobAttachment.count({ where: { jobId: first } })).toBe(1);
});
it("rejects a generic ZIP renamed DOCX and validates the entire pair before replacing either", async () => {
  await putDocuments(owner, first, [{ kind: "CV", name: "original.pdf", bytes: pdf }]);
  const zip = new JSZip(); zip.file("readme.txt", "not Word");
  await expect(putDocuments(owner, first, [{ kind: "CV", name: "replacement.pdf", bytes: pdf }, { kind: "COVER_LETTER", name: "fake.docx", bytes: await zip.generateAsync({ type: "nodebuffer" }) }])).rejects.toThrow("DOCX");
  expect((await listDocuments(owner, first))[0].fileName).toBe("original.pdf");
});
it("preserves old bytes and cleans uncommitted bytes on disk or transaction failure", async () => {
  await putDocuments(owner, first, [{ kind: "CV", name: "original.pdf", bytes: pdf }]);
  const before = await db.jobAttachment.findFirstOrThrow({ where: { jobId: first }, include: { File: true } });
  const disk = vi.spyOn(fs, "writeFile").mockRejectedValueOnce(new Error("disk full"));
  await expect(putDocuments(owner, first, [{ kind: "CV", name: "new.docx", bytes: docx }])).rejects.toThrow("disk full"); disk.mockRestore();
  const transaction = vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("commit failed"));
  await expect(putDocuments(owner, first, [{ kind: "CV", name: "new.docx", bytes: docx }])).rejects.toThrow("commit failed"); transaction.mockRestore();
  expect(await db.jobAttachment.findFirstOrThrow({ where: { jobId: first }, include: { File: true } })).toEqual(before);
  expect(await fs.readFile(before.File.filePath)).toEqual(pdf);
  expect(await fs.readdir(path.dirname(before.File.filePath))).toEqual([path.basename(before.File.filePath)]);
});
it("recovers interrupted intents without deleting any committed document", async () => {
  await putDocuments(owner, first, [{ kind: "CV", name: "cv.pdf", bytes: pdf }]);
  const live = await db.jobAttachment.findFirstOrThrow({ where: { jobId: first }, include: { File: true } });
  const id = randomUUID(), orphan = documentPath(first, id, ".pdf"); await fs.writeFile(orphan, pdf);
  const journal = path.join(root, "files/jobs/.operations", `${randomUUID()}.json`);
  await fs.writeFile(journal, JSON.stringify([{ id, jobId: first, filePath: orphan }, { id: live.fileId, jobId: first, filePath: live.File.filePath }]));
  await recoverDocumentFiles();
  await expect(fs.access(orphan)).rejects.toThrow();
  expect(await fs.readFile(live.File.filePath)).toEqual(pdf);
});
it("serializes concurrent replacements and cleans all superseded file rows/bytes", async () => {
  await Promise.all(Array.from({ length: 4 }, (_, index) => putDocuments(owner, first, [{ kind: "CV", name: `cv${index}.pdf`, bytes: pdf }])));
  const live = await db.jobAttachment.findMany({ where: { jobId: first }, include: { File: true } });
  expect(live).toHaveLength(1);
  expect(await fs.readdir(path.dirname(live[0].File.filePath))).toHaveLength(1);
});
it("checks ownership on reads, writes and deletes and refuses forged stored paths", async () => {
  await putDocuments(other, foreign, [{ kind: "CV", name: "private.pdf", bytes: pdf }]);
  await expect(listDocuments(owner, foreign)).rejects.toMatchObject({ status: 404 });
  await expect(putDocuments(owner, foreign, [{ kind: "CV", name: "bad.pdf", bytes: pdf }])).rejects.toMatchObject({ status: 404 });
  await expect(deleteDocument(owner, foreign, "CV")).rejects.toMatchObject({ status: 404 });
  await expect(downloadDocument(owner, foreign, "CV")).rejects.toMatchObject({ status: 404 });
  await putDocuments(owner, first, [{ kind: "CV", name: "cv.pdf", bytes: pdf }]);
  const own = await db.jobAttachment.findFirstOrThrow({ where: { jobId: first }, include: { File: true } });
  const privateFile = await db.jobAttachment.findFirstOrThrow({ where: { jobId: foreign }, include: { File: true } });
  await db.file.update({ where: { id: own.fileId }, data: { filePath: privateFile.File.filePath } });
  await expect(downloadDocument(owner, first, "CV")).rejects.toMatchObject({ status: 404 });
  await db.file.update({ where: { id: own.fileId }, data: { filePath: own.File.filePath } });
});
it("serves safe original Unicode filenames and rejects unauthenticated and oversized HTTP uploads", async () => {
  const body = new FormData(); body.set("CV", new File([new Uint8Array(pdf)], "履歷 #1.pdf", { type: "application/octet-stream" }));
  const context = { params: Promise.resolve({ jobId: first }) };
  expect((await PUT(new Request("http://localhost/documents", { method: "PUT", body }), context)).status).toBe(200);
  const response = await getFile(new Request("http://localhost/document"), { params: Promise.resolve({ jobId: first, kind: "CV" }) });
  expect(response.headers.get("content-disposition")).toContain(encodeURIComponent("履歷 #1.pdf"));
  expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
  expect((await PUT(new Request("http://localhost/documents", { method: "PUT", headers: { "content-length": "99999999" }, body: "x" }), context)).status).toBe(413);
  session.userId = other;
  expect((await deleteFile(new Request("http://localhost/document", { method: "DELETE" }), { params: Promise.resolve({ jobId: first, kind: "CV" }) })).status).toBe(404);
  session.userId = "";
  expect((await getFile(new Request("http://localhost/document"), { params: Promise.resolve({ jobId: first, kind: "CV" }) })).status).toBe(401);
});
it("backs up/restores both slots and legacy files, rolls back safely on missing or invalid bytes, and reads v1", async () => {
  await putDocuments(owner, first, [{ kind: "CV", name: "简历.pdf", bytes: pdf }, { kind: "COVER_LETTER", name: "letter.docx", bytes: docx }]);
  await putDocuments(owner, second, [{ kind: "CV", name: "简历.pdf", bytes: pdf }]);
  await putDocuments(other, foreign, [{ kind: "CV", name: "other.pdf", bytes: pdf }]);
  await fs.mkdir(path.join(root, "files/resumes"), { recursive: true });
  const legacyPath = path.join(root, "files/resumes/legacy.pdf"); await fs.writeFile(legacyPath, pdf);
  const profile = await db.profile.create({ data: { userId: owner } });
  const legacyFile = await db.file.create({ data: { fileName: "legacy.pdf", filePath: legacyPath, fileType: "application/pdf" } });
  await db.resume.create({ data: { title: "Legacy CV", profileId: profile.id, FileId: legacyFile.id } });
  const { buffer } = await buildBackupZip(owner, "documents@example.test");
  const zip = await JSZip.loadAsync(buffer), data = JSON.parse(await zip.file("data.json")!.async("string"));
  expect(JSON.parse(await zip.file("manifest.json")!.async("string")).formatVersion).toBe(2);
  expect(data.JobAttachment).toHaveLength(3);
  const ambiguous = await JSZip.loadAsync(buffer);
  const aliasedData = JSON.parse(JSON.stringify(data));
  const oldCompanyId = aliasedData.Company[0].id;
  aliasedData.Company[0].id = aliasedData.Job[0].id;
  for (const row of aliasedData.Job) if (row.companyId === oldCompanyId) row.companyId = aliasedData.Company[0].id;
  ambiguous.file("data.json", JSON.stringify(aliasedData));
  await expect(importBackup(await ambiguous.generateAsync({ type: "nodebuffer" }), owner, "documents@example.test", true)).rejects.toThrow("ambiguous record identifiers");
  const broken = await JSZip.loadAsync(buffer); broken.remove(Object.keys(broken.files).find((name) => name.startsWith(`files/${data.JobAttachment[0].fileId}/`) && !broken.files[name].dir)!);
  await expect(importBackup(await broken.generateAsync({ type: "nodebuffer" }), owner, "documents@example.test", true)).rejects.toThrow("missing a job document");
  expect((await downloadDocument(owner, first, "CV")).bytes).toEqual(pdf);
  const corrupt = await JSZip.loadAsync(buffer); const entry = Object.keys(corrupt.files).find((name) => name.startsWith(`files/${data.JobAttachment[0].fileId}/`) && !corrupt.files[name].dir)!; corrupt.file(entry, "invalid");
  await expect(importBackup(await corrupt.generateAsync({ type: "nodebuffer" }), owner, "documents@example.test", true)).rejects.toThrow("invalid job document");
  const restored = await importBackup(buffer, owner, "documents@example.test", true);
  expect(restored.filesWritten).toBe(4);
  for (const attachment of await db.jobAttachment.findMany({ where: { Job: { userId: owner } } })) {
    expect((await downloadDocument(owner, attachment.jobId, attachment.kind as "CV" | "COVER_LETTER")).bytes).toEqual(attachment.kind === "CV" ? pdf : docx);
  }
  expect((await downloadDocument(other, foreign, "CV")).bytes).toEqual(pdf);
  const legacy = await db.resume.findFirstOrThrow({ where: { profile: { userId: owner } }, include: { File: true } });
  expect(await fs.readFile(legacy.File!.filePath)).toEqual(pdf);
  // Reuse the existing pre-import snapshot as the rollback path.
  expect(restored.snapshotPath).toBeTruthy();
  await importBackup(await fs.readFile(restored.snapshotPath!), owner, "documents@example.test", true);
  expect(await db.jobAttachment.count({ where: { Job: { userId: owner } } })).toBe(3);
  // A v1 file from before per-job attachments remains readable as legacy data.
  const v1 = await JSZip.loadAsync(buffer); const manifest = JSON.parse(await v1.file("manifest.json")!.async("string")); manifest.formatVersion = 1; delete manifest.counts.JobAttachment;
  const attachmentIds = new Set(data.JobAttachment.map((row: { fileId: string }) => row.fileId)); data.File = data.File.filter((row: { id: string }) => !attachmentIds.has(row.id)); delete data.JobAttachment;
  v1.file("manifest.json", JSON.stringify(manifest)); v1.file("data.json", JSON.stringify(data));
  await importBackup(await v1.generateAsync({ type: "nodebuffer" }), compat, "compat@example.test", false);
  expect(await db.jobAttachment.count({ where: { Job: { userId: compat } } })).toBe(0);
  expect(await db.resume.count({ where: { profile: { userId: compat } } })).toBe(1);
}, 120_000);
