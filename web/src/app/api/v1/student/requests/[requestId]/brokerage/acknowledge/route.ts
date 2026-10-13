import { json, problem, requireStudentApi } from "@/lib/server/http";
import { acknowledgeBrokerage, RequestError } from "@/lib/server/requests";
import { toStudentRequest } from "@/lib/server/student-dto";

export async function POST(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  const { requestId } = await params;
  try {
    const lead = acknowledgeBrokerage(auth.user.id, requestId);
    return json(toStudentRequest(lead, { studentId: auth.user.id, collegeId: auth.collegeId }));
  } catch (e) {
    if (e instanceof RequestError) return problem(e.code, e.message);
    throw e;
  }
}
