import { fromError, json, readJson, requireAdminApi } from "@/lib/server/http";
import { createPolicy } from "@/lib/server/admin";
import { store } from "@/lib/server/store";
import type { CalcType, PropertyType } from "@/lib/server/model";

type CalcIn = { calc_type: CalcType; value: string | number } | null | undefined;
const calc = (c: CalcIn) => (c ? { calcType: c.calc_type, value: Number(c.value) } : null);

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  return json({ data: store().policies });
}

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  const b = await readJson<{ name?: string; area_id?: string | null; property_type?: PropertyType | null; priority?: number;
    payer_mode?: "student" | "owner" | "both"; student?: CalcIn; owner?: CalcIn; replaces_policy_id?: string }>(req);
  try {
    const p = createPolicy(auth.user.id, {
      name: b?.name ?? "", areaId: b?.area_id, propertyType: b?.property_type, priority: Number(b?.priority ?? 0),
      payerMode: b?.payer_mode ?? "student", student: calc(b?.student), owner: calc(b?.owner),
    }, b?.replaces_policy_id || undefined);
    return json(p, 201);
  } catch (e) { return fromError(e); }
}
