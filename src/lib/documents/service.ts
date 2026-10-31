import "server-only";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/db";
import { DocumentKind, JobDocument, DOCUMENT_KINDS } from "@/models/jobAttachment.model";
import { DocumentError, validateDocument } from "./validation";
import { documentPath, safeDocumentPath, recoverDocumentFiles, withDocumentJournal } from "./files";
import { withDocumentLock } from "./lock";

export function documentKind(value: string): DocumentKind {
  if (!(DOCUMENT_KINDS as readonly string[]).includes(value)) throw new DocumentError("Unknown document type.");
  return value as DocumentKind;
}
async function ownedJob(userId: string, jobId: string) {
  if (!await prisma.job.findFirst({ where: { id: jobId, userId }, select: { id: true } })) throw new DocumentError("Job not found.", 404);
}
export async function listDocuments(userId: string, jobId: string): Promise<JobDocument[]> {
  await ownedJob(userId, jobId);
  const rows = await prisma.jobAttachment.findMany({ where: { jobId, Job: { userId } }, include: { File: true } });
  return rows.map((row) => ({ kind: documentKind(row.kind), size: row.size, fileName: row.File.fileName, uploadedAt: row.File.uploadedAt.toISOString() }));
}
export async function putDocuments(userId: string, jobId: string, inputs: { kind: DocumentKind; name: string; bytes: Buffer }[]) {
  if (!inputs.length || inputs.length > 2 || new Set(inputs.map((f) => f.kind)).size !== inputs.length) throw new DocumentError("Choose at most one file of each type.");
  // Verify ownership before reading/writing any stored data, then validate the
  // complete batch so an invalid second file never replaces a valid first slot.
  await ownedJob(userId, jobId);
  const validated = await Promise.all(inputs.map(async (input) => ({ ...input, kind: documentKind(input.kind), ...await validateDocument(input.name, input.bytes), id: randomUUID() })));
  return withDocumentLock(async () => {
    await recoverDocumentFiles();
    await ownedJob(userId, jobId);
    const old = await prisma.jobAttachment.findMany({ where: { jobId, kind: { in: validated.map((f) => f.kind) } }, include: { File: true } });
    const fresh = validated.map((file) => ({ ...file, filePath: documentPath(jobId, file.id, file.extension) }));
    let warning: string | undefined;
    await withDocumentJournal([
      ...old.map((row) => ({ id: row.fileId, jobId, filePath: row.File.filePath })),
      ...fresh.map((file) => ({ id: file.id, jobId, filePath: file.filePath })),
    ], async () => {
      for (const file of fresh) {
        await safeDocumentPath(jobId, file.filePath, true);
        await fs.writeFile(file.filePath, file.bytes, { flag: "wx", flush: true });
      }
      await prisma.$transaction(async (tx) => {
        if (!await tx.job.findFirst({ where: { id: jobId, userId }, select: { id: true } })) throw new DocumentError("Job not found.", 404);
        for (const file of fresh) {
          await tx.file.create({ data: { id: file.id, fileName: file.fileName, filePath: file.filePath, fileType: file.mimeType } });
          await tx.jobAttachment.upsert({
            where: { jobId_kind: { jobId, kind: file.kind } },
            create: { jobId, kind: file.kind, fileId: file.id, size: file.bytes.length },
            update: { fileId: file.id, size: file.bytes.length },
          });
        }
        await tx.file.deleteMany({ where: { id: { in: old.map((row) => row.fileId) } } });
      });
    }, () => { warning = "Documents saved. Old-file cleanup is pending and will retry on the next operation or app start."; });
    return { documents: await listDocuments(userId, jobId), ...(warning ? { warning } : {}) };
  });
}
export async function downloadDocument(userId: string, jobId: string, kind: DocumentKind) {
  return withDocumentLock(async () => {
    const row = await prisma.jobAttachment.findFirst({ where: { jobId, kind, Job: { userId } }, include: { File: true } });
    if (!row) throw new DocumentError("Document not found.", 404);
    try {
      await safeDocumentPath(jobId, row.File.filePath);
      return { fileName: row.File.fileName, mimeType: row.File.fileType, bytes: await fs.readFile(row.File.filePath) };
    } catch { throw new DocumentError("Document file is unavailable. Restore it from a backup or replace it.", 404); }
  });
}
export async function deleteDocument(userId: string, jobId: string, kind: DocumentKind) {
  return withDocumentLock(async () => {
    await recoverDocumentFiles();
    await ownedJob(userId, jobId);
    const row = await prisma.jobAttachment.findFirst({ where: { jobId, kind, Job: { userId } }, include: { File: true } });
    if (!row) throw new DocumentError("Document not found.", 404);
    let warning: string | undefined;
    await withDocumentJournal([{ id: row.fileId, jobId, filePath: row.File.filePath }], async () => {
      await prisma.$transaction(async (tx) => {
        await tx.jobAttachment.delete({ where: { id: row.id, Job: { userId } } });
        await tx.file.delete({ where: { id: row.fileId } });
      });
    }, () => { warning = "Document removed. Disk cleanup is pending and will retry on the next operation or app start."; });
    return { documents: await listDocuments(userId, jobId), ...(warning ? { warning } : {}) };
  });
}
export async function deleteJobWithDocuments(userId: string, jobId: string) {
  return withDocumentLock(async () => {
    await recoverDocumentFiles();
    await ownedJob(userId, jobId);
    const rows = await prisma.jobAttachment.findMany({ where: { jobId, Job: { userId } }, include: { File: true } });
    return withDocumentJournal(rows.map((row) => ({ id: row.fileId, jobId, filePath: row.File.filePath })), async () => {
      return prisma.$transaction(async (tx) => {
        const job = await tx.job.delete({ where: { id: jobId, userId } });
        await tx.file.deleteMany({ where: { id: { in: rows.map((row) => row.fileId) } } });
        return job;
      });
    });
  });
}
