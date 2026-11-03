import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { summaryHtml } from "@/models/jobAutofill.schema";

// Convert only a newly written/edited summary; untouched legacy HTML stays intact.
export function normalizeJobSummary(html: string): string {
  const blocks = new Set(["p", "div", "li", "ul", "ol", "br", "h1", "h2", "h3", "blockquote"]);
  function text(node: DefaultTreeAdapterMap["node"]): string {
    if ("tagName" in node && ["script", "style", "iframe", "img"].includes(node.tagName)) return "";
    if ("value" in node) return node.value;
    const children = "childNodes" in node ? node.childNodes.map(text).join("") : "";
    return "tagName" in node && blocks.has(node.tagName) ? `\n${children}\n` : children;
  }
  return summaryHtml(text(parseFragment(html)).split(/\r?\n/).map(line => line.trim().replace(/^[•*-]\s+/, "")).filter(Boolean));
}
