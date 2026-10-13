import type { NextRequest } from "next/server";
import type { components } from "@/lib/api-types";
import { json, problem, readJson, requireStudentApi } from "@/lib/server/http";
import { createStudentRequest, listStudentRequests, RequestError } from "@/lib/server/requests";

export async function POST(req: NextRequest) {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<components["schemas"]["StudentRequestCreate"]>(req);
  if (!body) return problem("VALIDATION_FAILED", "Invalid request body");
  try {
    return json(createStudentRequest(auth.user.id, body, req.headers.get("Idempotency-Key")), 202);
  } catch (e) {
    if (e instanceof RequestError) return problem(e.code, e.message, { errors: e.errors });
    throw e;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  const state = req.nextUrl.searchParams.get("state");
  const data = listStudentRequests(auth.user.id, state === "closed" || state === "all" ? state : "open", auth.collegeId);
  return json({ data, meta: { page: 1, per_page: data.length, total: data.length } });
}
