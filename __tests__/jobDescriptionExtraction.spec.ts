// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { extractJobDescription } from "@/lib/job-autofill/job-description";
const prose = "We are looking for a platform engineer to maintain our software systems and collaborate with the team.";
const fixture = (name: string) => fs.readFileSync(path.resolve("__tests__/fixtures/job-pages", name + ".html"), "utf8");
const script = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
it("prefers nested JobPosting and retains paragraph/list boundaries without page chrome", () => {
  const result = extractJobDescription(`<nav>Wrong role</nav>${script({"@graph":[{"@type":"JobPosting",title:"Engineer",hiringOrganization:{name:"Example"},description:`<p>${prose}</p><ul><li>Review code.</li><li>Test software.</li></ul>`}]})}`);
  expect(result.description).toBe(prose + "\n- Review code.\n- Test software."); expect(JSON.parse(result.context).hiringOrganization.name).toBe("Example");
});
it("chooses only the current posting by URL, not the first recommended role", () => {
  const jobs = [{"@type":"JobPosting",url:"https://jobs.example/other",title:"Sales",description:"Wrong role "+prose}, {"@type":"JobPosting",url:"https://jobs.example/current",title:"Engineer",description:prose}];
  expect(extractJobDescription(script(jobs),"text/html","https://jobs.example/current?ref=user#details").description).toBe(prose);
  expect(() => extractJobDescription(script(jobs),"text/html","https://jobs.example/list")).toThrow(/Ambiguous/);
});
it("supports a unique visible title match and repeated copies of the same JSON posting", () => {
  const job = {"@type":"JobPosting",title:"Engineer",description:prose};
  const other = {"@type":"JobPosting",title:"Sales",description:"Other "+prose};
  expect(extractJobDescription('<h1>Engineer</h1>'+script([other,job])).description).toBe(prose);
  expect(extractJobDescription(script(job)+script(job)).description).toBe(prose);
});
it("rejects schema data pointing at another role", () => {
  expect(() => extractJobDescription(script({"@type":"JobPosting",url:"https://jobs.example/other",description:prose}),"text/html","https://jobs.example/current")).toThrow();
});
it("uses one scoped JD despite malformed metadata, cookies and recommended jobs", () => {
  const result = extractJobDescription(script("invalid")+fixture("scoped"));
  expect(result.description).toContain("Develop and maintain"); expect(result.description).toContain("\n- Investigate");
  expect(result.description).not.toMatch(/Browse|cookies|Sales Manager|Recommended|Other engineering|Privacy|Log in/);
});
it("accepts a single-job semantic main with an explicit responsibilities section", () => {
  const result = extractJobDescription(fixture("semantic")); expect(result.description).toContain("Build production services"); expect(result.description).not.toContain("More vacancies");
});
it("never treats an entire body, generic main or multiple independent JDs as success", () => {
  for (const html of [fixture("ambiguous"), `<body>${prose}</body>`, `<main>${prose}</main>`, `<div class="job-description">${prose}</div><div class="job-description">Other ${prose}</div>`]) expect(() => extractJobDescription(html)).toThrow();
});
it("supports JobPosting JSON bodies", () => {
  expect(extractJobDescription(JSON.stringify({"@type":"JobPosting",description:prose}),"application/ld+json").description).toBe(prose);
});
it.each(["<main>Loading...</main>", `<div id="job-description">Sign in to view ${prose}</div>`, `<div id="job-description">Enable JavaScript ${prose}</div>`])("rejects dynamic/restricted content", html => expect(() => extractJobDescription(html)).toThrow());
it("rejects oversized content without silent truncation or full-page plain text fallback", () => {
  expect(() => extractJobDescription(`<div id="job-description">${"x".repeat(40001)}</div>`)).toThrow();
  expect(() => extractJobDescription(prose,"text/plain")).toThrow();
});
it("ignores generic meta description and uses a scoped DOM when JSON description is incomplete", () => {
  const html='<meta itemprop="description" content="Careers">'+script({"@type":"JobPosting",description:"Short teaser"})+fixture("scoped");
  expect(extractJobDescription(html).description).toContain("Develop and maintain");
});
it("strips camelCase recommended sections inside the job description", () => {
  expect(extractJobDescription(`<section id="job-description">${prose}<div class="recommendedJobs">UNRELATED ${prose}</div></section>`).description).toBe(prose);
});
it("does not merge independent descriptions inside a generic job-content wrapper", () => {
  expect(() => extractJobDescription(`<div class="job-content"><section class="job-description">${prose}</section><section class="job-description">Another ${prose}</section></div>`)).toThrow();
  expect(extractJobDescription(`<div class="job-content">Company promotion<section class="job-description">${prose}</section></div>`).description).toBe(prose);
});
