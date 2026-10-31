import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { documentFailure, documentForm } from "@/lib/documents/http";
import { listDocuments, putDocuments } from "@/lib/documents/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ jobId: string }> };
export async function GET(_request: Request, context: Context) {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try { return NextResponse.json({ documents: await listDocuments(userId, (await context.params).jobId) }); }
  catch (error) { return documentFailure(error); }
}
export async function PUT(request: Request, context: Context) {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const jobId = (await context.params).jobId;
    await listDocuments(userId, jobId);
    return NextResponse.json(await putDocuments(userId, jobId, await documentForm(request)));
  } catch (error) { return documentFailure(error); }
}
