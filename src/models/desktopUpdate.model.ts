export type DesktopUpdateState = {
  phase: "idle" | "unsupported" | "checking" | "available" | "up-to-date" | "no-release" | "downloading" | "downloaded" | "error";
  currentVersion: string;
  version?: string;
  percent?: number;
  message?: string;
};
export interface DesktopUpdates {
  getState(): Promise<DesktopUpdateState>;
  check(): Promise<DesktopUpdateState>;
  download(): Promise<DesktopUpdateState>;
  cancel(): Promise<DesktopUpdateState>;
  install(): Promise<DesktopUpdateState>;
  subscribe(callback: (state: DesktopUpdateState) => void): () => void;
}
declare global { interface Window { jobtrackUpdates?: DesktopUpdates; } }
