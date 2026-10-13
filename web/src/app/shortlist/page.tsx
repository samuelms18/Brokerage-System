import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentPage } from "@/lib/page-auth";
import { shortlistCards } from "@/lib/server/shortlist";
import { ListingCard } from "@/components/ListingCard";

export const metadata: Metadata = { title: "Shortlist" };

export default async function ShortlistPage() {
  const { user, collegeId } = await requireStudentPage("/shortlist");
  const cards = shortlistCards(user.id, collegeId);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold">Your shortlist</h1>
      <p className="mt-1 text-sm text-muted">Saved privately. Nobody is contacted until you request a visit.</p>
      {cards.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map((c) => <ListingCard key={c.code} card={c} />)}</div>
      ) : (
        <div className="card mt-6 p-8 text-center">
          <p className="font-semibold">No saved properties yet</p>
          <p className="mt-1 text-sm text-muted">Tap the heart on any property to save it here.</p>
          <Link href="/" className="btn btn-primary mt-4">Browse properties</Link>
        </div>
      )}
    </div>
  );
}
