import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { cancelRefund } from "@/lib/server/admin";

export async function POST(req: Request, { params }: { params: Promise<{ refundId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const b = await readJson<{ reason?: string }>(req);
  try { return json(cancelRefund(auth.user.id, (await params).refundId, b?.reason ?? "")); } catch (e) { return fromError(e); }
}
