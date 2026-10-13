import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { completeRefund } from "@/lib/server/admin";
import type { Refund } from "@/lib/server/model";

export async function POST(req: Request, { params }: { params: Promise<{ refundId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const b = await readJson<{ method?: Refund["method"]; reference?: string }>(req);
  try { return json(completeRefund(auth.user.id, (await params).refundId, { method: b?.method ?? null, reference: b?.reference })); } catch (e) { return fromError(e); }
}
