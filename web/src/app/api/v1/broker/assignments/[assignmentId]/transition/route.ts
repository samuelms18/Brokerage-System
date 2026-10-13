import { fromError, json, readJson, requireBrokerApi } from "@/lib/server/http";
import { cancelAssignment, confirmAssignment } from "@/lib/server/broker";

export async function POST(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  const { assignmentId } = await params;
  const body = await readJson<{ to_status?: string; reason?: string }>(req);
  try {
    if (body?.to_status === "confirmed") return json({ status: confirmAssignment(auth.user.id, assignmentId).status });
    if (body?.to_status === "cancelled") return json({ status: cancelAssignment(auth.user.id, assignmentId, body.reason ?? "").status });
    return fromError(Object.assign(new Error("Only confirmed or cancelled are supported in the prototype"), { code: "INVALID_STATUS_TRANSITION" }));
  } catch (e) { return fromError(e); }
}
