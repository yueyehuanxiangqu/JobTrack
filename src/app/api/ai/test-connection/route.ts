import { aiRequest } from "@/lib/job-autofill/http";
import { testAutofillConnection } from "@/lib/job-autofill/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return aiRequest(request, async (userId, body) => { await testAutofillConnection(userId, body, request.signal); return { success: true }; });
}
