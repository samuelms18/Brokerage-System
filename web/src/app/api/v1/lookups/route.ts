import { json, requireStudentApi } from "@/lib/server/http";
import { lookups } from "@/lib/server/store";

export async function GET() {
  const auth = await requireStudentApi();
  if (auth instanceof Response) return auth;
  return json({
    areas: lookups.areas.map((a) => ({ id: a.id, name: a.name, city: a.city, parent_area_id: null })),
    colleges: lookups.colleges.map((c) => ({ id: c.id, name: c.name, short_name: c.shortName, area_id: c.areaId })),
    amenities: lookups.amenities.map((a) => ({ id: a.id, name: a.name, category: a.category, icon: null })),
  });
}
