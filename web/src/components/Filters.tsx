"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Lookups {
  areas: { id: string; name: string }[];
  colleges: { id: string; name: string; shortName: string }[];
  amenities: { id: string; name: string }[];
}

const TYPES = [["pg", "PG"], ["hostel", "Hostel"], ["flat", "Shared flat"], ["independent_room", "Independent room"], ["shared_house", "Shared house"]] as const;
const SHARING = [1, 2, 3, 4] as const;

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Desktop: side panel. Mobile: bottom sheet. Filters live in the URL. */
export function Filters({ lookups, params, resultCount }: { lookups: Lookups; params: string; resultCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sp, setSp] = useState(() => new URLSearchParams(params));
  useEffect(() => setSp(new URLSearchParams(params)), [params]);

  const get = (k: string) => sp.get(k) ?? "";
  const all = (k: string) => sp.getAll(k);
  const update = (fn: (draft: URLSearchParams) => void, apply: boolean) => {
    const draft = new URLSearchParams(sp);
    fn(draft);
    draft.delete("page");
    setSp(draft);
    if (apply) router.push(`/?${draft.toString()}`, { scroll: false });
  };
  const setList = (k: string, values: string[], apply: boolean) =>
    update((d) => { d.delete(k); values.forEach((v) => d.append(k, v)); }, apply);
  const setOne = (k: string, v: string, apply: boolean) => update((d) => (v ? d.set(k, v) : d.delete(k)), apply);

  const activeCount = ["area_id", "college_id", "rent_max", "deposit_max", "sharing", "property_type", "gender", "amenity_id", "food_included", "available_by"]
    .reduce((n, k) => n + sp.getAll(k).length, 0);

  const body = (apply: boolean) => (
    <div className="space-y-6">
      <fieldset>
        <legend className="label">Near college</legend>
        <select className="input" value={get("college_id")} onChange={(e) => setOne("college_id", e.target.value, apply)}>
          <option value="">Any college</option>
          {lookups.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {get("college_id") && (
          <select className="input mt-2" aria-label="Maximum distance" value={get("max_distance_km")} onChange={(e) => setOne("max_distance_km", e.target.value, apply)}>
            <option value="">Any distance</option>
            {[1, 2, 3, 5].map((km) => <option key={km} value={km}>Within {km} km</option>)}
          </select>
        )}
      </fieldset>
      <fieldset>
        <legend className="label">Area</legend>
        <div className="flex flex-wrap gap-2">
          {lookups.areas.map((a) => (
            <button key={a.id} type="button" className="chip" aria-pressed={all("area_id").includes(a.id)} onClick={() => setList("area_id", toggle(all("area_id"), a.id), apply)}>{a.name}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Monthly rent up to</legend>
        <select className="input" value={get("rent_max")} onChange={(e) => setOne("rent_max", e.target.value, apply)}>
          <option value="">Any budget</option>
          {[5000, 7000, 9000, 12000, 15000].map((v) => <option key={v} value={v}>₹{v.toLocaleString("en-IN")}</option>)}
        </select>
      </fieldset>
      <fieldset>
        <legend className="label">Deposit up to</legend>
        <select className="input" value={get("deposit_max")} onChange={(e) => setOne("deposit_max", e.target.value, apply)}>
          <option value="">Any deposit</option>
          {[10000, 15000, 20000, 30000].map((v) => <option key={v} value={v}>₹{v.toLocaleString("en-IN")}</option>)}
        </select>
      </fieldset>
      <fieldset>
        <legend className="label">Sharing</legend>
        <div className="flex flex-wrap gap-2">
          {SHARING.map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={all("sharing").includes(String(n))} onClick={() => setList("sharing", toggle(all("sharing"), String(n)), apply)}>
              {n === 1 ? "Single" : `${n}-sharing`}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Property type</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(([v, l]) => (
            <button key={v} type="button" className="chip" aria-pressed={all("property_type").includes(v)} onClick={() => setList("property_type", toggle(all("property_type"), v), apply)}>{l}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">For</legend>
        <div className="flex flex-wrap gap-2">
          {[["male", "Boys"], ["female", "Girls"]].map(([v, l]) => (
            <button key={v} type="button" className="chip" aria-pressed={get("gender") === v} onClick={() => setOne("gender", get("gender") === v ? "" : v, apply)}>{l}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Amenities</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={get("food_included") === "true"} onClick={() => setOne("food_included", get("food_included") === "true" ? "" : "true", apply)}>Meals included</button>
          {lookups.amenities.filter((a) => a.name !== "Meals").map((a) => (
            <button key={a.id} type="button" className="chip" aria-pressed={all("amenity_id").includes(a.id)} onClick={() => setList("amenity_id", toggle(all("amenity_id"), a.id), apply)}>{a.name}</button>
          ))}
        </div>
      </fieldset>
    </div>
  );

  return (
    <div>
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-5">
          <h2 className="mb-4 font-semibold">Filters</h2>
          {body(true)}
        </div>
      </aside>

      <button type="button" className="btn btn-secondary lg:hidden" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5"><path fill="currentColor" d="M3 6h18v2H3zm4 5h10v2H7zm3 5h4v2h-4z" /></svg>
        Filters{activeCount > 0 && <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{activeCount}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-semibold">Filters</h2>
              <button type="button" className="btn btn-ghost" onClick={() => { setSp(new URLSearchParams(params)); setOpen(false); }}>Close</button>
            </div>
            <div className="overflow-y-auto px-4 py-5">{body(false)}</div>
            <div className="flex gap-3 border-t border-line p-4">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => { const q = sp.get("q"); setSp(new URLSearchParams(q ? { q } : {})); }}>Clear all</button>
              <button type="button" className="btn btn-primary flex-[2]" onClick={() => { router.push(`/?${sp.toString()}`, { scroll: false }); setOpen(false); }}>
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{resultCount} properties found</span>
    </div>
  );
}
