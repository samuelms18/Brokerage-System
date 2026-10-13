import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/http";
import { sanitizeReturnTo } from "@/lib/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const returnTo = sanitizeReturnTo(next);
  if (await currentUser()) redirect(returnTo);
  const fromProperty = returnTo.startsWith("/p/");

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
      <section className="order-2 md:order-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">For students</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight text-ink md:text-4xl">Verified rooms near your college, without the runaround.</h1>
        <ul className="mt-6 space-y-3 text-muted">
          {[
            "Every listing is checked by our team before it goes live",
            "Clear rent, deposit and brokerage before you commit",
            "One broker handles your visit, from request to move-in",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 flex-none text-brand-600"><path fill="currentColor" d="M8.3 13.6 4.7 10l-1.4 1.4 5 5 9-9-1.4-1.4z" /></svg>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="order-1 md:order-2">
        <div className="card p-6 shadow-sm md:p-8">
          {fromProperty && (
            <p role="status" className="mb-5 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
              Log in to view this property. We&apos;ll take you straight back to it.
            </p>
          )}
          <h2 className="text-xl font-bold">Log in or sign up</h2>
          <p className="mt-1 text-sm text-muted">We&apos;ll send a one-time code to your mobile number.</p>
          <LoginForm returnTo={returnTo} />
        </div>
      </section>
    </div>
  );
}
