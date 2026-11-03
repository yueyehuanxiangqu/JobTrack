import { parse, parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { MAX_JD_CHARS } from "@/models/jobAutofill.schema";
type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
const ignored = new Set(["script", "style", "noscript", "nav", "header", "footer", "aside", "svg", "form", "iframe", "button", "dialog"]);
const blocks = new Set(["p", "div", "section", "article", "main", "h1", "h2", "h3", "h4", "ul", "ol", "li", "br"]);
const noise = /(?:^|[\s_-])(?:cookie|consent|recommend(?:ed|ations)?|related|similar|newsletter|breadcrumb|login|sign[-_]?in|share|job[-_]?(?:cards?|results?|listings?))(?:[\s_-]|$)/i;
const duties = /responsibilities|your (?:role|impact)|what you(?: will|'ll) do|job description|about (?:the|this) role|duties|verantwoordelijkheden|wat ga je doen|functieomschrijving|over de functie/i;
const blocked = /access denied|just a moment|sign in to (?:continue|view)|enable javascript|checking your browser|captcha/i;
function attr(node: Element, name: string) { return node.attrs.find(a => a.name === name)?.value ?? ""; }
function excluded(node: Element) {
  return ignored.has(node.tagName) || node.attrs.some(a => a.name === "hidden" || a.name === "aria-hidden" && a.value === "true") ||
    /^(?:navigation|banner|contentinfo|dialog)$/.test(attr(node, "role")) || noise.test(["id", "class", "data-testid", "data-automation-id", "aria-label"].map(a => attr(node, a)).join(" ").replace(/([a-z])([A-Z])/g, "$1 $2"));
}
function text(node: Node): string {
  if ("tagName" in node && excluded(node)) return "";
  if ("value" in node) return node.value;
  const value = "childNodes" in node ? node.childNodes.map(text).join("") : "";
  return "tagName" in node && blocks.has(node.tagName) ? `\n${node.tagName === "li" ? "- " : ""}${value}\n` : value;
}
function walk(node: Node, visit: (node: Node) => void, visible = false) {
  if (visible && "tagName" in node && excluded(node)) return;
  visit(node); if ("childNodes" in node) node.childNodes.forEach(child => walk(child, visit, visible));
}
const clean = (node: Node) => text(node).split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
function postings(value: unknown, found: Record<string, unknown>[], depth = 0) {
  if (depth > 20 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach(item => postings(item, found, depth + 1)); return; }
  const data = value as Record<string, unknown>;
  if ([data["@type"]].flat().some(t => typeof t === "string" && /(?:^|\/)JobPosting$/.test(t)) && typeof data.description === "string") found.push(data);
  for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) postings(data[key], found, depth + 1);
}
function identity(value: unknown, base?: string) {
  if (typeof value !== "string" || !base) return "";
  try { const url = new URL(value, base); url.hash = ""; for (const key of [...url.searchParams.keys()]) if (/^(?:utm_.*|ref)$/.test(key)) url.searchParams.delete(key); url.searchParams.sort(); return url.href.replace(/\/$/, ""); } catch { return ""; }
}
function reliable(description: string) {
  if (description.length < 80 || blocked.test(description)) throw new Error("No reliably identified job description.");
  if (description.length > MAX_JD_CHARS) throw new Error("Job description is too long.");
  return description;
}
function contains(parent: Node, child: Node): boolean {
  let current: Node | undefined = child;
  while (current && "parentNode" in current) { if (current.parentNode === parent) return true; current = current.parentNode ?? undefined; }
  return false;
}
export function extractJobDescription(html: string, contentType = "text/html", pageUrl?: string): { description: string; context: string } {
  const document = parse(html), jobs: Record<string, unknown>[] = [], explicit: Element[] = [], semantic: Element[] = [], headings: string[] = [];
  if (/application\/(ld\+json|json)/i.test(contentType)) { try { postings(JSON.parse(html), jobs); } catch { /* no valid structured data */ } }
  else walk(document, node => {
    if (!("tagName" in node) || node.tagName !== "script" || attr(node, "type").toLowerCase() !== "application/ld+json") return;
    try { postings(JSON.parse(node.childNodes.map(n => "value" in n ? n.value : "").join("")), jobs); } catch { /* try visible, scoped JD */ }
  });
  walk(document, node => {
    if (!("tagName" in node)) return;
    if (node.tagName === "h1") headings.push(clean(node).toLowerCase());
    const labels = ["id", "class", "data-testid", "data-automation-id"].map(a => attr(node, a)).join(" ");
    if ((attr(node, "itemprop").split(/\s+/).includes("description") || /(?:job|position|vacancy)[-_\s]?(?:posting[-_\s]?)?(?:description|details|content)\b/i.test(labels)) && clean(node).length >= 80) explicit.push(node);
    if (["main", "article"].includes(node.tagName)) semantic.push(node);
  }, true);
  const unique = [...new Map(jobs.map(job => [JSON.stringify([job.url, job.title, job.description]), job])).values()];
  if (unique.length) {
    const current = identity(pageUrl, pageUrl);
    const matches = current ? unique.filter(job => [job.url, job["@id"]].some(url => identity(url, pageUrl) === current)) : [];
    const byTitle = unique.filter(job => typeof job.title === "string" && headings.length === 1 && headings[0] === job.title.trim().toLowerCase());
    const job = matches.length === 1 ? matches[0] : matches.length > 1 ? undefined : unique.length === 1 ? unique[0] : byTitle.length === 1 ? byTitle[0] : undefined;
    if (!job || unique.length === 1 && job.url && current && identity(job.url, pageUrl) !== current && byTitle.length !== 1) throw new Error("Ambiguous job postings.");
    const description = clean(parseFragment(job.description as string));
    const context = JSON.stringify(Object.fromEntries(["title", "hiringOrganization", "jobLocation", "jobLocationType", "employmentType", "baseSalary"].filter(key => job[key] !== undefined).map(key => [key, job[key]])));
    if (context.length > 8000 || context.length + description.length > MAX_JD_CHARS) throw new Error("Job description is too long.");
    if (description.length >= 80 && !blocked.test(description)) return { description: reliable(description), context };
    // Incomplete structured text may fall back to an independently scoped DOM
    // region. An ambiguous multi-job graph never reaches this fallback.
  }
  if (!/text\/html/i.test(contentType)) throw new Error("No reliably identified JobPosting data.");
  // Never treat a whole body/page dump as a successful extraction.
  const regions = explicit.length ? explicit : semantic.filter(node => {
    const titles: string[] = [], sections: string[] = [];
    walk(node, child => { if ("tagName" in child) { if (child.tagName === "h1") titles.push(clean(child)); if (/^h[2-4]$/.test(child.tagName)) sections.push(clean(child)); } }, true);
    return titles.length === 1 && !/^(?:careers|jobs|open (?:positions|roles)|search)/i.test(titles[0]) && sections.some(s => duties.test(s));
  });
  // Choose the most specific region, never an outer wrapper that could merge
  // multiple independent description regions for different vacancies.
  const roots = regions.filter(node => !regions.some(other => other !== node && contains(node, other)));
  if (roots.length !== 1) throw new Error("No unique job-description region.");
  const titles: Element[] = [];
  walk(roots[0], node => { if ("tagName" in node && node.tagName === "h1") titles.push(node); }, true);
  if (titles.length > 1) throw new Error("Multiple jobs in description region.");
  return { description: reliable(clean(roots[0])), context: "" };
}
