import { newId, store, type Session } from "./store";
import type { User } from "./model";

export const SESSION_COOKIE = "srb_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

/** Prototype only: every OTP is this code; no SMS is sent. */
export const PROTOTYPE_OTP = "123456";

export class AuthError extends Error {
  constructor(public code: "OTP_INVALID" | "VALIDATION_FAILED" | "RATE_LIMITED", message: string,
              public errors?: Record<string, string[]>) {
    super(message);
  }
}

/** Accepts +91XXXXXXXXXX or a bare 10-digit Indian mobile number. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  return null;
}

/**
 * Open-redirect guard for "return to the property after login" (AUTH-5).
 * Only same-site relative paths are allowed; anything else becomes "/".
 */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  if (raw.length > 512) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\\]/.test(raw)) return "/";
  let url: URL;
  try {
    url = new URL(raw, "https://app.invalid");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.invalid") return "/";
  if (url.pathname === "/login" || url.pathname.startsWith("/api/")) return "/";
  return url.pathname + url.search + url.hash;
}

export function requestOtp(phoneInput: string): { challengeId: string } {
  const phone = normalisePhone(phoneInput);
  if (!phone) throw new AuthError("VALIDATION_FAILED", "Enter a valid mobile number", { phone: ["Enter a valid 10-digit mobile number"] });
  const s = store();
  const recent = [...s.otps.values()].filter((o) => o.phone === phone && o.expiresAt - OTP_TTL_MS > Date.now() - 60_000);
  if (recent.length >= 5) throw new AuthError("RATE_LIMITED", "Too many codes requested. Try again in a minute.");
  const id = newId("otp");
  s.otps.set(id, { id, phone, code: PROTOTYPE_OTP, attempts: 0, expiresAt: Date.now() + OTP_TTL_MS, consumed: false });
  return { challengeId: id };
}

export function verifyOtp(challengeId: string, code: string, name?: string): { session: Session; user: User } {
  const s = store();
  const ch = s.otps.get(challengeId);
  if (!ch || ch.consumed || ch.expiresAt < Date.now() || ch.attempts >= MAX_OTP_ATTEMPTS) {
    throw new AuthError("OTP_INVALID", "This code has expired. Request a new one.");
  }
  if (ch.code !== code) {
    ch.attempts++;
    throw new AuthError("OTP_INVALID", "Incorrect code. Check the SMS and try again.");
  }
  let user = [...s.users.values()].find((u) => u.phone === ch.phone);
  if (!user) {
    const trimmed = name?.trim();
    if (!trimmed) {
      // Don't consume the code: the client asks for the name and retries.
      throw new AuthError("VALIDATION_FAILED", "Tell us your name to finish creating your account", { name: ["Required on first login"] });
    }
    user = { id: newId("usr"), role: "student", name: trimmed.slice(0, 80), phone: ch.phone, status: "active" };
    s.users.set(user.id, user);
    s.students.set(user.id, { userId: user.id, collegeId: null });
  }
  ch.consumed = true;
  const token = crypto.randomUUID() + crypto.randomUUID();
  const session: Session = { token, userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS };
  s.sessions.set(token, session);
  return { session, user };
}

export function userForToken(token: string | undefined | null): User | null {
  if (!token) return null;
  const s = store();
  const session = s.sessions.get(token);
  if (!session || session.expiresAt < Date.now()) return null;
  const user = s.users.get(session.userId);
  return user && user.status === "active" ? user : null;
}

export function revokeSession(token: string | undefined | null) {
  if (token) store().sessions.delete(token);
}
