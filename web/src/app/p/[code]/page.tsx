import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStudentPage } from "@/lib/page-auth";
import { listingDetail } from "@/lib/server/listings";
import { Gallery } from "@/components/Gallery";
import { ApproxMap } from "@/components/ApproxMap";
import { ListingCard, AvailabilityBadge } from "@/components/ListingCard";
import { ShortlistButton } from "@/components/ShortlistButton";
import { RequestVisitButton } from "@/components/RequestVisit";
import { GENDER_LABEL, PROPERTY_TYPE_LABEL, formatDate, inr, sharingLabel } from "@/lib/format";

// Titles stay generic so link previews never reveal property details (PV-2).
export const metadata: Metadata = { title: "Property" };

export default async function PropertyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { user, collegeId } = await requireStudentPage(`/p/${code}`);
  const p = listingDetail(code, { studentId: user.id, collegeId });
  if (!p) notFound();
  const beds = p.rooms.reduce((n, r) => n + r.available_beds, 0);
  const nextFree = p.rooms.map((r) => r.next_available_from).filter(Boolean).sort()[0] ?? null;

  const summary = (
    <div className="card space-y-4 p-5">
      <div>
        <p className="text-sm text-muted">Rent from</p>
        <p className="text-2xl font-bold">{inr(p.rent_from)}<span className="text-base font-normal text-muted">/month per bed</span></p>
        <p className="mt-1 text-sm text-muted">Deposit from {inr(p.deposit_from)}{p.maintenance_fee ? ` · Maintenance ${inr(p.maintenance_fee)}/month` : ""}</p>
      </div>
      <AvailabilityBadge beds={beds} from={nextFree} />
      <div className="space-y-2">
        <RequestVisitButton code={p.code} title={p.title} existingRequestId={p.my_open_request_id ?? null} />
        <ShortlistButton code={p.code} initial={!!p.is_shortlisted} variant="button" />
      </div>
      <p className="text-xs text-muted">Free to request. A broker contacts you to arrange the visit. Brokerage, if any, is shown to you before you confirm a room.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 lg:pb-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <Gallery photos={p.photos} title={p.title} />

          <header>
            <p className="text-sm font-semibold text-brand-700">{PROPERTY_TYPE_LABEL[p.property_type]} · {GENDER_LABEL[p.gender_policy ?? "any"]}{p.food_included ? " · Meals included" : ""}</p>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">{p.title}</h1>
            <p className="mt-1 text-muted">{p.area}{p.locality_label ? ` · ${p.locality_label}` : ""}</p>
          </header>

          {p.description && <p className="leading-relaxed text-ink/90">{p.description}</p>}

          <section aria-labelledby="rooms-h">
            <h2 id="rooms-h" className="mb-3 text-lg font-semibold">Room options</h2>
            <div className="card divide-y divide-line">
              {p.rooms.map((r, idx) => (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{sharingLabel(r.sharing)} {r.room_type === "ac" ? "· AC" : ""}{r.attached_bathroom ? " · Attached bath" : ""}</p>
                    <p className="text-sm text-muted">{inr(r.rent_per_bed)}/month per bed · Deposit {inr(r.deposit_per_bed)}</p>
                  </div>
                  <AvailabilityBadge beds={r.available_beds} from={r.next_available_from} />
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="am-h">
            <h2 id="am-h" className="mb-3 text-lg font-semibold">Amenities</h2>
            <ul className="flex flex-wrap gap-2">
              {p.amenities.map((a) => <li key={a} className="chip">{a}</li>)}
            </ul>
          </section>

          <section aria-labelledby="loc-h" className="grid gap-4 md:grid-cols-2">
            <div>
              <h2 id="loc-h" className="mb-3 text-lg font-semibold">Location</h2>
              <ApproxMap area={p.area} radius={p.approx_location.radius_m ?? 500} />
            </div>
            {p.college_distances && p.college_distances.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold">Distance to colleges</h2>
                <ul className="card divide-y divide-line">
                  {p.college_distances.map((c) => (
                    <li key={c.college} className="flex justify-between gap-4 p-4 text-sm">
                      <span>{c.college}</span><span className="font-semibold">{c.distance_km} km</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {p.house_rules && (
            <section aria-labelledby="rules-h">
              <h2 id="rules-h" className="mb-3 text-lg font-semibold">House rules</h2>
              <p className="card p-4 text-sm leading-relaxed">{p.house_rules}</p>
            </section>
          )}

          {p.available_from && <p className="text-sm text-muted">Next move-in date: {formatDate(p.available_from, { day: "numeric", month: "long", year: "numeric" })}</p>}
        </div>

        <aside className="hidden lg:block"><div className="sticky top-20">{summary}</div></aside>
      </div>

      {p.similar && p.similar.length > 0 && (
        <section aria-labelledby="sim-h" className="mt-12">
          <h2 id="sim-h" className="mb-4 text-lg font-semibold">Similar properties</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.similar.map((c) => <ListingCard key={c.code} card={c} />)}
          </div>
        </section>
      )}

      {/* Mobile: sticky rent summary + primary action */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white p-3 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight">{inr(p.rent_from)}<span className="text-sm font-normal text-muted">/mo</span></p>
            <p className="truncate text-xs text-muted">Deposit from {inr(p.deposit_from)} · {beds > 0 ? `${beds} beds free` : "Full"}</p>
          </div>
          <ShortlistButton code={p.code} initial={!!p.is_shortlisted} />
          <div className="w-40"><RequestVisitButton code={p.code} title={p.title} existingRequestId={p.my_open_request_id ?? null} /></div>
        </div>
      </div>
    </div>
  );
}
