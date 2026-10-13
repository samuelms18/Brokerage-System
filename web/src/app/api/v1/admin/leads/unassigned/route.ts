import { json, requireAdminApi } from "@/lib/server/http";
import { unassignedQueue } from "@/lib/server/admin";
import { toLeadSummary } from "@/lib/server/broker-dto";
import { sweep } from "@/lib/server/broker";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  sweep();
  const data = unassignedQueue().map(toLeadSummary);
  return json({ data, meta: { page: 1, per_page: data.length, total: data.length } });
}
