// Privileged update operations stay in Electron's main process. The renderer
// can request a fixed set of actions, never a URL, path, command or feed.
const { APP_ORIGIN } = require("./security.cjs");
const CHANNEL = "jobtrack:update";
function trustedSender(event, window) {
  try {
    return !!window && !window.isDestroyed() && event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame && new URL(event.senderFrame.url).origin === APP_ORIGIN;
  } catch { return false; }
}
function failure(error) {
  if (["ERR_UPDATER_NO_PUBLISHED_VERSIONS", "ERR_UPDATER_LATEST_VERSION_NOT_FOUND"].includes(error?.code)) {
    return { phase: "no-release", message: "No Windows update has been published yet." };
  }
  if (error?.code === "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") return { phase: "error", message: "The published release is missing update files. Please try again later." };
  if (error?.code === "ERR_CHECKSUM_MISMATCH" || error?.code === "ERR_UPDATER_INVALID_SIGNATURE") return { phase: "error", message: "Update verification failed. Nothing was installed. Check for updates to try again." };
  return { phase: "error", message: "Unable to complete the update. Check your connection and try again. Nothing was installed." };
}
function createUpdates({ updater, version, supported, notify = () => {}, cancellationToken, restart }) {
  let state = { phase: supported ? "idle" : "unsupported", currentVersion: version };
  let token, checking = false, downloading = false, restarting = false;
  const set = change => { state = { currentVersion: version, ...change }; notify({ ...state }); };
  const snapshot = () => ({ ...state });
  if (updater) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.autoRunAppAfterInstall = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.disableDifferentialDownload = false;
    // Do not expose provider errors, URLs or downloaded paths in UI/logs.
    updater.logger = { info() {}, warn() {}, error() {}, debug() {} };
    updater.on("update-available", info => set({ phase: "available", version: String(info.version).slice(0, 100) }));
    updater.on("update-not-available", () => set({ phase: "up-to-date" }));
    updater.on("download-progress", info => {
      if (downloading && !token?.cancelled) set({ phase: "downloading", version: state.version, percent: Math.max(0, Math.min(100, Number(info.percent) || 0)) });
    });
    updater.on("update-downloaded", info => { if (!token?.cancelled) set({ phase: "downloaded", version: String(info.version).slice(0, 100) }); });
    updater.on("error", error => { if (!token?.cancelled) set(failure(error)); });
  }
  return {
    snapshot,
    async check() {
      if (!supported || checking || downloading || restarting || state.phase === "downloaded") return snapshot();
      checking = true; set({ phase: "checking" });
      try { await updater.checkForUpdates(); } catch (error) { set(failure(error)); }
      finally { checking = false; }
      return snapshot();
    },
    async download() {
      if (!supported || state.phase !== "available" || downloading || checking) return snapshot();
      downloading = true; token = cancellationToken();
      set({ phase: "downloading", version: state.version, percent: 0 });
      try { await updater.downloadUpdate(token); }
      catch (error) { if (!token.cancelled) set(failure(error)); }
      finally { downloading = false; }
      return snapshot();
    },
    cancel() {
      if (downloading) { token.cancel(); set({ phase: "idle", message: "Download cancelled. Nothing was installed." }); }
      return snapshot();
    },
    async install() {
      if (!supported || state.phase !== "downloaded" || restarting) return snapshot();
      restarting = true;
      try { await restart(); } catch { set({ phase: "error", message: "Could not start installation. Close and reopen JobTrack before trying again." }); }
      finally { restarting = false; }
      return snapshot();
    },
  };
}
function registerUpdates(ipcMain, window, updates) {
  const methods = { state: "snapshot", check: "check", download: "download", cancel: "cancel", install: "install" };
  for (const [action, method] of Object.entries(methods)) ipcMain.handle(`${CHANNEL}:${action}`, (event, ...args) => {
    if (!trustedSender(event, window()) || args.length) throw new Error("Update request denied.");
    return updates[method]();
  });
}
module.exports = { CHANNEL, createUpdates, registerUpdates, trustedSender };
