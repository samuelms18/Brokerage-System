import { fromError, json, requireBrokerApi } from "@/lib/server/http";
import { brokerLead, sweep } from "@/lib/server/broker";
import { toLeadDetail } from "@/lib/server/broker-dto";

export async function GET(_req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  sweep();
  try {
    return json(toLeadDetail(brokerLead(auth.user.id, (await params).leadId), auth.user.id));
  } catch (e) { return fromError(e); }
}
