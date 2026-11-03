// @vitest-environment node
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ default: { request: mocks.request } }));
vi.mock("node:https", () => ({ default: { request: mocks.request } }));
import { fetchPublicPage, publicDestination, publicPageUrl, isPublicAddress, MAX_PAGE_BYTES } from "@/lib/job-autofill/public-page";
let responses: { status?: number; headers?: Record<string,string>; body?: string }[];
beforeEach(() => {
  responses = [{ body: "public HTML" }];
  mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mocks.request.mockImplementation((_url, _options, callback) => {
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    request.end = () => {
      const fixture = responses.shift()!;
      const stream = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string,string> };
      stream.statusCode = fixture.status ?? 200;
      stream.headers = { "content-type": "text/html; charset=utf-8", ...fixture.headers };
      callback(stream); if (!stream.destroyed) stream.end(fixture.body ?? "");
    }; return request;
  });
});
it.each(["http://127.0.0.1", "http://2130706433", "http://0x7f000001", "http://[::1]", "http://[::ffff:127.0.0.1]", "http://169.254.169.254", "http://10.0.0.1", "http://100.64.0.1", "http://198.18.0.1", "https://printer.local", "http://localhost", "file:///etc/passwd", "http://a:b@example.com", "https://example.com:3737"])("blocks non-public URL %s", value => {
  expect(() => publicPageUrl(value)).toThrow();
});
it("classifies IPv4/IPv6 public and reserved ranges", () => {
  expect(isPublicAddress("8.8.8.8")).toBe(true); expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  for (const ip of ["192.0.2.1", "2001:db8::1", "::ffff:10.1.2.3", "fc00::1"]) expect(isPublicAddress(ip)).toBe(false);
});
it("pins the validated address and sends no site cookies or credentials", async () => {
  await expect(fetchPublicPage("https://example.com/job")).resolves.toMatchObject({ text: "public HTML" });
  const options = mocks.request.mock.calls[0][1], callback = vi.fn();
  options.lookup("example.com", {}, callback);
  expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  expect(options.headers).not.toHaveProperty("Cookie"); expect(options.headers).not.toHaveProperty("Authorization");
});
it("rejects mixed DNS responses and a redirect into an internal network", async () => {
  mocks.lookup.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }, { address: "10.1.2.3", family: 4 }]);
  await expect(fetchPublicPage("https://example.com/job")).rejects.toThrow(); expect(mocks.request).not.toHaveBeenCalled();
  responses = [{ status: 302, headers: { location: "http://127.0.0.1/private" } }];
  await expect(fetchPublicPage("https://example.com/job")).rejects.toThrow(); expect(mocks.request).toHaveBeenCalledTimes(1);
});
it("revalidates DNS on redirects and limits redirect chains", async () => {
  responses = [{ status: 302, headers: { location: "https://other.example/job" } }];
  mocks.lookup.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }]).mockResolvedValueOnce([{ address: "192.168.1.1", family: 4 }]);
  await expect(fetchPublicPage("https://example.com/job")).rejects.toThrow();
  responses = Array.from({ length: 4 }, () => ({ status: 302, headers: { location: "/again" } }));
  await expect(fetchPublicPage("https://example.com/job")).rejects.toThrow();
});
it.each([{ status: 403 }, { headers: { "content-type": "application/octet-stream" } }, { body: "x".repeat(MAX_PAGE_BYTES + 1) }])("rejects denied, non-text and oversized responses", async fixture => {
  responses = [fixture]; await expect(fetchPublicPage("https://example.com/job")).rejects.toThrow();
});
it("bounds a DNS lookup with the request abort signal", async () => {
  mocks.lookup.mockReturnValueOnce(new Promise(() => {})); const controller = new AbortController();
  const result = publicDestination(new URL("https://example.com"), controller.signal); controller.abort();
  await expect(result).rejects.toThrow();
});
it("returns only the revalidated final URL after a public redirect", async () => {
  responses=[{status:302,headers:{location:"https://careers.example/current"}},{body:"public HTML"}];
  expect((await fetchPublicPage("https://example.com/short")).url).toBe("https://careers.example/current");
  expect(mocks.lookup).toHaveBeenCalledTimes(2);
});
