import { extractJobDescription } from "@/lib/job-autofill/job-description";
const prose = "We are looking for a platform engineer to maintain our software systems and collaborate with the team.";
it("prefers nested JobPosting metadata and preserves its original description", () => {
  const html = `<nav>Ignore this job title</nav><script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "JobPosting", title: "Engineer", hiringOrganization: { name: "Example" }, description: `<p>${prose}</p>` }] })}</script>`;
  const result = extractJobDescription(html);
  expect(result.description).toBe(prose); expect(JSON.parse(result.context).hiringOrganization.name).toBe("Example");
});
it("uses visible main text when metadata is malformed, without executing scripts", () => {
  const result = extractJobDescription(`<script type="application/ld+json">bad json</script><script>stealKeys()</script><nav>Navigation</nav><main>${prose}</main>`);
  expect(result).toEqual({ description: prose, context: "" });
});
it("supports JobPosting JSON bodies", () => {
  expect(extractJobDescription(JSON.stringify({ "@type": "JobPosting", description: prose }), "application/ld+json").description).toBe(prose);
});
it.each(["<main>Loading...</main>", "<body>Sign in to view " + prose + "</body>", "<main>Enable JavaScript " + prose + "</main>"])("rejects unreadable or restricted pages", html => {
  expect(() => extractJobDescription(html)).toThrow();
});
it("does not silently truncate an oversized JD", () => { expect(() => extractJobDescription("x".repeat(40_001), "text/plain")).toThrow(); });
