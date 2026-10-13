import { AuthError, requestOtp } from "@/lib/server/auth";
import { json, problem, readJson } from "@/lib/server/http";

export async function POST(req: Request) {
  const body = await readJson<{ phone?: string }>(req);
  try {
    const { challengeId } = requestOtp(String(body?.phone ?? ""));
    return json({ challenge_id: challengeId, expires_in_seconds: 300, resend_after_seconds: 30 }, 202);
  } catch (e) {
    if (e instanceof AuthError) return problem(e.code, e.message, { errors: e.errors });
    throw e;
  }
}
