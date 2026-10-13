import { fromError, json, requireStudentApi } from "@/lib/server/http";
import { confirmVisit } from "@/lib/server/requests";
import { toStudentRequest } from "@/lib/server/student-dto";

export async function POST(_req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  try {
    const lead = confirmVisit(auth.user.id, (await params).visitId);
    return json(toStudentRequest(lead, { studentId: auth.user.id, collegeId: auth.collegeId }));
  } catch (e) { return fromError(e); }
}
