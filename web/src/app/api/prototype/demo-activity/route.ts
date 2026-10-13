// PROTOTYPE ONLY: loads sample activity for the Super Admin demo. Not part of the API contract.
import { fromError, json, problem, requireAdminApi } from "@/lib/server/http";
import { seedDemoActivity } from "@/lib/server/demo";
import { store } from "@/lib/server/store";

export async function POST() {
  if (process.env.PROTOTYPE_TOOLS === "off") return problem("NOT_FOUND", "Not found");
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;
  if (store().leads.length > 0) return problem("INVALID_STATUS_TRANSITION", "Sample activity can only be loaded on a fresh server.");
  try { seedDemoActivity(auth.user.id); return json({ ok: true }, 201); } catch (e) { return fromError(e); }
}
