// Explicitly opt-in integration verification, never run by the daily launcher.
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium, expect, _electron } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { renderToBuffer, Document, Page, Text } from "@react-pdf/renderer";
import React from "react";
import { localPaths, databaseUrl, origin } from "./paths.mjs";
import { projectRoot } from "./project.mjs";

const paths = localPaths();
const testRoot = path.join(projectRoot, ".local-runtime-test") + path.sep;
if (!paths.home.startsWith(testRoot)) throw new Error("Browser verification requires JOBSYNC_HOME inside this checkout's .local-runtime-test directory.");
const report = [];
const artifacts = path.join(paths.home, "verification");
await fs.mkdir(artifacts, { recursive: true });
const record = (step) => { report.push({ step, passed: true }); console.log(`PASS ${step}`); };
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl(paths.database) } } });
let browser, page, desktopApp;
if (process.env.JOBSYNC_ELECTRON_EXE) {
  const desktopEnv = { ...process.env, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` };
  delete desktopEnv.ELECTRON_RUN_AS_NODE;
  delete desktopEnv.NODE_OPTIONS;
  desktopApp = await _electron.launch({ executablePath: process.env.JOBSYNC_ELECTRON_EXE,
    env: desktopEnv, timeout: 120_000 });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    page = desktopApp.windows().find((window) => window.url().startsWith(origin));
    if (page) break;
    const splash = desktopApp.windows().find((window) => window.url().startsWith("file:"));
    if (splash && (await splash.locator("#title").textContent().catch(() => "")).includes("could not start")) {
      const error = await splash.locator("#status").textContent();
      await desktopApp.close();
      throw new Error(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!page) { await desktopApp.close(); throw new Error("Packaged Electron did not show the application; inspect desktop logs"); }
  expect(await desktopApp.evaluate(({ app }) => app.isPackaged)).toBe(true);
  expect(await page.evaluate(() => ({ node: typeof process, require: typeof require }))).toEqual({ node: "undefined", require: "undefined" });
  const preferences = await desktopApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((window) => window.webContents.getURL().startsWith("http://127.0.0.1:3737")).webContents.getLastWebPreferences());
  expect(preferences.contextIsolation).toBe(true);
  expect(preferences.nodeIntegration).toBe(false);
  expect(preferences.sandbox).toBe(true);
  await page.waitForLoadState("load");
  await desktopApp.evaluate(({ session }, directory) => {
    globalThis.__jobsyncVerificationDownloads = {};
    session.defaultSession.removeAllListeners("will-download");
    session.defaultSession.on("will-download", (_event, item) => {
      item.setSavePath(directory + "/" + item.getFilename());
      item.once("done", (_downloadEvent, state) => {
        globalThis.__jobsyncVerificationDownloads[item.getFilename()] = state;
      });
    });
  }, artifacts);
  browser = { close: async () => {
    await desktopApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((window) => window.close())).catch(() => {});
    await desktopApp.close();
  } };
  record("Actual packaged Electron, system Node absent from PATH, sandbox and renderer isolation");
} else {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 1100 } });
}
const suffix = randomUUID().slice(0, 8);
const email = `native-${suffix}@example.test`;
const password = `LocalTest-${suffix}-123`;
const jobTitle = `Native runtime job ${suffix}`;
const resumeTitle = `Native runtime resume ${suffix}`;
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
async function pick(label, placeholder, value) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByPlaceholder(placeholder).fill(value);
  await page.getByText(`Create: ${value}`).click();
  await expect(page.getByPlaceholder(placeholder)).toBeHidden();
}
async function pickTime(label, hour) {
  await page.getByLabel(label).click();
  await page.getByRole("group", { name: "Hour", exact: true }).getByRole("button", { name: hour, exact: true }).click();
  await page.getByRole("group", { name: "Minute", exact: true }).getByRole("button", { name: "00", exact: true }).click();
  await page.getByRole("group", { name: "AM/PM", exact: true }).getByRole("button", { name: "AM", exact: true }).click();
  await page.keyboard.press("Escape");
}
try {
  if (process.argv.includes("--login-only")) {
    const saved = JSON.parse(await fs.readFile(path.join(artifacts, "account.json"), "utf8"));
    await page.goto(`${origin}/signin`);
    await page.getByPlaceholder("id@example.com").fill(saved.email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(saved.password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 30_000 });
    const persisted = await prisma.resume.findFirstOrThrow({ where: { title: saved.resumeTitle, profile: { userId: saved.userId } }, include: { File: true } });
    const response = await page.request.get(`${origin}/api/profile/resume?resumeId=${persisted.id}`);
    expect(response.ok()).toBe(true);
    expect(await response.body()).toEqual(await fs.readFile(persisted.File.filePath));
    record("Existing account login and attachment download after stop/restart");
  } else {
  await page.goto(`${origin}/signup`);
  await page.getByLabel("Full Name").fill(`Native Test ${suffix}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 30_000 });
  record("Register account and authenticate through browser UI");
  await expect(page.getByText("Activity Calendar", { exact: true })).toBeVisible();
  await expect(page.locator(".daily-goals-calendar").last()).toBeVisible();
  record("Dashboard and both calendars load");

  await page.goto(`${origin}/dashboard/myjobs`);
  await page.getByRole("button", { name: /^(New |Add )?Job$/ }).click();
  await pick("Job Title", "Create or Search title", jobTitle);
  await pick("Company", "Create or Search company", `Native Company ${suffix}`);
  await pick("Job Location", "Create or Search location", "Amsterdam");
  await page.getByLabel("Job Source", { exact: true }).click();
  await page.getByRole("option", { name: "Indeed", exact: true }).click();
  await page.getByLabel("Select Job Status").click();
  await page.getByRole("option", { name: "Applied", exact: true }).click();
  await page.getByLabel("Job Description").locator("div").fill("Native Windows runtime verification job description.");
  await page.getByTestId("save-job-btn").click();
  const row = page.getByRole("row", { name: jobTitle }).first();
  await expect(row).toBeVisible();
  record("Create applied job through original form");
  await row.getByRole("button", { name: "Edit Job" }).click();
  await page.getByLabel("Job Description").locator("div").fill("Edited native Windows runtime job description.");
  await page.getByTestId("save-job-btn").click();
  await expect(page.getByTestId("save-job-btn")).toBeHidden();
  const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
  const job = await prisma.job.findFirstOrThrow({ where: { userId: owner.id, JobTitle: { label: jobTitle } } });
  expect(job.description).toContain("Edited native");
  expect(job.applied).toBe(true);
  expect(await prisma.jobStage.count({ where: { jobId: job.id } })).toBeGreaterThan(0);
  record("Edit job and retain application timeline");

  const csv = await page.request.post(`${origin}/api/jobs/export`);
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain(jobTitle);
  record("CSV export contains real test job");

  await page.goto(`${origin}/dashboard/tasks`);
  await page.getByTestId("add-task-btn").click();
  await page.getByPlaceholder("Enter task title").fill(`Desktop task ${suffix}`);
  await page.getByPlaceholder("Enter task title").blur();
  await page.getByTestId("save-task-btn").click();
  await expect(page.getByTestId("task-form-dialog-title")).toBeHidden();
  await expect(page.getByRole("row", { name: new RegExp(`Desktop task ${suffix}`) })).toBeVisible();
  await page.goto(`${origin}/dashboard/activities`);
  await page.getByTestId("add-activity-btn").click();
  await page.getByPlaceholder("Ex: Job Search, Learning skill, etc").fill(`Desktop activity ${suffix}`);
  await pick("Activity Type", "Create or Search activityType", `Desktop type ${suffix}`);
  // Explicit same-day times avoid the original form's midnight default rollover.
  await pickTime("Start Time", "09");
  await pickTime(/^End Time/, "10");
  await page.getByTestId("save-activity-btn").click();
  await expect(page.getByText("Add New Activity", { exact: true })).toBeHidden();
  await expect(page.getByRole("row", { name: new RegExp(`Desktop activity ${suffix}`) })).toBeVisible();
  record("Original Tasks and Activities forms save real local records");

  const pdf = await renderToBuffer(React.createElement(Document, null,
    React.createElement(Page, null, React.createElement(Text, null, "Native runtime upload test"))));
  const upload = await page.request.post(`${origin}/api/profile/resume`, {
    multipart: { title: resumeTitle, file: { name: "测试 resume.pdf", mimeType: "application/pdf", buffer: pdf } },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const resume = await prisma.resume.findFirstOrThrow({ where: { title: resumeTitle, profile: { userId: owner.id } }, include: { File: true } });
  expect(resume.File.filePath.startsWith(paths.resumes + path.sep)).toBe(true);
  expect(await fs.readFile(resume.File.filePath)).toEqual(pdf);
  const download = await page.request.get(`${origin}/api/profile/resume?resumeId=${resume.id}`);
  expect(download.ok()).toBe(true);
  expect(await download.body()).toEqual(pdf);
  record("Unicode PDF attachment upload, local storage and byte-identical download");

  // Seed only this test account's structured resume to exercise the existing PDF UI.
  await prisma.contactInfo.create({ data: { resumeId: resume.id, firstName: "Native", lastName: "Test", headline: "Developer", email, phone: "0000000000" } });
  await prisma.resumeSection.create({ data: { Resume: { connect: { id: resume.id } }, sectionTitle: "Summary", sectionType: "summary", summary: { create: { content: "<p>Local runtime verification resume.</p>" } } } });
  await page.goto(`${origin}/dashboard/profile/resume/${resume.id}`);
  await page.getByRole("button").filter({ has: page.locator("svg.lucide-ellipsis-vertical") }).click();
  await page.getByRole("menuitem", { name: "Export to PDF" }).click();
  const pdfDialog = page.getByRole("dialog");
  const pdfDownload = desktopApp ? null : page.waitForEvent("download", { timeout: 30_000 });
  await pdfDialog.getByRole("button", { name: /export|download/i }).last().click();
  await page.getByRole("button", { name: "Download only", exact: true }).click();
  let exportedPath;
  if (desktopApp) {
    // A visible file can still be locked by Chromium on Windows. Wait for the
    // native download completion event before checking the exported bytes.
    let filename;
    await expect.poll(async () => {
      const downloads = await desktopApp.evaluate(() => globalThis.__jobsyncVerificationDownloads);
      filename = Object.keys(downloads).find((name) => name.startsWith(resumeTitle) && name.endsWith(".pdf"));
      return downloads[filename];
    }, { timeout: 30_000 }).toBe("completed");
    exportedPath = path.join(artifacts, filename);
  } else {
    const exported = await pdfDownload;
    exportedPath = await exported.path();
  }
  expect((await fs.readFile(exportedPath)).subarray(0, 4).toString()).toBe("%PDF");
  await fs.copyFile(exportedPath, path.join(artifacts, "resume-export.pdf"));
  record("Original resume PDF export UI generates a PDF");

  const backup = await page.request.get(`${origin}/api/backup/export`);
  expect(backup.ok()).toBe(true);
  const zip = await backup.body();
  await fs.writeFile(path.join(artifacts, "backup.zip"), zip);
  const multipart = { file: { name: "backup.zip", mimeType: "application/zip", buffer: zip } };
  const preview = await page.request.post(`${origin}/api/backup/import/preflight`, { multipart });
  expect(preview.ok()).toBe(true);
  const restored = await page.request.post(`${origin}/api/backup/import`, { multipart: { ...multipart, confirmWipe: "true" } });
  expect(restored.ok(), await restored.text()).toBe(true);
  const restoredResume = await prisma.resume.findFirstOrThrow({ where: { title: resumeTitle, profile: { userId: owner.id } }, include: { File: true } });
  expect(await fs.readFile(restoredResume.File.filePath)).toEqual(pdf);
  expect(await prisma.job.count({ where: { userId: owner.id } })).toBe(1);
  const snapshots = await page.request.get(`${origin}/api/backup/snapshots`);
  const snapshotsList = await snapshots.json();
  expect(snapshotsList.length).toBeGreaterThan(0);
  const rollback = await page.request.post(`${origin}/api/backup/rollback`, { data: { snapshotId: snapshotsList[0].id } });
  expect(rollback.ok(), await rollback.text()).toBe(true);
  record("ZIP export, preflight, confirmed restore with attachment, snapshot and rollback");

  await page.goto(`${origin}/dashboard`);
  await expect(page.getByText("Activity Calendar", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(artifacts, "dashboard.png"), fullPage: true });
  for (const route of ["interviews", "tasks", "activities", "profile", "automations", "settings"]) {
    const response = await page.goto(`${origin}/dashboard/${route}`);
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /application error/i })).toHaveCount(0);
  }
  record("Preserved core, Automations and Settings pages render");
  await page.goto(`${origin}/dashboard/myjobs`);
  await page.getByRole("row", { name: jobTitle }).first().getByRole("button", { name: "Delete Job" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("row", { name: jobTitle })).toHaveCount(0);
  record("Delete job through original UI");
  expect(browserErrors).toEqual([]);
  await fs.writeFile(path.join(artifacts, "account.json"), JSON.stringify({ email, password, userId: owner.id, resumeTitle }, null, 2));
  }
} catch (error) {
  report.push({ passed: false, error: error.message });
  console.error(error);
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(artifacts, process.argv.includes("--login-only") ? "restart-login-report.json" : "browser-report.json"), JSON.stringify({ report, browserErrors }, null, 2));
  await browser.close();
  await prisma.$disconnect();
}
