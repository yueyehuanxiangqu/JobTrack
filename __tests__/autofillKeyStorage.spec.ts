// @vitest-environment node
const mocks = vi.hoisted(() => ({ user: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), remove: vi.fn() }));
vi.mock("@/actions/shared", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/db", () => ({ default: { apiKey: { findMany: mocks.findMany, upsert: mocks.upsert, deleteMany: mocks.remove } } }));
import { getUserApiKeys, saveApiKey, deleteApiKey } from "@/actions/apiKey.actions";
import { decrypt } from "@/lib/encryption";
beforeEach(() => {
  mocks.user.mockResolvedValue({ id: "owner" }); vi.stubEnv("ENCRYPTION_KEY", "isolated-key-storage-test-fixture");
  mocks.upsert.mockImplementation(async args => ({ id: "key", ...args.create, createdAt: new Date(), lastUsedAt: null }));
});
afterEach(() => vi.unstubAllEnvs());
it("encrypts keys per owner/provider and never returns ciphertext or plaintext", async () => {
  const saved = await saveApiKey({ provider: "custom", key: "fixture-private-key", sensitive: true });
  expect(saved.success).toBe(true);
  const args = mocks.upsert.mock.calls[0][0];
  expect(args.where).toEqual({ userId_provider: { userId: "owner", provider: "custom" } });
  expect(args.create.encryptedKey).not.toBe("fixture-private-key");
  expect(decrypt(args.create.encryptedKey, args.create.iv)).toBe("fixture-private-key");
  expect(JSON.stringify(saved)).not.toContain("fixture-private-key"); expect(saved.data?.last4).toBe("-key");
});
it("does not disclose legacy plaintext cloud credentials in key metadata", async () => {
  mocks.findMany.mockResolvedValue([{ id: "legacy", provider: "openai", encryptedKey: "old-private-key", iv: "", last4: "old-private-key" }]);
  const metadata = await getUserApiKeys(); expect(metadata.data?.[0].last4).toBe("-key");
  expect(JSON.stringify(metadata)).not.toContain("old-private-key");
});
it("does not allow a cloud key to opt out of encryption and deletes only the selected provider", async () => {
  const warning = vi.spyOn(console, "error").mockImplementation(() => {});
  try { expect((await saveApiKey({ provider: "gemini", key: "private", sensitive: false })).success).toBe(false); }
  finally { warning.mockRestore(); }
  expect(mocks.upsert).not.toHaveBeenCalled();
  await deleteApiKey("custom"); expect(mocks.remove).toHaveBeenCalledWith({ where: { userId: "owner", provider: "custom" } });
});
