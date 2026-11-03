import { normalizeJobSummary } from "@/lib/job-summary";
import { summaryHtml, parseExtractedJob } from "@/models/jobAutofill.schema";
it("stores real list items, removes exact duplicates and escapes AI markup", () => {
  const html = summaryHtml(["Develop Azure services.","Develop Azure services.","Review <script>alert(1)</script> & test."]);
  expect(html).toBe("<ul><li><p>Develop Azure services.</p></li><li><p>Review &lt;script&gt;alert(1)&lt;/script&gt; &amp; test.</p></li></ul>");
});
it("normalizes newly edited paragraphs/line breaks and remains stable on reopening", () => {
  const html = normalizeJobSummary("<p>First duty</p><p>Second duty<br>Third duty</p>");
  expect(html.match(/<li>/g)).toHaveLength(3); expect(normalizeJobSummary(html)).toBe(html);
});
it("does not execute or retain raw HTML scripts and handles empty summaries", () => {
  expect(normalizeJobSummary('<script>alert(1)</script><p></p>')).toBe(""); expect(summaryHtml([])).toBe("");
});
it("allows fewer points for sparse JDs but rejects more than six or non-string/multiline items", () => {
  expect(parseExtractedJob({summary:["Maintain services."]}).summary).toHaveLength(1);
  for (const summary of [Array(7).fill("Maintain services."),[4],["First\nSecond"],null]) expect(()=>parseExtractedJob({summary})).toThrow();
});
