// Opt-in layout regression check against an isolated, already initialized fixture.
// JOBSYNC_HOME/verification/account.json: { username, password, jobId }.
// Never point this harness at a personal account or the default data directory.
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, _electron, expect } from "@playwright/test";
import { localPaths, origin } from "./paths.mjs";
import { projectRoot } from "./project.mjs";

const paths = localPaths();
if (!paths.home.startsWith(path.join(projectRoot, ".local-runtime-test") + path.sep)) {
  throw new Error("Use an isolated JOBSYNC_HOME inside .local-runtime-test.");
}
const artifacts = path.join(paths.home, "verification");
const account = JSON.parse(await fs.readFile(path.join(artifacts, "account.json"), "utf8"));
const report = { mode: process.env.JOBSYNC_ELECTRON_EXE ? "electron" : "edge", layouts: [], checks: [], errors: [] };
let app, browser, page;
const record = (name) => { report.checks.push(name); console.log(`PASS ${name}`); };
async function go(route) {
  await page.goto(origin + route);
  await page.waitForLoadState("networkidle");
}
async function dimensions(width, height, zoom = 1) {
  if (app) {
    await app.evaluate(({ BrowserWindow }, size) => {
      const window = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith("http:"));
      window.setSize(size.width, size.height);
      window.webContents.setZoomFactor(size.zoom);
    }, { width, height, zoom });
  } else {
    // CSS viewport equivalent only; this does NOT simulate actual Windows DPI.
    await page.setViewportSize({ width: Math.round(width / zoom), height: Math.round(height / zoom) });
  }
}
async function noPageOverflow(name) {
  const size = await page.evaluate(() => ({
    width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
    dpr: devicePixelRatio,
  }));
  expect(size.scrollWidth, `${name}: whole-page horizontal overflow`).toBeLessThanOrEqual(size.width + 1);
  return size;
}
async function contained(locator, name) {
  await expect(locator).toBeVisible();
  // Radix animates the portal into position; wait for its final geometry.
  await expect.poll(async () => locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    return r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }), { message: name, timeout: 5000 }).toBe(true);
  const box = await locator.boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(box.x, name).toBeGreaterThanOrEqual(-1);
  expect(box.y, name).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, name).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height, name).toBeLessThanOrEqual(viewport.height + 1);
}
async function dialogControls() {
  const dialog = page.getByRole("dialog").last();
  await contained(dialog, "Dialog fits viewport");
  const save = dialog.getByRole("button", { name: /^(Save|Export)$/ }).last();
  await save.scrollIntoViewIfNeeded();
  await contained(save, "Save/Export is reachable by scrolling");
  const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
  await cancel.scrollIntoViewIfNeeded();
  await contained(cancel, "Cancel is reachable by scrolling");
  await cancel.click();
}
try {
  if (process.env.JOBSYNC_ELECTRON_EXE) {
    const env = { ...process.env, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` };
    delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
    app = await _electron.launch({ executablePath: process.env.JOBSYNC_ELECTRON_EXE, env, timeout: 120_000 });
    await expect.poll(() => {
      page = app.windows().find(w => w.url().startsWith(origin)); return !!page;
    }, { timeout: 120_000 }).toBe(true);
    report.desktop = await app.evaluate(({ app, screen, BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith("http:"));
      const p = window.webContents.getLastWebPreferences();
      return { packaged: app.isPackaged, observedDisplayScale: screen.getPrimaryDisplay().scaleFactor,
        minimumSize: window.getMinimumSize(), sandbox: p.sandbox, contextIsolation: p.contextIsolation,
        nodeIntegration: p.nodeIntegration };
    });
    expect(report.desktop).toMatchObject({ packaged: true, minimumSize: [800, 600], sandbox: true, contextIsolation: true, nodeIntegration: false });
  } else {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  }
  page.setDefaultTimeout(30_000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.goto(`${origin}/signin`);
  await page.waitForLoadState("networkidle");
  if (page.url().includes("/signin")) {
    await page.getByLabel("Username", { exact: true }).fill(account.username);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/dashboard`, { timeout: 60_000 });
  }
  const routes = ["/dashboard", "/dashboard/myjobs", `/dashboard/myjobs/${account.jobId}`,
    "/dashboard/interviews", "/dashboard/tasks", "/dashboard/activities", "/dashboard/settings"];
  const matrix = process.argv.includes("--forms-only") ? [] : [[800,600,1], [1024,768,1], [1280,720,1], [1366,768,1], [1920,1080,1],
    [800,600,.8], [800,600,1.25], [800,600,1.5], [800,600,2]];
  for (const [width, height, zoom] of matrix) {
    await dimensions(width, height, zoom);
    for (const route of routes) {
      await page.goto(origin + route);
      await page.waitForLoadState("networkidle");
      if (["/dashboard/tasks", "/dashboard/myjobs", "/dashboard/activities"].includes(route)) {
        await page.getByRole("table").first().waitFor();
      }
      const size = await noPageOverflow(route);
      report.layouts.push({ requested: { width, height, zoom }, route, ...size });
      if (route === "/dashboard" && [800,1920].includes(width) && [1,2].includes(zoom)) {
        await page.screenshot({ path: path.join(artifacts, `responsive-${report.mode}-${width}-${zoom}.png`), fullPage: true });
      }
    }
    record(`${width}x${height}, ${zoom * 100}%: seven pages contained`);
  }
  await dimensions(1280, 720);
  await go("/dashboard");
  const sidebar = page.locator("#app-sidebar");
  const toggle = page.getByRole("button", { name: /^(Collapse|Expand) sidebar$/ });
  const originalLabel = await toggle.getAttribute("aria-label");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-label", originalLabel === "Collapse sidebar" ? "Expand sidebar" : "Collapse sidebar");
  await noPageOverflow("Collapsed/expanded sidebar");
  await expect(sidebar.getByRole("link", { name: "Jobs", exact: true })).toBeVisible();
  await toggle.click();
  record("Wide sidebar collapse/expand retains accessible core navigation");
  for (const zoom of [1, 2]) {
    await dimensions(800, 600, zoom);
    await go("/dashboard/myjobs");
    await page.getByRole("button", { name: "New Job", exact: true }).click();
    await page.getByLabel("Job Title", { exact: true }).click();
    await contained(page.getByRole("dialog").last(), "Job title picker fits");
    await page.keyboard.press("Escape");
    await page.getByLabel("Due Date", { exact: true }).click();
    await contained(page.getByRole("dialog").last(), "Date picker fits");
    await page.keyboard.press("Escape");
    await dialogControls();
    await go(`/dashboard/myjobs/${account.jobId}`);
    await page.getByTestId("job-details-edit-btn").click();
    await expect(page.getByLabel("Job Title", { exact: true })).not.toHaveText("Select Job Title");
    await dialogControls();
    await go("/dashboard/tasks");
    await page.getByTestId("add-task-btn").click();
    await dialogControls();
    await go("/dashboard/activities");
    await page.getByRole("button", { name: /New Activity/ }).click();
    await page.getByLabel("Start Time", { exact: true }).click();
    const timePicker = page.getByRole("dialog").filter({ has: page.getByRole("group", { name: "Hour", exact: true }) });
    await contained(timePicker, "Time picker fits");
    await page.keyboard.press("Escape");
    await expect(timePicker).toHaveCount(0);
    await dialogControls();
    if (account.resumeId) {
      await go(`/dashboard/profile/resume/${account.resumeId}`);
      await page.getByRole("button", { name: "Document actions" }).click();
      await page.getByRole("menuitem", { name: "Export to PDF" }).click();
      await dialogControls();
    }
    await go("/dashboard/settings");
    for (const name of ["API Keys", "Appearance", "Data", "AI Settings"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.waitForLoadState("networkidle");
      await noPageOverflow(`Settings ${name}`);
    }
    await page.getByRole("button", { name: "Toggle Menu", exact: true }).click();
    const sheet = page.getByRole("dialog");
    for (const name of ["Dashboard", "Jobs", "Interviews", "Tasks", "Activities"]) {
      await expect(sheet.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await sheet.getByRole("button", { name: /docs-|Account menu|User menu/ }).first().click();
    await expect(page.getByRole("menuitem", { name: /Logout/ })).toBeVisible();
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
    record(`Forms, pickers, settings and complete narrow navigation at ${zoom * 100}%`);
  }
  await dimensions(800, 600);
  await page.goto(`${origin}/dashboard`);
  const calendar = page.getByRole("region", { name: "Activity Calendar days" });
  await expect(calendar.locator("svg rect").first()).toBeVisible();
  const calendarSize = await calendar.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth,
    days: [...element.querySelectorAll("svg rect[x][y]")].filter(r => Number(r.getAttribute("width")) > 2 && Number(r.getAttribute("width")) < 30 && Number(r.getAttribute("height")) > 2)
      .map(r => ({ w: Number(r.getAttribute("width")), h: Number(r.getAttribute("height")) })) }));
  expect(calendarSize.scrollWidth).toBeGreaterThan(calendarSize.width);
  expect(calendarSize.days.length).toBeGreaterThanOrEqual(365);
  expect(calendarSize.days.every(day => Math.abs(day.w - day.h) < .1)).toBe(true);
  record("Activity Calendar retains square daily cells and local horizontal scrolling");
  await calendar.locator("svg rect[x][y][style]").nth(3).hover();
  const tooltip = page.getByRole("tooltip");
  await contained(tooltip, "First-week real-data tooltip is not clipped");
  await expect(tooltip).toContainText("1 job applied");
  await expect(tooltip).toContainText("0 hrs activity");
  await page.screenshot({ path: path.join(artifacts, `responsive-${report.mode}-heatmap.png`) });
  const labelsFit = await calendar.evaluate(element => {
    const region = element.getBoundingClientRect();
    return [...element.querySelectorAll("svg text")].every(text => {
      const r = text.getBoundingClientRect(); return r.top >= region.top && r.bottom <= region.bottom;
    });
  });
  expect(labelsFit, "Date labels and legend stay inside the scroll region vertically").toBe(true);
  record("Real application count, tooltip and date/legend placement");
  await dimensions(400 * 2, 300 * 2, 2);
  for (const route of ["/signup", "/migrate-account"]) {
    await page.goto(origin + route); await page.waitForLoadState("networkidle");
    await noPageOverflow(route);
    const submit = page.locator('button[type="submit"]').first();
    await submit.scrollIntoViewIfNeeded(); await contained(submit, `${route} submit accessible`);
  }
  record("Registration and legacy migration fit the narrow viewport");
  expect(report.errors).toEqual([]);
} catch (error) {
  if (page) {
    await page.screenshot({ path: path.join(artifacts, `responsive-${report.mode}-failure.png`), fullPage: true }).catch(() => {});
    await fs.writeFile(path.join(artifacts, `responsive-${report.mode}-failure.html`), await page.content()).catch(() => {});
  }
  throw error;
} finally {
  await fs.writeFile(path.join(artifacts, `responsive-${report.mode}${process.argv.includes("--forms-only") ? "-forms" : ""}.json`), JSON.stringify(report, null, 2));
  await browser?.close();
  if (app) {
    const closed = app.waitForEvent("close");
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.close())).catch(() => {});
    await closed;
  }
}
