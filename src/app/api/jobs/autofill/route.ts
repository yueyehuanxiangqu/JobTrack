import { aiRequest } from "@/lib/job-autofill/http";
import { autofillJob } from "@/lib/job-autofill/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return aiRequest(request, (userId, body) => autofillJob(userId, body, request.signal));
}
