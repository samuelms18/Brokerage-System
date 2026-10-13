import { AuthError, SESSION_COOKIE, sanitizeReturnTo, verifyOtp } from "@/lib/server/auth";
import { json, problem, readJson } from "@/lib/server/http";
import { toMe } from "@/lib/server/me";

export async function POST(req: Request) {
  const body = await readJson<{ challenge_id?: string; code?: string; name?: string; return_to?: string }>(req);
  try {
    const { session, user } = verifyOtp(String(body?.challenge_id ?? ""), String(body?.code ?? ""), body?.name);
    const res = json({
      access_token: session.token,
      expires_at: new Date(session.expiresAt).toISOString(),
      user: toMe(user),
      redirect_to: sanitizeReturnTo(body?.return_to),
    });
    res.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
      path: "/",
      expires: new Date(session.expiresAt),
    });
    return res;
  } catch (e) {
    if (e instanceof AuthError) return problem(e.code, e.message, { errors: e.errors });
    throw e;
  }
}
