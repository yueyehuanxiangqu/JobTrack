"use client";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import type { DesktopUpdateState, DesktopUpdates } from "@/models/desktopUpdate.model";
import packageJson from "../../../package.json";

export default function AppUpdates() {
  const [bridge, setBridge] = useState<DesktopUpdates>();
  const [state, setState] = useState<DesktopUpdateState>({ phase: "idle", currentVersion: packageJson.version });
  const [installing, setInstalling] = useState(false);
  useEffect(() => {
    const api = window.jobtrackUpdates;
    if (!api) return;
    setBridge(api);
    let active = true;
    const apply = (next: DesktopUpdateState) => { if (active) setState(next); };
    const unsubscribe = api.subscribe(apply);
    api.getState().then(apply).catch(() => apply({ phase: "error", currentVersion: packageJson.version, message: "Could not read update status. Reopen JobTrack and try again." }));
    return () => { active = false; unsubscribe(); };
  }, []);
  async function run(action: "check" | "download" | "cancel" | "install") {
    if (!bridge) return;
    if (action === "install") setInstalling(true);
    try { setState(await bridge[action]()); }
    catch { setState({ phase: "error", currentVersion: packageJson.version, message: "Update action failed. Reopen JobTrack and try again." }); }
    finally { setInstalling(false); }
  }
  const unsupported = !bridge || state.phase === "unsupported";
  const busy = state.phase === "checking" || state.phase === "downloading" || installing;
  return <section aria-label="App Updates" className="min-w-0 space-y-4 rounded-lg border p-4">
    <div><h3 className="font-semibold">App Updates</h3><p className="text-sm text-muted-foreground">Installed version: v{state.currentVersion}</p></div>
    {unsupported ? <p className="text-sm text-muted-foreground">In-app updates are available in the installed Windows desktop application. Versions before 0.1.1 need a one-time manual upgrade.</p> : <>
      <p role={state.phase === "error" ? "alert" : "status"} className="text-sm [overflow-wrap:anywhere]">
        {state.message || ({ idle: "Check for a new Windows release when you are ready.", checking: "Checking for updates...", available: `Version ${state.version} is available.`, "up-to-date": "You are using the latest published version.", "no-release": "No Windows update has been published yet.", downloading: `Downloading update: ${Math.floor(state.percent ?? 0)}%`, downloaded: `Version ${state.version} is ready to install. Save your work before restarting.`, error: "Unable to complete the update." } as Partial<Record<DesktopUpdateState["phase"], string>>)[state.phase]}
      </p>
      {state.phase === "downloading" && <progress aria-label="Update download progress" className="w-full" max={100} value={state.percent ?? 0} />}
      <div className="flex flex-wrap gap-2">
        {!["downloaded", "downloading"].includes(state.phase) && <Button type="button" variant="outline" disabled={busy} onClick={() => void run("check")}>Check for updates</Button>}
        {state.phase === "available" && <Button type="button" onClick={() => void run("download")}>Download update</Button>}
        {state.phase === "downloading" && <Button type="button" variant="outline" onClick={() => void run("cancel")}>Cancel download</Button>}
        {state.phase === "downloaded" && <Button type="button" disabled={installing} onClick={() => void run("install")}>{installing ? "Preparing update..." : "Restart and install"}</Button>}
      </div>
      <p className="text-xs text-muted-foreground">Downloads start only when you choose. Changed blocks are downloaded when available; a full download may be needed. Closing JobTrack normally does not install a pending update. Your local accounts and documents are kept.</p>
    </>}
  </section>;
}
