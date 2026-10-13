import { json, requireStudentApi } from "@/lib/server/http";
import { shortlistCards } from "@/lib/server/shortlist";

export async function GET() {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  return json({ data: shortlistCards(auth.user.id, auth.collegeId) });
}
