import { fromError, json, requireBrokerApi } from "@/lib/server/http";
import { accept, sweep } from "@/lib/server/broker";
import { toLeadDetail } from "@/lib/server/broker-dto";

export async function POST(_req: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  sweep();
  try {
    return json(toLeadDetail(accept(auth.user.id, (await params).leadId), auth.user.id));
  } catch (e) { return fromError(e); }
}
