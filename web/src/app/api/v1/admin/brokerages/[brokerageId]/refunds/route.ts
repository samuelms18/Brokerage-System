import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { requestRefund } from "@/lib/server/admin";

export async function POST(req: Request, { params }: { params: Promise<{ brokerageId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const b = await readJson<{ amount?: string | number; reason?: string }>(req);
  const id = (await params).brokerageId;
  try { return json(requestRefund(auth.user.id, id, Number(b?.amount), b?.reason ?? ""), 201); } catch (e) { return fromError(e); }
}
