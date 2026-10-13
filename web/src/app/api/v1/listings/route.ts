import type { NextRequest } from "next/server";
import { json, requireStudentApi } from "@/lib/server/http";
import { parseListingQuery, searchListings } from "@/lib/server/listings";

export async function GET(req: NextRequest) {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  const q = parseListingQuery(req.nextUrl.searchParams);
  return json(searchListings(q, { studentId: auth.user.id, collegeId: auth.collegeId }));
}
