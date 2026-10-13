import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, userForToken } from "./auth";
import { store } from "./store";
import type { User } from "./model";

type ProblemCode =
  | "LEAD_NOT_OFFERED_TO_YOU" | "BED_NOT_AVAILABLE" | "DUPLICATE_ACTIVE_LEAD" | "BROKERAGE_NOT_DISCLOSED" | "OVERPAYMENT"
  | "VALIDATION_FAILED" | "UNAUTHENTICATED" | "OTP_INVALID" | "SESSION_EXPIRED" | "FORBIDDEN" | "NOT_FOUND"
  | "RATE_LIMITED" | "INVALID_STATUS_TRANSITION" | "PROPERTY_NOT_AVAILABLE" | "PUBLISH_VALIDATION_FAILED";

const STATUS: Record<ProblemCode, number> = {
  VALIDATION_FAILED: 422, UNAUTHENTICATED: 401, OTP_INVALID: 401, SESSION_EXPIRED: 401, FORBIDDEN: 403,
  NOT_FOUND: 404, RATE_LIMITED: 429, INVALID_STATUS_TRANSITION: 409, PROPERTY_NOT_AVAILABLE: 409,
  LEAD_NOT_OFFERED_TO_YOU: 409, BED_NOT_AVAILABLE: 409, DUPLICATE_ACTIVE_LEAD: 409, BROKERAGE_NOT_DISCLOSED: 409, OVERPAYMENT: 422,
  PUBLISH_VALIDATION_FAILED: 422,
};

export function problem(code: ProblemCode, title: string, extra: { errors?: Record<string, string[]> } = {}) {
  const status = STATUS[code];
  return NextResponse.json(
    { type: `https://errors.brokerage.example/${code.toLowerCase()}`, title, status, code, ...extra },
    { status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" } },
  );
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return userForToken(jar.get(SESSION_COOKIE)?.value);
}

/** Route-handler guard: signed-in student, or a 401/403 problem response. */
export async function requireStudentApi(): Promise<{ user: User; collegeId: string | null } | NextResponse> {
  const user = await currentUser();
  if (!user) return problem("UNAUTHENTICATED", "Log in to continue");
  if (user.role !== "student") return problem("FORBIDDEN", "Student account required");
  return { user, collegeId: store().students.get(user.id)?.collegeId ?? null };
}

/** Route-handler guard for broker endpoints (Super Admin may also call them). */
export async function requireBrokerApi(): Promise<{ user: User } | NextResponse> {
  const user = await currentUser();
  if (!user) return problem("UNAUTHENTICATED", "Log in to continue");
  if (user.role !== "broker" && user.role !== "super_admin") return problem("FORBIDDEN", "Broker account required");
  return { user };
}

/** Route-handler guard for Super Admin endpoints. */
export async function requireAdminApi(): Promise<{ user: User } | NextResponse> {
  const user = await currentUser();
  if (!user) return problem("UNAUTHENTICATED", "Log in to continue");
  if (user.role !== "super_admin") return problem("FORBIDDEN", "Super Admin only");
  return { user };
}

/** Maps domain errors (BrokerError, BrokerageError, RequestError) to problem responses. */
export function fromError(e: unknown) {
  if (e instanceof Error && "code" in e) {
    const err = e as Error & { code: ProblemCode; errors?: Record<string, string[]> };
    if (err.code in STATUS) return problem(err.code, err.message, { errors: err.errors });
  }
  throw e;
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

