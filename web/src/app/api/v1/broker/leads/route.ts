import type { NextRequest } from "next/server";
import { json, requireBrokerApi } from "@/lib/server/http";
import { sweep } from "@/lib/server/broker";
import { toLeadSummary } from "@/lib/server/broker-dto";
import { store } from "@/lib/server/store";
import { isActiveLead } from "@/lib/server/model";

export async function GET(req: NextRequest) {
  const auth = await requireBrokerApi();
  if (auth instanceof Response) return auth;
  sweep();
  const active = req.nextUrl.searchParams.get("active") !== "false";
  const data = store().leads.filter((l) => l.brokerId === auth.user.id && isActiveLead(l) === active).map(toLeadSummary);
  return json({ data, meta: { page: 1, per_page: data.length, total: data.length } });
}
