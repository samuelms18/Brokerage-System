import { lookups, store } from "./store";
import { STUDENT_VISIBLE_STATUSES, type Property, type PropertyType } from "./model";
import { availableBeds, rentRange, toListingCard, toListingDetail, type StudentListingCard } from "./student-dto";

export interface ListingQuery {
  q?: string;
  areaIds?: string[];
  collegeId?: string;
  maxDistanceKm?: number;
  rentMin?: number;
  rentMax?: number;
  depositMax?: number;
  sharing?: number[];
  propertyTypes?: PropertyType[];
  gender?: "male" | "female" | "any";
  amenityIds?: string[];
  foodIncluded?: boolean;
  availableBy?: string;
  sort?: "recommended" | "rent_asc" | "nearest" | "newest";
  page?: number;
  perPage?: number;
}

const PROPERTY_TYPES: PropertyType[] = ["pg", "hostel", "flat", "independent_room", "shared_house"];

/** Parses URL search params (shared by the API route and the marketplace page). */
export function parseListingQuery(sp: URLSearchParams): ListingQuery {
  const num = (k: string) => {
    const v = sp.get(k);
    if (v === null || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const list = (k: string) => sp.getAll(k).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  const sort = sp.get("sort");
  const gender = sp.get("gender");
  return {
    q: sp.get("q")?.trim().slice(0, 100) || undefined,
    areaIds: list("area_id"),
    collegeId: sp.get("college_id") || undefined,
    maxDistanceKm: num("max_distance_km"),
    rentMin: num("rent_min"),
    rentMax: num("rent_max"),
    depositMax: num("deposit_max"),
    sharing: list("sharing").map(Number).filter((n) => Number.isInteger(n) && n > 0),
    propertyTypes: list("property_type").filter((t): t is PropertyType => PROPERTY_TYPES.includes(t as PropertyType)),
    gender: gender === "male" || gender === "female" || gender === "any" ? gender : undefined,
    amenityIds: list("amenity_id"),
    foodIncluded: sp.get("food_included") === "true" ? true : undefined,
    availableBy: /^\d{4}-\d{2}-\d{2}$/.test(sp.get("available_by") ?? "") ? sp.get("available_by")! : undefined,
    sort: sort === "rent_asc" || sort === "nearest" || sort === "newest" ? sort : "recommended",
    page: Math.max(1, Math.floor(num("page") ?? 1)),
    perPage: Math.min(100, Math.max(1, Math.floor(num("per_page") ?? 20))),
  };
}

export function studentVisibleProperties(): Property[] {
  return store().properties.filter((p) => STUDENT_VISIBLE_STATUSES.includes(p.status));
}

function matches(p: Property, q: ListingQuery): boolean {
  const { rentFrom, depositFrom } = rentRange(p);
  if (q.q) {
    const needle = q.q.toLowerCase();
    const area = lookups.areas.find((a) => a.id === p.areaId);
    const colleges = p.collegeDistances.map((d) => lookups.colleges.find((c) => c.id === d.collegeId))
      .flatMap((c) => (c ? [c.name, c.shortName] : []));
    const haystack = [p.title, p.code, p.localityLabel, area?.name ?? "", area?.city ?? "", ...colleges].join(" ").toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  if (q.areaIds?.length && !q.areaIds.includes(p.areaId)) return false;
  if (q.collegeId && q.maxDistanceKm !== undefined) {
    const d = p.collegeDistances.find((x) => x.collegeId === q.collegeId);
    if (!d || d.km > q.maxDistanceKm) return false;
  }
  if (q.rentMin !== undefined && rentRange(p).rentTo < q.rentMin) return false;
  if (q.rentMax !== undefined && rentFrom > q.rentMax) return false;
  if (q.depositMax !== undefined && depositFrom > q.depositMax) return false;
  if (q.sharing?.length && !p.rooms.some((r) => r.status === "active" && q.sharing!.includes(r.sharing))) return false;
  if (q.propertyTypes?.length && !q.propertyTypes.includes(p.propertyType)) return false;
  if (q.gender && q.gender !== "any" && p.genderPolicy !== "any" && p.genderPolicy !== q.gender) return false;
  if (q.amenityIds?.length && !q.amenityIds.every((a) => p.amenityIds.includes(a))) return false;
  if (q.foodIncluded && !p.foodIncluded) return false;
  if (q.availableBy && p.availableFrom && p.availableFrom > q.availableBy && availableBeds(p) === 0) return false;
  return true;
}

export interface Suggestion { label: string; query: Record<string, string | string[] | null> }

export function searchListings(q: ListingQuery, ctx: { studentId: string; collegeId?: string | null }) {
  const collegeForDistance = q.collegeId ?? ctx.collegeId ?? null;
  let results = studentVisibleProperties().filter((p) => matches(p, q));

  const dist = (p: Property) => p.collegeDistances.find((d) => d.collegeId === collegeForDistance)?.km ?? Number.POSITIVE_INFINITY;
  const sorters: Record<NonNullable<ListingQuery["sort"]>, (a: Property, b: Property) => number> = {
    recommended: (a, b) => Number(availableBeds(b) > 0) - Number(availableBeds(a) > 0) || dist(a) - dist(b) || b.publishedAt.localeCompare(a.publishedAt),
    rent_asc: (a, b) => rentRange(a).rentFrom - rentRange(b).rentFrom,
    nearest: (a, b) => dist(a) - dist(b),
    newest: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  };
  results = [...results].sort(sorters[q.sort ?? "recommended"]);

  const total = results.length;
  const page = q.page ?? 1;
  const perPage = q.perPage ?? 20;
  const data: StudentListingCard[] = results
    .slice((page - 1) * perPage, page * perPage)
    .map((p) => toListingCard(p, { studentId: ctx.studentId, collegeId: collegeForDistance }));

  const suggestions: Suggestion[] = [];
  if (total === 0) {
    if (q.rentMax !== undefined) suggestions.push({ label: `Raise budget to ₹${(q.rentMax + 2000).toLocaleString("en-IN")}`, query: { rent_max: String(q.rentMax + 2000) } });
    if (q.amenityIds?.length) suggestions.push({ label: "Remove amenity filters", query: { amenity_id: null } });
    if (q.sharing?.length) suggestions.push({ label: "Any sharing type", query: { sharing: null } });
    if (q.propertyTypes?.length) suggestions.push({ label: "Any property type", query: { property_type: null } });
    if (q.maxDistanceKm !== undefined) suggestions.push({ label: `Within ${q.maxDistanceKm + 2} km`, query: { max_distance_km: String(q.maxDistanceKm + 2) } });
    if (q.q) suggestions.push({ label: `Clear search "${q.q}"`, query: { q: null } });
  }
  return { data, meta: { page, per_page: perPage, total, suggestions } };
}

export function findStudentVisible(code: string): Property | undefined {
  return studentVisibleProperties().find((p) => p.code.toLowerCase() === code.toLowerCase());
}

export function listingDetail(code: string, ctx: { studentId: string; collegeId?: string | null }) {
  const p = findStudentVisible(code);
  if (!p) return null;
  const similar = studentVisibleProperties()
    .filter((x) => x.id !== p.id && availableBeds(x) > 0)
    .map((x) => ({ x, score: (x.areaId === p.areaId ? 0 : 10) + Math.abs(rentRange(x).rentFrom - rentRange(p).rentFrom) / 1000 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ x }) => x);
  return toListingDetail(p, { ...ctx, similar });
}
