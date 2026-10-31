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
const username = `native-${suffix}`;
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
  if (process.argv.includes("--legacy-migration")) {
    const legacyPath = path.join(artifacts, "legacy-account.json");
    const saved = JSON.parse(await fs.readFile(legacyPath, "utf8"));
    const before = await prisma.user.findUniqueOrThrow({ where: { id: saved.userId } });
    expect(before.username).toBeNull();
    const jobBefore = saved.legacyJobId ? await prisma.job.findUniqueOrThrow({ where: { id: saved.legacyJobId } }) : null;
    const resumeBefore = await prisma.resume.findFirstOrThrow({ where: { title: saved.resumeTitle, profile: { userId: saved.userId } }, include: { File: true } });
    const bytes = await fs.readFile(resumeBefore.File.filePath);
    const counts = await Promise.all([prisma.task.count({ where: { userId: saved.userId } }), prisma.activity.count({ where: { userId: saved.userId } })]);
    await page.goto(`${origin}/signin`);
    await page.getByRole("link", { name: "Have an existing email account? Set your username" }).click();
    await page.getByLabel("Original email", { exact: true }).fill(saved.email);
    await page.getByLabel("Current password", { exact: true }).fill("wrong-migration-password");
    await page.getByLabel("Username", { exact: true }).fill(username);
    await page.getByRole("button", { name: "Set username", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("could not be verified");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: saved.userId } })).username).toBeNull();
    await page.getByLabel("Current password", { exact: true }).fill(saved.password);
    await page.getByRole("button", { name: "Set username", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 30_000 });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: saved.userId } })).toEqual({ ...before, username });
    if (jobBefore) expect(await prisma.job.findUniqueOrThrow({ where: { id: saved.legacyJobId } })).toEqual(jobBefore);
    expect(await prisma.resume.findFirstOrThrow({ where: { id: resumeBefore.id }, include: { File: true } })).toEqual(resumeBefore);
    expect(await fs.readFile(resumeBefore.File.filePath)).toEqual(bytes);
    expect(await Promise.all([prisma.task.count({ where: { userId: saved.userId } }), prisma.activity.count({ where: { userId: saved.userId } })])).toEqual(counts);
    const oldZip = await fs.readFile(path.join(artifacts, "backup.zip"));
    const preview = await page.request.post(`${origin}/api/backup/import/preflight`, { multipart: { file: { name: "old-backup.zip", mimeType: "application/zip", buffer: oldZip } } });
    expect(preview.ok()).toBe(true);
    expect((await preview.json()).emailMatches).toBe(true);
    await fs.writeFile(legacyPath, JSON.stringify({ ...saved, username }, null, 2));
    record("Legacy email/password migration UI rejects wrong password, preserves original account/jobs/files/tasks/activities and recognizes old ZIP backups");
  } else if (process.argv.includes("--login-only")) {
    const saved = JSON.parse(await fs.readFile(path.join(artifacts, "account.json"), "utf8"));
    await page.goto(`${origin}/dashboard`);
    if (page.url().startsWith(`${origin}/dashboard`)) {
      await page.getByRole("button", { name: "User menu", exact: true }).click();
      await page.getByRole("button", { name: "Logout", exact: true }).click();
      await expect(page).toHaveURL(`${origin}/signin`, {timeout:30_000});
    }
    await page.goto(`${origin}/signin`);
    await page.getByPlaceholder("Your username").fill(` ${saved.username.toUpperCase()} `);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("wrong-login-password");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page.getByText("Invalid username or password.", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(saved.password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 30_000 });
    const persisted = await prisma.resume.findFirstOrThrow({ where: { title: saved.resumeTitle, profile: { userId: saved.userId } }, include: { File: true } });
    const response = await page.request.get(`${origin}/api/profile/resume?resumeId=${persisted.id}`);
    expect(response.ok()).toBe(true);
    expect(await response.body()).toEqual(await fs.readFile(persisted.File.filePath));
    const identity = await (await page.request.get(`${origin}/api/auth/session`)).json();
    expect(identity.user.username).toBe(saved.username);
    expect(identity.user).not.toHaveProperty("password");
    record("Wrong password rejected; case/whitespace-normalized username login and attachment download after stop/restart");
  } else {
  await page.goto(`${origin}/signup`);
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 30_000 });
  record("Register account and authenticate through browser UI");
  await expect(page.getByText("Activity Calendar", { exact: true })).toBeVisible();
  await expect(page.getByText("Daily Goals", { exact: true })).toHaveCount(0);
  record("Dashboard and the real-data Activity Calendar load; Daily Goals absent");

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
  const owner = await prisma.user.findUniqueOrThrow({ where: { username } });
  expect(owner.email).toBeNull();
  const job = await prisma.job.findFirstOrThrow({ where: { userId: owner.id, JobTitle: { label: jobTitle } } });
  expect(job.description).toContain("Edited native");
  expect(job.applied).toBe(true);
  expect(await prisma.jobStage.count({ where: { jobId: job.id } })).toBeGreaterThan(0);
  record("Edit job and retain application timeline");

  const csv = await page.request.post(`${origin}/api/jobs/export`);
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain(jobTitle);
  record("CSV export contains real test job");

  await page.goto(`${origin}/dashboard/myjobs/${job.id}`);
  await page.getByTestId("update-status-menu-btn").click();
  await page.getByRole("menuitem", { name: "Add Stage", exact: true }).click();
  await page.getByTestId("stage-type-select").getByRole("combobox").click();
  await page.getByRole("option", { name: "1st Screening Interview", exact: true }).click();
  await page.getByPlaceholder("e.g. Video, Phone").fill("Video");
  await page.getByLabel("DURATION (MIN)", { exact: true }).fill("45");
  await page.getByPlaceholder("Add any context for this stage…").fill("Isolated desktop interview verification");
  await page.getByRole("dialog").getByRole("button", { name: "Add Stage", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const interviewStage = await prisma.jobStage.findFirstOrThrow({ where: { jobId: job.id, StageType: { value: "1st screening interview" } }, include: { StageType: { include: { Status: true } } } });
  expect(interviewStage.durationMins).toBe(45);
  expect(interviewStage.notes).toBe("Isolated desktop interview verification");
  expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).statusId).toBe(interviewStage.StageType.Status.id);
  await page.goto(`${origin}/dashboard/interviews`);
  await expect(page.getByRole("link", { name: jobTitle, exact: true })).toBeVisible();
  await expect(page.getByText("1st Screening Interview", { exact: true })).toBeVisible();
  record("Add a scheduled interview with notes/duration through the timeline; application status and Interviews list remain consistent");

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
  await page.goto(`${origin}/dashboard/profile`);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add New Resume", exact: true }).click();
  await page.getByLabel("Upload Resume (Optional)", { exact: true }).setInputFiles({ name: "测试 resume.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByTestId("resume-title-input").fill(resumeTitle);
  await expect(page.getByText("Auto-fill with AI", { exact: true })).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const resume = await prisma.resume.findFirstOrThrow({ where: { title: resumeTitle, profile: { userId: owner.id } }, include: { File: true } });
  expect(resume.File.filePath.startsWith(paths.resumes + path.sep)).toBe(true);
  expect(await fs.readFile(resume.File.filePath)).toEqual(pdf);
  const download = await page.request.get(`${origin}/api/profile/resume?resumeId=${resume.id}`);
  expect(download.ok()).toBe(true);
  expect(await download.body()).toEqual(pdf);
  record("Unicode PDF attachment uploaded through the retained document UI, local storage and byte-identical download; retired AI import absent");
  await page.goto(`${origin}/dashboard/myjobs`);
  await page.getByRole("row", { name: jobTitle }).first().getByRole("button", { name: "Edit Job" }).click();
  await page.getByRole("combobox", { name: "Select Resume", exact: true }).click();
  await page.getByRole("option", { name: resumeTitle, exact: true }).click();
  await page.getByTestId("save-job-btn").click();
  await expect(page.getByTestId("save-job-btn")).toBeHidden();
  expect((await prisma.job.findUniqueOrThrow({where:{id:job.id}})).resumeId).toBe(resume.id);
  record("An uploaded CV can be linked to a job without the retired Resume Builder");


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
  const ownPreview = await preview.json();
  expect(ownPreview.manifest.sourceUsername).toBe(username);
  expect(ownPreview.emailMatches).toBe(true);
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
  const calendar = page.getByText("Activity Calendar", { exact: true }).locator("xpath=ancestor::div[.//*[local-name()='rect']][1]");
  const dayRects = calendar.locator("svg rect");
  // Nivo sets SVG colors/borders through CSS styles rather than attributes.
  await expect.poll(() => dayRects.count()).toBeGreaterThanOrEqual(365);
  const activeDay = await dayRects.evaluateAll((rects) => rects.findIndex((rect) => {
    const style = getComputedStyle(rect);
    return style.strokeWidth === "2px" && ["rgb(144, 224, 239)", "rgb(72, 202, 228)", "rgb(0, 180, 216)", "rgb(0, 150, 199)", "rgb(0, 119, 182)"].includes(style.fill);
  }));
  expect(activeDay).toBeGreaterThanOrEqual(0);
  await dayRects.nth(activeDay).hover();
  await expect(page.getByText("1 job applied", { exact: true })).toBeVisible();
  await expect(page.getByText("1 hr activity", { exact: true })).toBeVisible();
  record("Activity Calendar tooltip shows the real user's one application and one hour of recorded activity");
  await page.screenshot({ path: path.join(artifacts, "dashboard.png"), fullPage: true });
  for (const route of ["interviews", "tasks", "activities", "profile", "settings"]) {
    const response = await page.goto(`${origin}/dashboard/${route}`);
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /application error/i })).toHaveCount(0);
  }
  record("Preserved core and Settings pages render");
  for (const route of ["/dashboard/automations", "/dashboard/questions", "/dashboard/notifications", "/api/ai/chat", "/api/mcp"]) {
    const response = await page.request.get(`${origin}${route}`);
    expect(response.status(), route).toBe(404);
  }
  record("Retired pages and AI/MCP endpoints are unavailable");
  const userCount = await prisma.user.count();
  await page.goto(`${origin}/signup`);
  await page.getByLabel("Username", { exact: true }).fill(` ${username.toUpperCase()} `);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page.getByText("This username is already taken.", { exact: true })).toBeVisible();
  expect(await prisma.user.count()).toBe(userCount);
  record("Registration rejects case/whitespace duplicate usernames without creating an account");
  const privateResume = await prisma.resume.findFirstOrThrow({ where: { title: resumeTitle, profile: { userId: owner.id } } });
  const privateJob = await prisma.job.findFirstOrThrow({ where: { userId: owner.id, JobTitle: { label: jobTitle } } });
  await page.getByLabel("Username", { exact: true }).fill(`isolated-${suffix}`);
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 30_000 });
  expect((await page.request.get(`${origin}/api/profile/resume?resumeId=${privateResume.id}`)).status()).toBe(404);
  expect((await page.request.get(`${origin}/dashboard/myjobs/${privateJob.id}`)).status()).toBe(404);
  const foreignPreview = await page.request.post(`${origin}/api/backup/import/preflight`, { multipart });
  expect((await foreignPreview.json()).emailMatches).toBe(false);
  await page.goto(`${origin}/dashboard/myjobs`);
  await expect(page.getByRole("row", { name: jobTitle })).toHaveCount(0);
  await page.goto(`${origin}/signin`);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 30_000 });
  record("Two real users cannot read each other's jobs/files; ZIP preflight distinguishes username-only accounts");
  await page.goto(`${origin}/dashboard/myjobs`);
  await page.getByRole("row", { name: jobTitle }).first().getByRole("button", { name: "Delete Job" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("row", { name: jobTitle })).toHaveCount(0);
  record("Delete job through original UI");
  expect(browserErrors).toEqual([]);
  await fs.writeFile(path.join(artifacts, "account.json"), JSON.stringify({ username, email, password, userId: owner.id, resumeTitle }, null, 2));
  }
} catch (error) {
  report.push({ passed: false, error: error.message });
  console.error(error);
  await page.screenshot({ path: path.join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  const reportName = process.argv.includes("--legacy-migration") ? "legacy-migration-report.json" : process.argv.includes("--login-only") ? "restart-login-report.json" : "browser-report.json";
  await fs.writeFile(path.join(artifacts, reportName), JSON.stringify({ report, browserErrors }, null, 2));
  await browser.close();
  await prisma.$disconnect();
}
