import type { components } from "@/lib/api-types";
import type { User } from "./model";

export function toMe(user: User): components["schemas"]["Me"] {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
    email: null,
    profile_complete: false,
    permissions: { can_verify_properties: user.role === "super_admin", can_override_brokerage: user.role === "super_admin" },
  };
}
