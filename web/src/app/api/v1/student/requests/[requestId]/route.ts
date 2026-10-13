import { json, problem, requireStudentApi } from "@/lib/server/http";
import { getStudentLead } from "@/lib/server/requests";
import { toStudentRequest } from "@/lib/server/student-dto";

export async function GET(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  const { requestId } = await params;
  const lead = getStudentLead(auth.user.id, requestId);
  if (!lead) return problem("NOT_FOUND", "Request not found");
  return json(toStudentRequest(lead, { studentId: auth.user.id, collegeId: auth.collegeId }));
}
