// PROTOTYPE ONLY: simulates a broker action. Not part of the API contract.
import { json, problem, prototypeToolsEnabled, requireStudentApi } from "@/lib/server/http";
import { RequestError } from "@/lib/server/requests";
import { simulateBrokerAccept } from "@/lib/server/prototype-tools";

export async function POST(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  if (!prototypeToolsEnabled()) return problem("NOT_FOUND", "Not found");
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  const { requestId } = await params;
  try {
    simulateBrokerAccept(auth.user.id, requestId);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof RequestError) return problem(e.code, e.message);
    throw e;
  }
}
