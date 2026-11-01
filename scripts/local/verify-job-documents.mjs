// Opt-in Phase 3C verification. Never invoked by the daily launcher.
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { _electron, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import React from "react";
import { renderToBuffer, Document, Page, Text } from "@react-pdf/renderer";
import { localPaths, databaseUrl, origin } from "./paths.mjs";
import { projectRoot } from "./project.mjs";

const paths = localPaths();
if (!paths.home.startsWith(path.join(projectRoot, ".local-runtime-test") + path.sep)) throw new Error("Use an isolated JOBTRACK_HOME inside .local-runtime-test.");
if (!process.env.JOBTRACK_ELECTRON_EXE) throw new Error("Set JOBTRACK_ELECTRON_EXE to an unpacked desktop application.");
const artifacts = path.join(paths.home, "verification"); await fs.mkdir(artifacts, { recursive: true });
const report = [], errors = [];
const pass = (step) => { report.push({ step, passed: true }); console.log(`PASS ${step}`); };
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl(paths.database) } } });
const checkpointPath = path.join(artifacts, "documents-checkpoint.json");
const restartOnly = process.argv.includes("--restart-only");
const checkpoint = (process.argv.includes("--resume") || restartOnly) ? JSON.parse(await fs.readFile(checkpointPath, "utf8")) : null;
const suffix = checkpoint?.suffix ?? randomUUID().slice(0, 8), username = `docs-${suffix}`, password = `Docs-fixture-${suffix}`;
let app, page;
async function open() {
  const env = { ...process.env, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await _electron.launch({ executablePath: process.env.JOBTRACK_ELECTRON_EXE, env, timeout: 120_000 });
  await expect.poll(() => {
    page = app.windows().find((window) => window.url().startsWith(origin)); return !!page;
  }, { timeout: 120_000 }).toBe(true);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForLoadState("load");
  await app.evaluate(({ session }, directory) => {
    globalThis.documentDownloads = [];
    globalThis.documentDownloadRun = Date.now().toString(36);
    session.defaultSession.on("will-download", (_event, item) => {
      const record = { name: item.getFilename(), file: directory + "/" + globalThis.documentDownloadRun + "-" + globalThis.documentDownloads.length + "-" + item.getFilename(), state: "pending" };
      globalThis.documentDownloads.push(record); item.setSavePath(record.file);
      item.once("done", (_event, state) => { record.state = state; });
    });
  }, artifacts);
}
async function close() {
  if (!app) return;
  const current = app; app = null;
  const closed = current.waitForEvent("close");
  await current.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.close())).catch(() => {});
  await closed;
}
async function pick(label, placeholder, text) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByPlaceholder(placeholder).fill(text);
  await page.getByText(`Create: ${text}`).click();
  await expect(page.getByPlaceholder(placeholder)).toBeHidden();
}
async function download(kind, name, bytes) {
  const count = await app.evaluate(() => globalThis.documentDownloads.length);
  await page.getByRole("link", { name: `Download ${kind}`, exact: true }).click();
  await expect.poll(() => app.evaluate((_, index) => globalThis.documentDownloads[index]?.state, count), { timeout: 30_000 }).toBe("completed");
  const result = await app.evaluate((_, index) => globalThis.documentDownloads[index], count);
  expect(result.name).toBe(name); expect(await fs.readFile(result.file)).toEqual(bytes);
}
try {
  await open();
  let owner, pdf, docx, cv, letter, both, cvOnly, bothTitle, cvTitle, letterTitle, restoredCv;
  if (restartOnly) {
    owner = await prisma.user.findUniqueOrThrow({ where: { username } });
    pdf = Buffer.from(checkpoint.pdf, "base64");
    cv = { name: "履歷 #1.pdf", mimeType: "application/pdf", buffer: pdf };
    restoredCv = await prisma.job.findUniqueOrThrow({ where: { id: checkpoint.restoredCvId } });
    report.push(...checkpoint.passed);
  } else {
  if (checkpoint) {
    owner = await prisma.user.findUniqueOrThrow({ where: { username } });
    pdf = Buffer.from(checkpoint.pdf, "base64"); docx = Buffer.from(checkpoint.docx, "base64");
    cv = { name: "履歷 #1.pdf", mimeType: "application/pdf", buffer: pdf };
    letter = { name: "求職信.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docx };
    bothTitle = `Both ${suffix}`; cvTitle = `CV only ${suffix}`;
    both = await prisma.job.findUniqueOrThrow({ where: { id: checkpoint.bothId } });
    cvOnly = await prisma.job.findUniqueOrThrow({ where: { id: checkpoint.cvOnlyId } });
    report.push(...checkpoint.passed);
    await page.goto(`${origin}/dashboard/myjobs/${both.id}`);
    if (page.url().includes("/signin")) {
      await page.getByLabel("Username", { exact: true }).fill(username); await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Login", exact: true }).click(); await expect(page).toHaveURL(`${origin}/dashboard`);
      await page.goto(`${origin}/dashboard/myjobs/${both.id}`);
    }
  } else {
  expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true);
  await page.goto(`${origin}/signup`);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 30_000 });
  owner = await prisma.user.findUniqueOrThrow({ where: { username } });
  pdf = await renderToBuffer(React.createElement(Document, null, React.createElement(Page, null, React.createElement(Text, null, "Per-job documents fixture"))));
  const zip = new JSZip(); zip.file("[Content_Types].xml", "<Types/>"); zip.file("_rels/.rels", "<Relationships/>"); zip.file("word/document.xml", "<document/>");
  docx = await zip.generateAsync({ type: "nodebuffer" });
  cv = { name: "履歷 #1.pdf", mimeType: "application/pdf", buffer: pdf };
  letter = { name: "求職信.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docx };

  await page.goto(`${origin}/dashboard/myjobs`);
  const countBeforeCancel = await prisma.file.count();
  await page.getByRole("button", { name: "New Job", exact: true }).click();
  await page.getByLabel("CV", { exact: true }).setInputFiles(cv);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await prisma.file.count()).toBe(countBeforeCancel);
  expect(await prisma.job.count({ where: { userId: owner.id } })).toBe(0);
  pass("Cancel Add Job after selecting a CV leaves no Job, File or uploaded bytes");

  async function createJob(label, files = {}, simulateFailure = false) {
    await page.goto(`${origin}/dashboard/myjobs`);
    await page.getByRole("button", { name: "New Job", exact: true }).click();
    await pick("Job Title", "Create or Search title", label);
    await pick("Company", "Create or Search company", `Company ${label}`);
    await pick("Job Location", "Create or Search location", `Location ${label}`);
    await page.getByLabel("Job Source", { exact: true }).click(); await page.getByRole("option", { name: "Indeed", exact: true }).click();
    await page.getByLabel("Select Job Status").click(); await page.getByRole("option", { name: "Applied", exact: true }).click();
    for (const [label, file] of Object.entries(files)) await page.getByLabel(label, { exact: true }).setInputFiles(file);
    const before = await prisma.job.count({ where: { userId: owner.id } });
    let failed = false;
    const handler = async (route) => {
      if (!failed && route.request().method() === "PUT") { failed = true; await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Simulated temporary upload failure" }) }); }
      else await route.continue();
    };
    if (simulateFailure) await page.route("**/api/jobs/*/documents", handler);
    await page.getByTestId("save-job-btn").click();
    if (simulateFailure) {
      await expect(page.getByRole("alert")).toContainText("Job saved, but documents could not be confirmed");
      expect(await prisma.job.count({ where: { userId: owner.id } })).toBe(before + 1);
      await page.getByRole("button", { name: "Retry documents", exact: true }).click();
    }
    await expect(page.getByTestId("save-job-btn")).toBeHidden({ timeout: 30_000 });
    if (simulateFailure) await page.unroute("**/api/jobs/*/documents", handler);
    expect(await prisma.job.count({ where: { userId: owner.id } })).toBe(before + 1);
    return prisma.job.findFirstOrThrow({ where: { userId: owner.id, JobTitle: { label } } });
  }
  bothTitle = `Both ${suffix}`; cvTitle = `CV only ${suffix}`; letterTitle = `Letter only ${suffix}`;
  const empty = await createJob(`No documents ${suffix}`);
  expect(await prisma.jobAttachment.count({ where: { jobId: empty.id } })).toBe(0);
  pass("Add Job saves normally with no documents");
  both = await createJob(bothTitle, { CV: cv, "Cover Letter": letter }, true);
  expect(await prisma.jobAttachment.count({ where: { jobId: both.id } })).toBe(2);
  pass("Add Job saves both slots and retries a failed upload without creating a duplicate job");
  cvOnly = await createJob(cvTitle, { CV: cv });
  await createJob(letterTitle, { "Cover Letter": letter });
  const stored = await prisma.jobAttachment.findMany({ where: { Job: { userId: owner.id } }, include: { File: true } });
  expect(new Set(stored.map((file) => file.File.filePath)).size).toBe(stored.length);
  expect(stored.every((file) => file.File.filePath.startsWith(path.join(paths.files, "jobs") + path.sep))).toBe(true);
  pass("CV-only and Cover-Letter-only jobs save; same names on different jobs use independent local paths");

  await page.goto(`${origin}/dashboard/myjobs/${both.id}`);
  await download("CV", cv.name, pdf); await download("Cover Letter", letter.name, docx);
  pass("Actual Electron downloads preserve original Chinese filenames and exact PDF/DOCX bytes");
  await fs.writeFile(checkpointPath, JSON.stringify({ suffix, bothId: both.id, cvOnlyId: cvOnly.id, pdf: pdf.toString("base64"), docx: docx.toString("base64"), passed: report }));
  }

  const replacement = { ...letter, name: "替換履歷.docx" };
  await page.getByLabel("Replace CV", { exact: true }).setInputFiles(replacement);
  await page.getByTestId("document-CV").locator("button").filter({ hasText: /^Replace CV$/ }).click();
  await expect(page.getByText(replacement.name, { exact: true })).toBeVisible();
  await download("CV", replacement.name, docx);
  expect(await (await page.request.get(`${origin}/api/jobs/${cvOnly.id}/documents/CV`)).body()).toEqual(pdf);
  pass("Replace affects only the selected job and keeps the other job's same-named CV unchanged");
  await page.getByRole("button", { name: "Delete CV", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await prisma.jobAttachment.count({ where: { jobId: both.id, kind: "CV" } })).toBe(1);
  await page.getByRole("button", { name: "Delete CV", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download CV", exact: true })).toHaveCount(0);
  expect(await prisma.jobAttachment.count({ where: { jobId: both.id, kind: "COVER_LETTER" } })).toBe(1);
  pass("Delete requires confirmation and leaves the Cover Letter and other jobs intact");

  // Create only a test-owned legacy record through the retained compatibility API.
  const legacyUpload = await page.request.post(`${origin}/api/profile/resume`, { multipart: { title: `Legacy ${suffix}`, file: cv } }); expect(legacyUpload.ok()).toBe(true);
  const legacy = await prisma.resume.findFirstOrThrow({ where: { title: `Legacy ${suffix}`, profile: { userId: owner.id } }, include: { File: true } });
  await page.goto(`${origin}/dashboard/profile`); await expect(page.getByRole("link", { name: legacy.title, exact: true })).toBeVisible();
  expect(await (await page.request.get(`${origin}/api/profile/resume?resumeId=${legacy.id}`)).body()).toEqual(pdf);
  await expect(page.getByRole("button", { name: "New", exact: true })).toHaveCount(0);
  pass("Legacy Files retains old uploaded bytes and downloads, with no global creation/selection UI");
  const backup = await page.request.get(`${origin}/api/backup/export`); expect(backup.ok()).toBe(true);
  const backupBytes = await backup.body(); await fs.writeFile(path.join(artifacts, "documents-backup.zip"), backupBytes);
  const restored = await page.request.post(`${origin}/api/backup/import`, { multipart: { file: { name: "documents.zip", mimeType: "application/zip", buffer: backupBytes }, confirmWipe: "true" } });
  expect(restored.ok(), await restored.text()).toBe(true);
  both = await prisma.job.findFirstOrThrow({ where: { userId: owner.id, JobTitle: { label: bothTitle } } });
  restoredCv = await prisma.job.findFirstOrThrow({ where: { userId: owner.id, JobTitle: { label: cvTitle } } });
  expect(await (await page.request.get(`${origin}/api/jobs/${both.id}/documents/COVER_LETTER`)).body()).toEqual(docx);
  expect(await (await page.request.get(`${origin}/api/jobs/${restoredCv.id}/documents/CV`)).body()).toEqual(pdf);
  expect(await prisma.jobAttachment.count({ where: { Job: { userId: owner.id } } })).toBe(3);
  pass("ZIP restore preserves both document kinds on their correct jobs and retains legacy files");
  await fs.writeFile(checkpointPath, JSON.stringify({ suffix, restoredCvId: restoredCv.id, pdf: pdf.toString("base64"), passed: report }));
  }

  await page.goto(`${origin}/dashboard`); await expect(page.getByText("Activity Calendar", { exact: true })).toBeVisible();
  const keyHash = createHash("sha256").update(await fs.readFile(paths.settings)).digest("hex");
  const before = await prisma.jobAttachment.findMany({ where: { Job: { userId: owner.id } }, orderBy: { id: "asc" } });
  await close(); await open();
  await page.goto(`${origin}/dashboard/myjobs/${restoredCv.id}`);
  if (page.url().includes("/signin")) {
    await page.getByLabel("Username", { exact: true }).fill(username); await page.getByLabel("Password", { exact: true }).fill(password); await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.goto(`${origin}/dashboard/myjobs/${restoredCv.id}`);
  }
  await download("CV", cv.name, pdf);
  expect(await prisma.jobAttachment.findMany({ where: { Job: { userId: owner.id } }, orderBy: { id: "asc" } })).toEqual(before);
  expect(createHash("sha256").update(await fs.readFile(paths.settings)).digest("hex")).toBe(keyHash);
  pass("Close/reopen Electron retains attachment relationships, exact file bytes and original runtime keys");
  expect(errors).toEqual([]);
  await page.screenshot({ path: path.join(artifacts, "job-documents.png"), fullPage: true });
} catch (error) {
  report.push({ passed: false, error: error.message }); console.error(error.message);
  await page?.screenshot({ path: path.join(artifacts, "job-documents-failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await close(); await prisma.$disconnect();
  await fs.writeFile(path.join(artifacts, "job-documents-report.json"), JSON.stringify({ report, errors }, null, 2));
}
