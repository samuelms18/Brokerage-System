import { json, problem, requireStudentApi } from "@/lib/server/http";
import { listingDetail } from "@/lib/server/listings";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  const { code } = await params;
  const detail = listingDetail(code, { studentId: auth.user.id, collegeId: auth.collegeId });
  return detail ? json(detail) : problem("NOT_FOUND", "Property not found");
}
