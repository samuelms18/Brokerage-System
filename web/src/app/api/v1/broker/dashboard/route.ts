import { json, requireBrokerApi } from "@/lib/server/http";
import { dashboard, sweep } from "@/lib/server/broker";
import { toLeadSummary } from "@/lib/server/broker-dto";
import { money } from "@/lib/server/student-dto";

export async function GET() {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  sweep();
  const d = dashboard(auth.user.id);
  return json({ ...d.counts, brokerage_pending_amount: money(d.counts.brokerage_pending_amount), offered: d.offered.map(toLeadSummary) });
}
