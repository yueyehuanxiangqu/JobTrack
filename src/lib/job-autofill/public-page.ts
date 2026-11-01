import "server-only";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";

export const URL_FALLBACK = "Unable to retrieve the job description. Please paste the job description manually.";
export const MAX_PAGE_BYTES = 1_000_000;

export function isPublicAddress(address: string): boolean {
  try {
    if (address === "168.63.129.16") return false; // Azure platform/metadata service
    const ip = ipaddr.process(address);
    return ip.range() === "unicast" && (ip.kind() !== "ipv6" || ip.toByteArray()[0] >= 0x20 && ip.toByteArray()[0] <= 0x3f);
  } catch { return false; }
}
export function publicPageUrl(input: string): URL {
  const url = new URL(input);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.port && !["80", "443"].includes(url.port) || !host.includes(".") && !host.includes(":") ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|onion)\.?$/.test(host) ||
      ipaddr.isValid(host) && !isPublicAddress(host)) throw new Error(URL_FALLBACK);
  url.hash = "";
  return url;
}
export async function publicDestination(url: URL, signal: AbortSignal) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let abort: (() => void) | undefined;
  let addresses: { address: string; family: number }[];
  try {
    addresses = ipaddr.isValid(host) ? [{ address: host, family: host.includes(":") ? 6 : 4 }] :
      await Promise.race([lookup(host, { all: true }), new Promise<never>((_, reject) => {
        abort = () => reject(new Error(URL_FALLBACK)); signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      })]);
  } finally { if (abort) signal.removeEventListener("abort", abort); }
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error(URL_FALLBACK);
  return addresses.find(a => a.family === 4) ?? addresses[0];
}
// Resolve once and pin the connection to the validated IP: a DNS rebind between
// validation and fetch must not turn a public job URL into a local request.
export async function requestPublicPage(url: URL, signal: AbortSignal) {
  const target = await publicDestination(url, signal);
  return new Promise<{ status: number; location?: string; contentType: string; text: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).request(url, {
      method: "GET", signal, agent: false, family: target.family,
      lookup: (_host, _options, callback) => callback(null, target.address, target.family),
      headers: { Accept: "text/html,application/ld+json,text/plain;q=0.8", "Accept-Encoding": "identity", "User-Agent": "JobTrack/1.0 (user-requested job import)" },
    }, response => {
      const status = response.statusCode ?? 0;
      if ([301,302,303,307,308].includes(status)) {
        response.destroy(); resolve({ status, location: response.headers.location, contentType: "", text: "" }); return;
      }
      const contentType = String(response.headers["content-type"] ?? "");
      if (status !== 200 || !/^(text\/(html|plain)|application\/(ld\+json|json))(?:;|$)/i.test(contentType) ||
          Number(response.headers["content-length"] ?? 0) > MAX_PAGE_BYTES ||
          response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
        response.destroy(); reject(new Error(URL_FALLBACK)); return;
      }
      let length = 0; const chunks: Buffer[] = [];
      response.on("data", chunk => {
        length += chunk.length;
        if (length > MAX_PAGE_BYTES) { response.destroy(); reject(new Error(URL_FALLBACK)); }
        else chunks.push(Buffer.from(chunk));
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status, contentType, text: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject); request.end();
  });
}
export async function fetchPublicPage(input: string, externalSignal?: AbortSignal) {
  const signal = AbortSignal.any([AbortSignal.timeout(10_000), ...(externalSignal ? [externalSignal] : [])]);
  let url = publicPageUrl(input);
  for (let hop = 0; hop <= 3; hop++) {
    const page = await requestPublicPage(url, signal);
    if (page.status === 200) return page;
    if (!page.location || hop === 3) throw new Error(URL_FALLBACK);
    const next = publicPageUrl(new URL(page.location, url).href);
    if (url.protocol === "https:" && next.protocol !== "https:") throw new Error(URL_FALLBACK);
    url = next;
  }
  throw new Error(URL_FALLBACK);
}
