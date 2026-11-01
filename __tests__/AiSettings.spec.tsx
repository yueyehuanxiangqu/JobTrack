import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AiSettings from "@/components/settings/AiSettings";
const mocks = vi.hoisted(() => ({ settings: vi.fn(), keys: vi.fn(), saveKey: vi.fn(), remove: vi.fn(), save: vi.fn() }));
vi.mock("@/actions/userSettings.actions", () => ({ getUserSettings: mocks.settings }));
vi.mock("@/actions/apiKey.actions", () => ({ getUserApiKeys: mocks.keys, saveApiKey: mocks.saveKey, deleteApiKey: mocks.remove }));
vi.mock("@/actions/jobAutofill.actions", () => ({ saveAutofillConfiguration: mocks.save }));
beforeEach(() => {
  mocks.settings.mockResolvedValue({ success: true, data: { settings: { ai: { provider: "openai", model: "entered-model", profiles: { gemini: { model: "saved-gemini" } } } } } });
  mocks.keys.mockResolvedValue({ success: true, data: [{ provider: "openai", last4: "1234" }, { provider: "gemini", last4: "5678" }] });
  mocks.saveKey.mockResolvedValue({ success: true, data: { provider: "openai", last4: "9999" } }); mocks.save.mockResolvedValue({ success: true }); mocks.remove.mockResolvedValue({ success: true });
  Element.prototype.hasPointerCapture = () => false; Element.prototype.setPointerCapture = () => {}; Element.prototype.releasePointerCapture = () => {}; Element.prototype.scrollIntoView = () => {};
});
afterEach(() => vi.unstubAllGlobals());
async function open() { render(<AiSettings />); await screen.findByLabelText("Model"); }
async function provider(name: string) { fireEvent.keyDown(screen.getByLabelText("Select AI provider"), { key: "Enter" }); fireEvent.click(await screen.findByRole("option", { name })); }
it("keeps keys hidden, saves encrypted updates and only sends configuration to its settings action", async () => {
  await open(); expect(screen.getByLabelText("API Key")).toHaveAttribute("type", "password"); expect(screen.getByLabelText("API Key")).toHaveValue("");
  await userEvent.type(screen.getByLabelText("API Key"), "new-fixture-key");
  await userEvent.click(screen.getByRole("button", { name: "Save AI Settings" }));
  await screen.findByText("AI Settings saved.");
  expect(mocks.saveKey).toHaveBeenCalledWith({ provider: "openai", key: "new-fixture-key", sensitive: true });
  expect(JSON.stringify(mocks.save.mock.calls)).not.toContain("new-fixture-key");
  expect(screen.getByLabelText("API Key")).toHaveValue("");
});
it("isolates credentials and keeps per-provider model drafts on switching", async () => {
  await open(); await userEvent.type(screen.getByLabelText("API Key"), "unsaved-private-key");
  await provider("Google Gemini"); expect(screen.getByLabelText("API Key")).toHaveValue(""); expect(screen.getByLabelText("Model")).toHaveValue("saved-gemini");
  await userEvent.click(screen.getByRole("button", { name: "Delete API Key" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("gemini"));
  await provider("OpenAI"); expect(screen.getByLabelText("Model")).toHaveValue("entered-model"); expect(screen.getByText("Stored key: ••••1234")).toBeVisible();
});
it("supports manual custom model/base URL and clear connection errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Model not available. Check Model and Base URL." }) }));
  await open(); await provider("Custom / OpenAI-compatible API");
  await userEvent.type(screen.getByLabelText("Model"), "any-provider-model"); await userEvent.type(screen.getByLabelText("Base URL"), "http://localhost:4999/v1");
  await userEvent.click(screen.getByRole("button", { name: "Test Connection" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Model not available"); expect(screen.getByLabelText("Model")).toHaveValue("any-provider-model");
});
