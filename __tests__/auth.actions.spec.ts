import { authenticate, signup, setLegacyUsername } from "@/actions/auth.actions";
import { signIn } from "@/auth";
import { registerAccount, migrateLegacyAccount } from "@/lib/auth/accounts";
import { AuthError } from "next-auth";
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth/accounts", () => ({ registerAccount: vi.fn(), migrateLegacyAccount: vi.fn() }));
vi.mock("@/utils/delay", () => ({ delay: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next-auth", () => {
  class AuthError extends Error { type: string; constructor(type: string) { super(type); this.type = type; } }
  return { AuthError };
});
beforeEach(() => vi.resetAllMocks());
it("sends username credentials to NextAuth without an email", async () => {
  const form = new FormData(); form.set("username", "local.user"); form.set("password", "fixture-password");
  expect(await authenticate(undefined, form)).toBeNull();
  expect(signIn).toHaveBeenCalledWith("credentials", { username: "local.user", password: "fixture-password", redirect: false });
});
it("returns an authentication error without reflecting submitted credentials", async () => {
  vi.mocked(signIn).mockRejectedValue(new AuthError("CredentialsSignin"));
  expect(await authenticate(undefined, new FormData())).toBe("Invalid username or password.");
});
it("uses the server-side registration validator", async () => {
  const input = { username: "local.user", password: "fixture-password" };
  vi.mocked(registerAccount).mockResolvedValue({ success: true });
  expect(await signup(input)).toEqual({ success: true });
  expect(registerAccount).toHaveBeenCalledWith(input);
});
it("uses the ownership-checked legacy migration", async () => {
  const input = { username: "local.user", email: "legacy@example.test", password: "fixture-password" };
  vi.mocked(migrateLegacyAccount).mockResolvedValue({ success: true });
  expect(await setLegacyUsername(input)).toEqual({ success: true });
  expect(migrateLegacyAccount).toHaveBeenCalledWith(input);
});
