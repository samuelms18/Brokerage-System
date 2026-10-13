import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/http";
import { store } from "@/lib/server/store";
import { sweep } from "@/lib/server/broker";

/** Server-component guard: a signed-in student, or redirect to login and back. */
export async function requireStudentPage(returnTo: string) {
  const user = await currentUser();
  if (!user) redirect(returnTo === "/" ? "/login" : `/login?next=${encodeURIComponent(returnTo)}`);
  if (user.role !== "student") redirect(homeFor(user.role));
  sweep();
  return { user, collegeId: store().students.get(user.id)?.collegeId ?? null };
}

/** Server-component guard for the broker app. */
export async function requireBrokerPage(returnTo: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (user.role !== "broker") redirect(homeFor(user.role));
  sweep();
  return { user, broker: store().brokers.get(user.id) ?? null };
}

/** Server-component guard for the Super Admin app. */
export async function requireAdminPage(returnTo: string) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (user.role !== "super_admin") redirect(homeFor(user.role));
  sweep();
  return { user };
}

export const homeFor = (role: string) => (role === "super_admin" ? "/admin" : role === "broker" ? "/broker" : "/");

export function toSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => out.append(k, x));
    else if (v !== undefined) out.set(k, v);
  }
  return out;
}
