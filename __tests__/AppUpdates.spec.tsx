import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppUpdates from "@/components/settings/AppUpdates";
import type { DesktopUpdateState } from "@/models/desktopUpdate.model";
const idle: DesktopUpdateState = { phase: "idle", currentVersion: "0.1.1" };
afterEach(() => { delete window.jobtrackUpdates; });
it("does not check or download on mount, then supports explicit check/download/restart", async () => {
  let listener!: (s: DesktopUpdateState) => void;
  const api = { getState: vi.fn().mockResolvedValue(idle), check: vi.fn().mockResolvedValue({ ...idle, phase: "available", version: "0.1.2" }), download: vi.fn().mockResolvedValue({ ...idle, phase: "downloaded", version: "0.1.2" }), cancel: vi.fn(), install: vi.fn().mockResolvedValue({ ...idle, phase: "downloaded", version: "0.1.2" }), subscribe: vi.fn(cb => { listener = cb; return vi.fn(); }) };
  window.jobtrackUpdates = api;
  const user = userEvent.setup(); render(<AppUpdates />); await waitFor(() => expect(api.getState).toHaveBeenCalledOnce());
  expect(api.check).not.toHaveBeenCalled(); expect(api.download).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Check for updates" })); await user.click(await screen.findByRole("button", { name: "Download update" }));
  expect(await screen.findByText(/ready to install/)).toBeVisible(); expect(api.install).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Restart and install" })); expect(api.install).toHaveBeenCalledOnce();
  act(() => listener({ ...idle, phase: "no-release" })); expect(screen.getByRole("status")).toHaveTextContent("No Windows update");
});
it("shows progress, allows cancellation and displays safe failure messages", async () => {
  let listener!: (s: DesktopUpdateState) => void;
  const api = { getState: vi.fn().mockResolvedValue({ ...idle, phase: "downloading", percent: 42 }), check: vi.fn(), download: vi.fn(), cancel: vi.fn().mockResolvedValue(idle), install: vi.fn(), subscribe: vi.fn(cb => { listener = cb; return vi.fn(); }) };
  window.jobtrackUpdates = api; render(<AppUpdates />); expect(await screen.findByRole("progressbar")).toHaveAttribute("value", "42");
  await userEvent.click(screen.getByRole("button", { name: "Cancel download" })); expect(api.cancel).toHaveBeenCalledOnce();
  act(() => listener({ ...idle, phase: "error", message: "Update verification failed." })); expect(screen.getByRole("alert")).toHaveTextContent("verification failed");
});
it("explains the one-time upgrade when the desktop bridge is absent", () => {
  render(<AppUpdates />); expect(screen.getByText(/one-time manual upgrade/)).toBeVisible(); expect(screen.queryByRole("button")).toBeNull();
});
