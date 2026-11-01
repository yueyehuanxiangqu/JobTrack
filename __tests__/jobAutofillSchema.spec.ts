import { parseExtractedJob, autofillConfigSchema, autofillInputSchema, descriptionHtml } from "@/models/jobAutofill.schema";
it("normalizes missing fields to null without inventing values", () => {
  expect(parseExtractedJob({ company: "Example" })).toEqual({ company: "Example", jobTitle: null, location: null, workplaceType: null, jobType: null, jobUrl: null });
});
it.each([{ company: 2 }, { jobType: "Internship" }, { workplaceType: "REMOTE_OR_HYBRID" }, { matchScore: 99 }, [], null])("rejects invalid extraction data", value => {
  expect(() => parseExtractedJob(value)).toThrow();
});
it("rejects empty JD and unsafe API URL formats", () => {
  expect(autofillInputSchema.safeParse({ source: "text", text: "" }).success).toBe(false);
  for (const baseUrl of ["file:///tmp", "https://user:password@example.com", "https://example.com?key=secret"]) {
    expect(autofillConfigSchema.safeParse({ provider: "custom", model: "user-model", baseUrl }).success).toBe(false);
  }
});
it("escapes source prose without rewriting it or introducing executable markup", () => {
  expect(descriptionHtml('Original <img src=x>\nCompany & role')).toBe('<p>Original &lt;img src=x&gt;<br>Company &amp; role</p>');
});
