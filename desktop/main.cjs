const { app, BrowserWindow, session, shell, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { spawn, spawnSync } = require("node:child_process");
const { randomBytes, randomUUID } = require("node:crypto");
const { APP_ORIGIN, classifyUrl, permissionAllowed } = require("./security.cjs");
const brand = require("../branding/brand.json");
const { createUpdates, registerUpdates, CHANNEL } = require("./updates.cjs");
// desktop:start loads .desktop-build/app; development resources are its
// sibling web/runtime directories, not a nested app/.desktop-build directory.
const resourceBase = app.isPackaged ? process.resourcesPath : path.dirname(app.getAppPath());

// Loaded before ready so Chromium's cookies/cache also follow the native home.
const home = process.env.JOBTRACK_HOME || path.join(process.env.LOCALAPPDATA, brand.dataDirectory);
if (!path.isAbsolute(home)) throw new Error("JobTrack data directory must be absolute.");
app.setName(brand.name);
// Complete the copy before Chromium or the single-instance lock creates the
// destination. A separate bundled Node process can read asar-external files.
if (!process.env.JOBTRACK_HOME && fs.existsSync(path.join(process.env.LOCALAPPDATA, brand.legacyDataDirectory))) {
  const migration = spawnSync(path.join(resourceBase, "runtime/node.exe"), [path.join(resourceBase, "web/scripts/local/migrate-home.mjs"), "prepare"], { windowsHide: true, encoding: "utf8", timeout: 15 * 60_000 });
  if (migration.error || migration.status !== 0) {
    dialog.showErrorBox("JobTrack data migration", migration.stderr || migration.error?.message || "Migration could not finish. Original data was kept.");
    app.exit(1);
    throw new Error("Data migration did not finish; original data was kept.");
  }
}
app.setPath("userData", path.join(home, "config", "electron"));
app.setAppUserModelId(brand.appId);
let mainWindow, splash, child, state, paths, runtime, log;
let quitting = false;
let allowQuit = false;
let ready = false;
let childExited;
let release;
let startup;
let updates;
let installingUpdate = false;

async function unlock() {
  const action = release;
  release = null;
  if (action) await action();
}

function append(message) {
  if (log) fs.appendFileSync(log, `${new Date().toISOString()} ${message}\n`);
}

function splashWindow() {
  if (splash && !splash.isDestroyed()) return splash;
  splash = new BrowserWindow({
    width: 540, height: 350, resizable: false, autoHideMenuBar: true,
    title: "JobTrack", backgroundColor: "#f8fafc", show: false,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false },
  });
  splash.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  splash.webContents.on("will-navigate", (event) => event.preventDefault());
  splash.once("ready-to-show", () => { if (!quitting) splash.show(); });
  splash.on("close", (event) => { if (!allowQuit) { event.preventDefault(); void quit(); } });
  void splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

async function showFailure(error) {
  if (quitting) return;
  append(`ERROR ${error.stack || error}`);
  const window = splashWindow();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  if (window.webContents.isLoading()) await new Promise((resolve) => window.webContents.once("did-finish-load", resolve));
  if (window.isDestroyed() || quitting) return;
  const message = `${error.message}\n\nLog: ${log || path.join(home, "logs")}`;
  // Only our bundled static splash receives this text. No privileged preload.
  await window.webContents.executeJavaScript(`document.getElementById('status').textContent = ${JSON.stringify(message)}; document.getElementById('title').textContent = 'JobTrack could not start'; document.getElementById('close').hidden = false;`);
  window.show();
}

async function stopOwnedService() {
  if (!child?.pid || child.exitCode !== null) return;
  let requested = false;
  try { if (state) { await runtime.control(paths, state, "stop"); requested = true; } }
  catch (error) { append(`Control stop: ${error.message}`); }
  // During early startup the public control pipe may not exist yet. Closing
  // our native child IPC is persistent, unlike a one-shot message, and the
  // backend checks it before starting as well as watching disconnect events.
  if (!requested && child.connected) child.disconnect();
  const exited = await Promise.race([childExited.then(() => true), new Promise((resolve) => { const t = setTimeout(() => resolve(false), 65_000); t.unref(); })]);
  if (!exited && child.exitCode === null) {
    append("Grace period expired; terminating only the owned ChildProcess handle.");
    child.kill();
    await childExited;
  }
}

async function quit(installUpdate) {
  if (quitting) return;
  quitting = true;
  if (!installUpdate) updates?.cancel();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  if (splash && !splash.isDestroyed()) splash.hide();
  try {
    await stopOwnedService(); await startup?.catch(() => {});
    if (state && paths) {
      const recorded = await runtime.readJson(paths.state);
      if (recorded?.instanceId === state.instanceId) {
        try { await fs.promises.unlink(paths.state); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }
  }
  catch (error) { append(`Shutdown: ${error.stack || error}`); }
  finally {
    await unlock();
    allowQuit = true;
    if (installUpdate) installUpdate();
    else app.quit();
  }
}

function openExternal(url) {
  if (classifyUrl(url) === "external") void shell.openExternal(url).catch((error) => append(`External link: ${error.message}`));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 900, minWidth: 800, minHeight: 600,
    title: "JobTrack", autoHideMenuBar: true, backgroundColor: "#f8fafc", show: false,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, nodeIntegrationInWorker: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (classifyUrl(url) === "internal") void mainWindow.loadURL(url);
    else openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (classifyUrl(url) !== "internal") { event.preventDefault(); openExternal(url); }
  });
  mainWindow.webContents.on("will-redirect", (event, url) => { if (classifyUrl(url) !== "internal") event.preventDefault(); });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.webContents.on("render-process-gone", () => { append("Renderer exited unexpectedly."); void quit(); });
  mainWindow.on("close", (event) => { if (!allowQuit) { event.preventDefault(); void quit(); } });
  mainWindow.once("ready-to-show", () => {
    if (quitting) return;
    if (splash && !splash.isDestroyed()) splash.destroy();
    mainWindow.show(); mainWindow.focus(); ready = true;
  });
  void mainWindow.loadURL(APP_ORIGIN).catch((error) => {
    // A normal navigation can supersede the initial load after first paint.
    // Electron reports ERR_ABORTED; it is not a backend startup failure.
    if (quitting || error.code === "ERR_ABORTED" || error.errno === -3) return;
    void stopOwnedService().then(() => showFailure(error));
  });
}

async function start() {
  const base = resourceBase;
  runtime = await import(pathToFileURL(path.join(__dirname, "../scripts/local/runtime.mjs")).href);
  const shared = await import(pathToFileURL(path.join(__dirname, "../scripts/local/paths.mjs")).href);
  paths = shared.localPaths();
  fs.mkdirSync(paths.logs, { recursive: true });
  log = path.join(paths.logs, `desktop-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
  append(`Starting JobTrack ${app.getVersion()} (${process.arch})`);
  release = await runtime.acquireLock(paths, 15_000);
  try {
    if (quitting) return;
    // Do not adopt or stop a CMD-owned instance or another application.
    await runtime.assertPortFree();
    const settings = await runtime.ensureSettings(paths);
    const webRoot = path.join(base, "web");
    const node = path.join(base, "runtime", "node.exe");
    if (!fs.existsSync(node) || !fs.existsSync(path.join(webRoot, ".next-desktop/BUILD_ID"))) throw new Error("Desktop resources are missing. Reinstall JobTrack or rebuild the desktop package.");
    if (quitting) return;
    const instanceId = randomUUID();
    const token = randomBytes(32).toString("hex");
    const backendEnv = { ...runtime.runtimeEnv(paths, settings), JOBTRACK_DESKTOP: "1", JOBTRACK_INSTANCE_ID: instanceId, JOBTRACK_INSTANCE_TOKEN: token };
    delete backendEnv.NODE_OPTIONS;
    delete backendEnv.NODE_PATH;
    delete backendEnv.ELECTRON_RUN_AS_NODE;
    const fd = fs.openSync(log, "a");
    try {
      child = spawn(node, [path.join(webRoot, "scripts/local/server.mjs")], {
        cwd: webRoot, windowsHide: true, detached: false,
        env: backendEnv,
        stdio: ["ignore", fd, fd, "ipc"],
      });
      childExited = new Promise((resolve) => child.once("exit", (code) => { append(`Backend exited (${code}).`); resolve(); }));
      await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    } finally { fs.closeSync(fd); }
    state = { pid: child.pid, instanceId, token, projectRoot: webRoot, log, owner: "electron", parentPid: process.pid, startedAt: new Date().toISOString() };
    await runtime.writeJson(paths.state, state);
    await Promise.race([runtime.waitReady(paths, state), childExited.then(() => { throw new Error(`Internal service exited. See ${log}`); })]);
    if (quitting) return;
    createMainWindow();
    childExited.then(() => { if (ready && !quitting) void showFailure(new Error("The internal service stopped unexpectedly. Close and reopen JobTrack.")); });
  } catch (error) { await stopOwnedService(); throw error; }
  finally { await unlock(); }
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on("second-instance", () => {
    const window = mainWindow && !mainWindow.isDestroyed() ? mainWindow : splash;
    if (window && !window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  app.on("before-quit", (event) => { if (!allowQuit) { event.preventDefault(); void quit(); } });
  app.on("window-all-closed", () => { void quit(); });
  app.whenReady().then(async () => {
    const supported = app.isPackaged && process.platform === "win32";
    const sdk = supported ? require("electron-updater") : null;
    updates = createUpdates({
      updater: sdk?.autoUpdater, version: app.getVersion(), supported,
      cancellationToken: () => {
        const requireUpdater = require("node:module").createRequire(require.resolve("electron-updater"));
        return new (requireUpdater("builder-util-runtime").CancellationToken)();
      },
      notify: value => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(`${CHANNEL}:state`, value); },
      restart: async () => {
        const result = await dialog.showMessageBox(mainWindow, { type: "question", title: "Update JobTrack",
          message: "Restart JobTrack and install the downloaded update?",
          detail: "Save any open forms first. Your local accounts, jobs and documents will be kept.",
          buttons: ["Restart and install", "Cancel"], defaultId: 1, cancelId: 1 });
        if (result.response !== 0 || quitting) return;
        installingUpdate = true;
        await quit(() => sdk.autoUpdater.quitAndInstall(false, true));
      },
    });
    // A failed installer launch must not leave a hidden app with a stopped service.
    sdk?.autoUpdater.on("error", () => { if (installingUpdate) { dialog.showErrorBox("JobTrack update", "The update could not start. Reopen JobTrack and try again."); app.quit(); } });
    registerUpdates(ipcMain, () => mainWindow, updates);
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) =>
      callback(wc === mainWindow?.webContents && permissionAllowed(permission, details.requestingUrl)));
    session.defaultSession.setPermissionCheckHandler((wc, permission, origin) =>
      wc === mainWindow?.webContents && permissionAllowed(permission, origin));
    session.defaultSession.on("will-download", (_event, item) => {
      item.setSaveDialogOptions({ title: "Save JobTrack export", defaultPath: path.join(app.getPath("downloads"), path.basename(item.getFilename())) });
    });
    splashWindow();
    startup = start();
    try { await startup; } catch (error) { await showFailure(error); }
  }).catch((error) => { append(error.stack || String(error)); void quit(); });
}
