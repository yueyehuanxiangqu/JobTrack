import { z } from "zod";
import { AI_PROVIDERS } from "@/lib/ai/provider-registry";

export const MAX_JD_CHARS = 40_000;
export const autofillInputSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("url"), url: z.string().trim().url().max(2048) }).strict(),
  z.object({ source: z.literal("text"), text: z.string().trim().min(20, "Please paste a job description (at least 20 characters).").max(MAX_JD_CHARS) }).strict(),
]);
const name = z.string().trim().min(1).max(300).nullable();
export const extractedJobSchema = z.object({
  company: name, jobTitle: name, location: name,
  workplaceType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).nullable(),
  jobType: z.enum(["FT", "PT", "C"]).nullable(),
  jobUrl: z.string().max(2048).nullable(),
}).strict();
export type ExtractedJob = z.infer<typeof extractedJobSchema>;
export type AutofillResult = { fields: ExtractedJob; description: string };

export function parseExtractedJob(value: unknown): ExtractedJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid AI result");
  // Missing fields are unknown; extra fields and wrong types remain errors.
  return extractedJobSchema.parse({ company: null, jobTitle: null, location: null,
    workplaceType: null, jobType: null, jobUrl: null, ...value });
}

export function validApiBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
export const autofillConfigSchema = z.object({
  provider: z.enum(AI_PROVIDERS), model: z.string().trim().min(1).max(200),
  baseUrl: z.string().trim().max(2048).refine(v => !v || validApiBaseUrl(v), "Use an HTTP(S) Base URL without credentials, query or fragment."),
}).strict();
export type AutofillConfig = z.infer<typeof autofillConfigSchema>;

export function descriptionHtml(text: string): string {
  return "<p>" + text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\r?\n/g, "<br>") + "</p>";
}
