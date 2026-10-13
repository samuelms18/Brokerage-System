import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { manualReassign } from "@/lib/server/admin";
import { toLeadSummary } from "@/lib/server/broker-dto";

export async function POST(req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ broker_id?: string; reason_note?: string }>(req);
  try {
    return json(toLeadSummary(manualReassign(auth.user.id, (await params).leadId, body?.broker_id ?? "", body?.reason_note ?? "")));
  } catch (e) { return fromError(e); }
}
