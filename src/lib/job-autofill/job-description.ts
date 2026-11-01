import { parse, parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { MAX_JD_CHARS } from "@/models/jobAutofill.schema";
type Node = DefaultTreeAdapterMap["node"];
const ignored = new Set(["script", "style", "noscript", "nav", "header", "footer", "svg", "form", "iframe"]);
function text(node: Node): string {
  if ("tagName" in node && ignored.has(node.tagName)) return "";
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(text).join(" ") : "";
}
function walk(node: Node, visit: (node: Node) => void) {
  visit(node); if ("childNodes" in node) node.childNodes.forEach(child => walk(child, visit));
}
const clean = (html: string) => text(parseFragment(html)).replace(/\s+/g, " ").trim();
function jobPosting(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (depth > 20 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const item of value) { const found = jobPosting(item, depth + 1); if (found) return found; } return; }
  const data = value as Record<string, unknown>;
  if ([data["@type"]].flat().includes("JobPosting") && typeof data.description === "string") return data;
  for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) { const found = jobPosting(data[key], depth + 1); if (found) return found; }
}
export function extractJobDescription(html: string, contentType = "text/html"): { description: string; context: string } {
  const scripts: string[] = [], main: Node[] = [], body: Node[] = [];
  const document = parse(html);
  walk(document, node => {
    if (!("tagName" in node)) return;
    if (node.tagName === "script" && node.attrs.some(a => a.name === "type" && a.value.toLowerCase() === "application/ld+json")) {
      scripts.push(node.childNodes.map(n => "value" in n ? n.value : "").join(""));
    }
    if (["main", "article"].includes(node.tagName)) main.push(node);
    if (node.tagName === "body") body.push(node);
  });
  if (/application\/(ld\+json|json)/i.test(contentType)) scripts.unshift(html);
  for (const script of scripts) {
    try {
      const posting = jobPosting(JSON.parse(script));
      if (posting) {
        const description = clean(posting.description as string);
        if (description.length < 20) continue;
        // Keep the original JD prose. Metadata supplies explicit context only;
        // it never becomes executable instructions or a second URL to fetch.
        const context = { ...posting }; delete context.description;
        const metadata = JSON.stringify(context);
        if (metadata.length > 8000 || description.length + metadata.length > MAX_JD_CHARS) throw new Error("Job description is too long.");
        return { description, context: metadata };
      }
    } catch (error) { if (error instanceof Error && error.message === "Job description is too long.") throw error; }
  }
  if (/application\/(ld\+json|json)/i.test(contentType)) throw new Error("No JobPosting data.");
  const content = /text\/plain/i.test(contentType) ? html.trim() :
    (main.length ? main : body.length ? body : [document]).map(text).join(" ").replace(/\s+/g, " ").trim();
  if (content.length < 80 || /access denied|just a moment|sign in to (?:continue|view)|enable javascript|checking your browser|captcha/i.test(content)) throw new Error("No readable job description.");
  if (content.length > MAX_JD_CHARS) throw new Error("Job description is too long.");
  return { description: content, context: "" };
}
