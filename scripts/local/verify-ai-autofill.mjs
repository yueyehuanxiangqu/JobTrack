// Opt-in production Electron verification with an owned local mock AI endpoint.
// Never uses paid credentials, personal attachments, or the default user home.
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { _electron, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import JSZip from "jszip";
import React from "react";
import { renderToBuffer, Document, Page, Text } from "@react-pdf/renderer";
import { localPaths, databaseUrl, origin } from "./paths.mjs";
import { projectRoot } from "./project.mjs";

const paths = localPaths();
if (!paths.home.startsWith(path.join(projectRoot, ".local-runtime-test") + path.sep)) throw Error("An isolated JOBTRACK_HOME is required.");
if (!process.env.JOBTRACK_ELECTRON_EXE) throw Error("Set JOBTRACK_ELECTRON_EXE to the current unpacked application.");
const artifacts = path.join(paths.home, "verification"); await fs.mkdir(artifacts, { recursive: true });
const report = [], errors = [], requests = [];
const mark = step => { report.push({ step, passed: true }); console.log(`PASS ${step}`); };
const suffix = randomUUID().slice(0, 8), username = `autofill-${suffix}`, password = `Fixture-password-${suffix}`;
const key = `local-autofill-fixture-${suffix}`, geminiKey = `local-gemini-fixture-${suffix}`;
const title = `Platform Engineer ${suffix}`, company = `Autofill Company ${suffix}`;
const description = `${company} is hiring a ${title}. This full-time remote role involves building reliable software, collaborating with engineers and maintaining services. Location is not specified.`;
const fields = { company, jobTitle: title, location: null, workplaceType: "REMOTE", jobType: "FT", jobUrl: "https://invented.example/not-trusted" };
let invalidOutput = false;
const server = http.createServer(async (req, res) => {
  let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 256000) { req.destroy(); return; } }
  const body = JSON.parse(raw); requests.push({ url: req.url, headers: req.headers, body });
  const google = req.url.includes(":generateContent");
  const content = google ? body.contents?.at(-1)?.parts?.[0]?.text : body.messages?.at(-1)?.content;
  const output = content === "Reply with OK." ? "OK" : invalidOutput ? "invalid JSON" : JSON.stringify(fields);
  const response = google ? { candidates: [{ content: { role: "model", parts: [{ text: output }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }, modelVersion: "fixture-gemini" } :
    { id: "local-fixture", object: "chat.completion", created: 1, model: body.model, choices: [{ index: 0, message: { role: "assistant", content: output }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
  res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(response));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl(paths.database) } } });
let app, page;
async function go(route) { await page.goto(origin + route); await page.waitForLoadState("networkidle"); }
async function choose(label, option) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function saveSettings(provider) {
  await page.getByRole("button", { name: "Save AI Settings", exact: true }).click();
  await expect.poll(async () => {
    const settings = await prisma.userSettings.findUnique({ where: { userId: owner.id } });
    return settings ? JSON.parse(settings.settings).ai.provider : undefined;
  }).toBe(provider);
  await expect(page.getByText("AI Settings saved.", { exact: true })).toBeVisible();
}
let owner;
try {
  const env = { ...process.env, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` };
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  app = await _electron.launch({ executablePath: process.env.JOBTRACK_ELECTRON_EXE, env, timeout: 120000 });
  await expect.poll(() => { page = app.windows().find(w => w.url().startsWith(origin)); return !!page; }, { timeout: 120000 }).toBe(true);
  page.setDefaultTimeout(30000); page.on("pageerror", error => errors.push(error.message));
  const security = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith("http:"));
    const p = w.webContents.getLastWebPreferences(); return { sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration };
  });
  expect(security).toEqual({ sandbox: true, contextIsolation: true, nodeIntegration: false });
  await go("/signup"); await page.getByLabel("Username", { exact: true }).fill(username); await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create an account", exact: true }).click(); await expect(page).toHaveURL(`${origin}/dashboard`);
  // Isolated fixture credentials support a later home-migration/restart check.
  // This directory is Git-ignored; never print this checkpoint or real keys.
  await fs.writeFile(path.join(artifacts, "autofill-account.json"), JSON.stringify({ username, password }));
  owner = await prisma.user.findUniqueOrThrow({ where: { username } });
  await prisma.company.create({ data: { label: "Manual Company", value: `manual-${suffix}`, createdBy: owner.id } });
  await prisma.location.create({ data: { label: "Manual City", value: `city-${suffix}`, createdBy: owner.id } });
  await go("/dashboard/settings");
  await choose("Select AI provider", "Custom / OpenAI-compatible API");
  await page.getByLabel("Model", { exact: true }).fill("fixture-model"); await page.getByLabel("Base URL", { exact: true }).fill(base + "/v1"); await page.getByLabel("API Key", { exact: true }).fill(key);
  await saveSettings("custom"); await expect(page.getByLabel("API Key", { exact: true })).toHaveValue("");
  const stored = await prisma.apiKey.findUniqueOrThrow({ where: { userId_provider: { userId: owner.id, provider: "custom" } } });
  expect(stored.iv).not.toBe(""); expect(stored.encryptedKey).not.toContain(key);
  await page.getByRole("button", { name: "Test Connection", exact: true }).click(); await expect(page.getByRole("status")).toContainText("Connection successful");
  expect(requests[0].headers.authorization).toBe(`Bearer ${key}`);
  await choose("Select AI provider", "Google Gemini");
  await expect(page.getByLabel("API Key", { exact: true })).toHaveValue("");
  await page.getByLabel("Model", { exact: true }).fill("fixture-gemini"); await page.getByLabel("Base URL", { exact: true }).fill(base + "/v1beta"); await page.getByLabel("API Key", { exact: true }).fill(geminiKey);
  await saveSettings("gemini"); await page.getByRole("button", { name: "Test Connection", exact: true }).click(); await expect(page.getByRole("status")).toContainText("Connection successful");
  expect(requests.at(-1).url).toContain(":generateContent"); expect(requests.at(-1).headers["x-goog-api-key"]).toBe(geminiKey);
  await choose("Select AI provider", "Custom / OpenAI-compatible API"); await expect(page.getByLabel("Model", { exact: true })).toHaveValue("fixture-model"); await saveSettings("custom");
  mark("Settings saves encrypted per-provider keys, manual models and Base URLs; Custom and Gemini connection tests use distinct protocols and credentials");
  await go("/dashboard/myjobs"); await page.getByRole("button", { name: "New Job", exact: true }).click();
  const calls = requests.length;
  await page.getByLabel("Recruitment URL", { exact: true }).fill(base + "/private"); await page.getByRole("button", { name: "AI Autofill", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Please paste the job description manually"); expect(requests.length).toBe(calls);
  const counts = async () => Promise.all([prisma.job.count({ where: { userId: owner.id } }), prisma.company.count({ where: { createdBy: owner.id } }), prisma.jobTitle.count({ where: { createdBy: owner.id } }), prisma.file.count()]);
  const before = await counts();
  await page.getByRole("button", { name: "Paste JD", exact: true }).click(); await page.getByLabel("Job description to import", { exact: true }).fill(description);
  await page.getByLabel("Job URL", { exact: true }).fill("https://manual.example/job");
  await page.getByRole("button", { name: "AI Autofill", exact: true }).click(); await expect(page.getByRole("status")).toContainText("Autofill complete");
  await expect(page.getByLabel("Job Title", { exact: true })).toContainText(title); await expect(page.getByLabel("Company", { exact: true })).toContainText(company);
  await expect(page.getByLabel("Job Location", { exact: true })).toContainText("Select"); await expect(page.getByRole("radio", { name: "Remote", exact: true })).toBeChecked();
  await expect(page.getByLabel("Job Description", { exact: true })).toContainText(description); await expect(page.getByLabel("Job URL", { exact: true })).toHaveValue("https://manual.example/job");
  expect(await counts()).toEqual(before);
  mark("Private recruitment URL is rejected without a network request; pasted JD fills visible drafts/editor without creating any records or inventing a city");
  await choose("Company", "Manual Company"); await choose("Job Location", "Manual City"); await choose("Job Source", "Indeed"); await choose("Select Job Status", "Applied");
  await page.getByRole("radio", { name: "Contract", exact: true }).check();
  await page.getByLabel("Job Description", { exact: true }).locator("div").fill(description + " Manual note kept.");
  const pdf = await renderToBuffer(React.createElement(Document, null, React.createElement(Page, null, React.createElement(Text, null, "Private CV content never sent to AI"))));
  const zip = new JSZip(); zip.file("[Content_Types].xml", "<Types/>"); zip.file("_rels/.rels", "<Relationships/>"); zip.file("word/document.xml", "<document>Private Cover Letter content</document>");
  const docx = await zip.generateAsync({ type: "nodebuffer" });
  await page.getByLabel("CV", { exact: true }).setInputFiles({ name: "履歷.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByLabel("Cover Letter", { exact: true }).setInputFiles({ name: "求職信.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docx });
  await page.getByRole("button", { name: "AI Autofill", exact: true }).click();
  await expect.poll(() => requests.length).toBe(calls + 2);
  await expect(page.getByRole("button", { name: "AI Autofill", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Company", { exact: true })).toContainText("Manual Company"); await expect(page.getByRole("radio", { name: "Contract", exact: true })).toBeChecked();
  await expect(page.getByLabel("Job Description", { exact: true })).toContainText("Manual note kept.");
  expect(await counts()).toEqual(before);
  expect(JSON.stringify(requests.map(r => r.body))).not.toMatch(/Private CV content|Private Cover Letter content/);
  await page.screenshot({ path: path.join(artifacts, "autofill-before-save.png"), fullPage: true });
  await page.getByTestId("save-job-btn").click(); await expect(page.getByTestId("save-job-btn")).toBeHidden();
  await expect(page.getByRole("row", { name: new RegExp(title) })).toBeVisible();
  const job = await prisma.job.findFirstOrThrow({ where: { userId: owner.id }, include: { Company: true, Documents: true } });
  expect(job.Company.label).toBe("Manual Company"); expect(job.jobType).toBe("C"); expect(job.description).toContain("Manual note kept."); expect(job.Documents).toHaveLength(2);
  for (const [kind, bytes] of [["CV", pdf], ["COVER_LETTER", docx]]) {
    const download = await page.request.get(`${origin}/api/jobs/${job.id}/documents/${kind}`); expect(download.ok()).toBe(true); expect(await download.body()).toEqual(bytes);
  }
  mark("Manual corrections survive repeated Autofill; Save alone creates the job/title, uploads both attachment slots and refreshes Jobs automatically");
  await go("/dashboard"); const calendar = page.getByRole("region", { name: "Activity Calendar days" });
  await calendar.locator('rect[style*="fill: rgb(144, 224, 239)"]').first().hover(); await expect(page.getByRole("tooltip")).toContainText("1 job applied");
  mark("Real Activity Calendar shows the saved application");
  await go("/dashboard/myjobs"); await page.getByRole("button", { name: "New Job", exact: true }).click();
  await page.getByLabel("Job URL", { exact: true }).fill("https://keep.example/manual");
  await page.getByRole("button", { name: "Paste JD", exact: true }).click(); await page.getByLabel("Job description to import", { exact: true }).fill(description);
  invalidOutput = true; await page.getByRole("button", { name: "AI Autofill", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("invalid JSON");
  await expect(page.getByLabel("Job URL", { exact: true })).toHaveValue("https://keep.example/manual"); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await prisma.job.count({ where: { userId: owner.id } })).toBe(1);
  await go("/dashboard/settings"); await page.getByRole("button", { name: "Delete API Key", exact: true }).click(); await expect(page.getByRole("status")).toContainText("deleted");
  expect(await prisma.apiKey.findUnique({ where: { userId_provider: { userId: owner.id, provider: "custom" } } })).toBeNull();
  expect(await prisma.apiKey.findUnique({ where: { userId_provider: { userId: owner.id, provider: "gemini" } } })).not.toBeNull();
  expect(errors).toEqual([]);
  mark("Invalid JSON leaves manual fields unchanged; key deletion is provider-scoped; Electron sandbox/isolation remain enabled");
} catch (error) {
  report.push({ passed: false, error: error.message }); console.error(error);
  await page?.screenshot({ path: path.join(artifacts, "autofill-failure.png"), fullPage: true }).catch(() => {}); process.exitCode = 1;
} finally {
  if (app) { const closed = app.waitForEvent("close"); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.close())).catch(() => {}); await closed; }
  await prisma.$disconnect(); await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(artifacts, "ai-autofill-report.json"), JSON.stringify({ report, rendererErrors: errors, mockApiRequests: requests.length }, null, 2));
}
