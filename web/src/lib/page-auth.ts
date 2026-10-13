import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/http";
import { store } from "@/lib/server/store";

/** Server-component guard: a signed-in student, or redirect to login and back. */
export async function requireStudentPage(returnTo: string) {
  const user = await currentUser();
  if (!user || user.role !== "student") {
    redirect(returnTo === "/" ? "/login" : `/login?next=${encodeURIComponent(returnTo)}`);
  }
  return { user, collegeId: store().students.get(user.id)?.collegeId ?? null };
}

export function toSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => out.append(k, x));
    else if (v !== undefined) out.set(k, v);
  }
  return out;
}
