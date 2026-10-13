import type { NextRequest } from "next/server";
import { json, requireAdminApi } from "@/lib/server/http";
import { store } from "@/lib/server/store";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const sp = req.nextUrl.searchParams;
  const s = store();
  const data = s.audit
    .map((e, i) => ({ id: i + 1, actor_id: e.actorId, actor_name: e.actorId ? s.users.get(e.actorId)?.name ?? null : null, action: e.action,
                      entity_type: e.entityType, entity_id: e.entityId, metadata: e.metadata ?? {}, ip: null, created_at: new Date(e.at).toISOString() }))
    .filter((e) => (!sp.get("entity_type") || e.entity_type === sp.get("entity_type")) && (!sp.get("entity_id") || e.entity_id === sp.get("entity_id"))
      && (!sp.get("actor_id") || e.actor_id === sp.get("actor_id")) && (!sp.get("action") || e.action.startsWith(sp.get("action")!)))
    .reverse();
  return json({ data, meta: { page: 1, per_page: data.length, total: data.length } });
}
