import { NextResponse } from "next/server";
import { requireUser } from "@/actions/shared";
import { z } from "zod";
import { AutofillError, safeAiError } from "./service";
const active = new Set<string>();
export async function aiRequest(request: Request, work: (userId: string, body: unknown) => Promise<unknown>) {
  let userId: string | undefined;
  try { userId = (await requireUser()).id; } catch { return NextResponse.json({ error: "Sign in to use AI Autofill." }, { status: 401 }); }
  if (active.has(userId)) return NextResponse.json({ error: "An AI request is already running. Please wait." }, { status: 429 });
  active.add(userId);
  try {
    const reader = request.body?.getReader(); if (!reader) throw new AutofillError("Request body is required.");
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > 256_000) { await reader.cancel(); throw new AutofillError("Input is too large.", 413); }
      chunks.push(part.value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AutofillError("Invalid request JSON."); }
    return NextResponse.json(await work(userId, body), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = error instanceof z.ZodError ? new AutofillError("Invalid input. Check the job description or AI configuration.") : safeAiError(error);
    // Never log SDK errors: they can contain Authorization headers and JD text.
    return NextResponse.json({ error: safe.message }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  } finally { active.delete(userId); }
}
