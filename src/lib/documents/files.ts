import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import prisma from "@/lib/db";
import { storagePaths } from "@/lib/storagePaths";
import { withDocumentLock } from "./lock";

export type DocumentFile = { id: string; jobId: string; filePath: string };
const folder = (jobId: string) => createHash("sha256").update(jobId).digest("hex");
export function documentPath(jobId: string, fileId: string, extension: string) {
  if (!/^[a-z0-9-]+$/i.test(fileId) || ![".pdf", ".docx"].includes(extension)) throw new Error("Invalid storage identifier");
  return path.join(path.resolve(storagePaths().jobAttachments), folder(jobId), fileId + extension);
}
export function isDocumentPath(jobId: string, filePath: string) {
  const resolved = path.resolve(filePath);
  return path.dirname(resolved) === path.join(path.resolve(storagePaths().jobAttachments), folder(jobId)) &&
    /^[a-z0-9-]+\.(pdf|docx)$/i.test(path.basename(resolved));
}
export async function safeDocumentPath(jobId: string, filePath: string, create = false) {
  if (!isDocumentPath(jobId, filePath)) throw new Error("Unsafe document path");
  const root = path.resolve(storagePaths().jobAttachments);
  if (create) await fs.mkdir(path.dirname(filePath), { recursive: true });
  const actualRoot = await fs.realpath(root);
  const actualDirectory = await fs.realpath(path.dirname(filePath));
  if (actualDirectory !== path.join(actualRoot, folder(jobId))) throw new Error("Document directory cannot be a link");
  try {
    if ((await fs.lstat(filePath)).isSymbolicLink()) throw new Error("Document cannot be a link");
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return filePath;
}

const journalDirectory = () => path.join(storagePaths().jobAttachments, ".operations");
async function finishJournal(journal: string, files: DocumentFile[]) {
  for (const file of files) {
    // Never delete committed bytes, whether this is rollback, commit cleanup or
    // recovery after a process interruption. Decisions come from the database.
    if (await prisma.file.findUnique({ where: { id: file.id }, select: { id: true } })) continue;
    try {
      await safeDocumentPath(file.jobId, file.filePath);
      await fs.unlink(file.filePath);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  await fs.unlink(journal);
}
export async function withDocumentJournal<T>(files: DocumentFile[], work: () => Promise<T>, onDeferred?: () => void): Promise<T> {
  if (!files.length) return work();
  if (!files.every((file) => isDocumentPath(file.jobId, file.filePath))) throw new Error("Unsafe document journal path");
  const directory = journalDirectory();
  await fs.mkdir(directory, { recursive: true });
  const journal = path.join(directory, `${randomUUID()}.json`);
  // Flush the intent before creating any bytes or committing metadata.
  const handle = await fs.open(`${journal}.tmp`, "wx");
  try { await handle.writeFile(JSON.stringify(files)); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(`${journal}.tmp`, journal);
  try { return await work(); }
  finally {
    try { await finishJournal(journal, files); }
    catch { onDeferred?.(); console.warn("[Documents] Cleanup deferred; the next document operation or app start will retry it."); }
  }
}
export async function recoverDocumentFiles() {
  return withDocumentLock(async () => {
    const directory = journalDirectory();
    let names: string[];
    try { names = await fs.readdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    for (const name of names.filter((n) => /^[a-z0-9-]+\.json$/i.test(n))) {
      const journal = path.join(directory, name);
      const entries: unknown = JSON.parse(await fs.readFile(journal, "utf8"));
      if (!Array.isArray(entries) || !entries.every((e) => e && typeof e.id === "string" && typeof e.jobId === "string" && typeof e.filePath === "string" && isDocumentPath(e.jobId, e.filePath))) throw new Error("Invalid document recovery journal");
      await finishJournal(journal, entries);
    }
  });
}
