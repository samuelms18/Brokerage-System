import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { updateBroker } from "@/lib/server/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ can_override_brokerage?: boolean }>(req);
  try {
    updateBroker(auth.user.id, (await params).userId, { canOverrideBrokerage: body?.can_override_brokerage });
    return json({ ok: true });
  } catch (e) { return fromError(e); }
}
