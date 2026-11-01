// @vitest-environment node
const user = vi.hoisted(() => vi.fn());
vi.mock("@/actions/shared", () => ({ requireUser: user }));
import { aiRequest } from "@/lib/job-autofill/http";
beforeEach(() => user.mockResolvedValue({ id: "owner" }));
const request = (body: string) => new Request("http://localhost/api/jobs/autofill", { method: "POST", body });
it("requires an authenticated owner", async () => {
  user.mockRejectedValueOnce(new Error("Not authenticated")); const work = vi.fn();
  expect((await aiRequest(request("{}"), work)).status).toBe(401); expect(work).not.toHaveBeenCalled();
});
it("rejects malformed and oversized request bodies", async () => {
  const work = vi.fn();
  expect((await aiRequest(request("not json"), work)).status).toBe(400);
  expect((await aiRequest(request("x".repeat(256001)), work)).status).toBe(413);
  expect(work).not.toHaveBeenCalled();
});
it("prevents overlapping requests, releases the lock, and redacts raw provider errors", async () => {
  let release!: () => void;
  const first = aiRequest(request("{}"), () => new Promise(resolve => { release = () => resolve({ success: true }); }));
  await vi.waitFor(() => expect(release).toBeDefined());
  expect((await aiRequest(request("{}"), vi.fn())).status).toBe(429);
  release(); expect((await first).status).toBe(200);
  const failed = await aiRequest(request("{}"), async () => { throw new Error("Authorization: secret key and private JD"); });
  expect(await failed.text()).not.toMatch(/secret key|private JD/);
  expect((await aiRequest(request("{}"), async () => ({ success: true }))).status).toBe(200);
});
