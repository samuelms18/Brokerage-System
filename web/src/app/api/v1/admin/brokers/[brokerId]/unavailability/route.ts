import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { addUnavailability } from "@/lib/server/admin";

export async function POST(req: Request, { params }: { params: Promise<{ brokerId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const body = await readJson<{ kind?: "leave" | "unavailable"; starts_at?: string; ends_at?: string; reason?: string }>(req);
  try {
    const w = addUnavailability(auth.user.id, (await params).brokerId, { kind: body?.kind === "unavailable" ? "unavailable" : "leave", startsAt: body?.starts_at ?? "", endsAt: body?.ends_at ?? "", reason: body?.reason });
    return json({ id: w.id }, 201);
  } catch (e) { return fromError(e); }
}
