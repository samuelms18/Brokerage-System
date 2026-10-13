import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/http";
import { store } from "@/lib/server/store";
import { sweep } from "@/lib/server/broker";

/** Server-component guard: a signed-in student, or redirect to login and back. */
export async function requireStudentPage(returnTo: string) {
  const user = await currentUser();
  if (!user) redirect(returnTo === "/" ? "/login" : `/login?next=${encodeURIComponent(returnTo)}`);
  if (user.role !== "student") redirect("/broker");
  sweep();
  return { user, collegeId: store().students.get(user.id)?.collegeId ?? null };
}

/** Server-component guard for the broker app. */
export async function requireBrokerPage(returnTo: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (user.role !== "broker" && user.role !== "super_admin") redirect("/");
  sweep();
  return { user, broker: store().brokers.get(user.id) ?? null };
}

export function toSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => out.append(k, x));
    else if (v !== undefined) out.set(k, v);
  }
  return out;
}
