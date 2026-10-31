import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { documentFailure, fileDownload } from "@/lib/documents/http";
import { deleteDocument, documentKind, downloadDocument } from "@/lib/documents/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ jobId: string; kind: string }> };
export async function GET(_request: Request, context: Context) {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const { jobId, kind } = await context.params;
    return fileDownload(await downloadDocument(userId, jobId, documentKind(kind)));
  } catch (error) { return documentFailure(error); }
}
export async function DELETE(_request: Request, context: Context) {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const { jobId, kind } = await context.params;
    return NextResponse.json(await deleteDocument(userId, jobId, documentKind(kind)));
  } catch (error) { return documentFailure(error); }
}
