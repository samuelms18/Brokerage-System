import Link from "next/link";
import { requireStudentPage, toSearchParams } from "@/lib/page-auth";
import { parseListingQuery, searchListings } from "@/lib/server/listings";
import { lookups } from "@/lib/server/store";
import { ListingCard } from "@/components/ListingCard";
import { Filters } from "@/components/Filters";
import { SearchBar, SortSelect } from "@/components/SearchBar";
import { PROPERTY_TYPE_LABEL } from "@/lib/format";

export default async function Marketplace({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = toSearchParams(await searchParams);
  const { user, collegeId } = await requireStudentPage(sp.size ? `/?${sp}` : "/");
  const query = parseListingQuery(sp);
  const { data, meta } = searchListings(query, { studentId: user.id, collegeId });
  const params = sp.toString();

  // Active filter chips, each linking to the same search without that value.
  const without = (key: string, value?: string) => {
    const next = new URLSearchParams(sp);
    if (value === undefined) next.delete(key);
    else { const rest = next.getAll(key).filter((v) => v !== value); next.delete(key); rest.forEach((v) => next.append(key, v)); }
    if (key === "college_id") next.delete("max_distance_km");
    return `/?${next.toString()}`;
  };
  const chips: { label: string; href: string }[] = [];
  query.areaIds?.forEach((id) => chips.push({ label: lookups.areas.find((a) => a.id === id)?.name ?? id, href: without("area_id", id) }));
  if (query.collegeId) chips.push({ label: `Near ${lookups.colleges.find((c) => c.id === query.collegeId)?.shortName ?? "college"}${query.maxDistanceKm ? ` · ${query.maxDistanceKm} km` : ""}`, href: without("college_id") });
  if (query.rentMax !== undefined) chips.push({ label: `Rent ≤ ₹${query.rentMax.toLocaleString("en-IN")}`, href: without("rent_max") });
  if (query.depositMax !== undefined) chips.push({ label: `Deposit ≤ ₹${query.depositMax.toLocaleString("en-IN")}`, href: without("deposit_max") });
  query.sharing?.forEach((n) => chips.push({ label: n === 1 ? "Single" : `${n}-sharing`, href: without("sharing", String(n)) }));
  query.propertyTypes?.forEach((t) => chips.push({ label: PROPERTY_TYPE_LABEL[t], href: without("property_type", t) }));
  if (query.gender) chips.push({ label: query.gender === "female" ? "Girls" : query.gender === "male" ? "Boys" : "Any", href: without("gender") });
  if (query.foodIncluded) chips.push({ label: "Meals included", href: without("food_included") });
  query.amenityIds?.forEach((id) => chips.push({ label: lookups.amenities.find((a) => a.id === id)?.name ?? id, href: without("amenity_id", id) }));
  if (query.q) chips.push({ label: `“${query.q}”`, href: without("q") });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hi {user.name.split(" ")[0]}, find your next room</h1>
        <p className="mt-1 text-sm text-muted">All listings are verified by our team. Owner details stay private; your broker handles everything.</p>
        <div className="mt-4 max-w-2xl"><SearchBar key={params} params={params} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Filters lookups={{ areas: lookups.areas, colleges: lookups.colleges, amenities: lookups.amenities }} params={params} resultCount={meta.total} />

        <section aria-labelledby="results-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-heading" className="font-semibold">
              {meta.total} {meta.total === 1 ? "property" : "properties"}
            </h2>
            <SortSelect params={params} />
          </div>

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <Link key={c.label + c.href} href={c.href} className="chip" scroll={false} aria-label={`Remove filter ${c.label}`}>
                  {c.label} <span aria-hidden>×</span>
                </Link>
              ))}
              <Link href="/" className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">Clear all</Link>
            </div>
          )}

          {data.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.map((card) => <ListingCard key={card.code} card={card} />)}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <h3 className="text-lg font-semibold">No properties match these filters</h3>
              <p className="mt-1 text-sm text-muted">Try one of these:</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {meta.suggestions.map((s) => {
                  const next = new URLSearchParams(sp);
                  for (const [k, v] of Object.entries(s.query)) { next.delete(k); if (typeof v === "string") next.set(k, v); }
                  return <Link key={s.label} href={`/?${next.toString()}`} className="chip">{s.label}</Link>;
                })}
                <Link href="/" className="chip">Clear all filters</Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
