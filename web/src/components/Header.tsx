import Link from "next/link";
import { currentUser } from "@/lib/server/http";
import { LogoutButton } from "./LogoutButton";

export async function Header() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href={user && user.role !== "student" ? "/broker" : "/"} className="flex items-center gap-2 font-bold text-brand-900">
          <svg aria-hidden viewBox="0 0 64 64" className="h-7 w-7"><rect width="64" height="64" rx="14" fill="#0f7668" /><path d="M14 32 32 17l18 15v16a2 2 0 0 1-2 2H38V38H26v12H16a2 2 0 0 1-2-2z" fill="#fff" /></svg>
          <span className={user ? "hidden sm:inline" : ""}>StayNear</span>
        </Link>
        {user && user.role !== "student" && (
          <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-sm font-medium sm:gap-1">
            <span className="mr-2 hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 md:inline">Broker</span>
            <Link href="/broker" className="rounded-lg px-2 py-2 hover:bg-canvas sm:px-3">Dashboard</Link>
            <Link href="/broker/leads" className="rounded-lg px-2 py-2 hover:bg-canvas sm:px-3">Leads</Link>
            <Link href="/broker/brokerage" className="rounded-lg px-2 py-2 hover:bg-canvas sm:px-3">Brokerage</Link>
            <LogoutButton />
          </nav>
        )}
        {user && user.role === "student" && (
          <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-sm font-medium sm:gap-1">
            <Link href="/" className="rounded-lg px-2 py-2 hover:bg-canvas sm:px-3">Browse</Link>
            <Link href="/shortlist" className="rounded-lg px-2 py-2 hover:bg-canvas sm:px-3">Shortlist</Link>
            <Link href="/requests" className="rounded-lg px-2 py-2 hover:bg-canvas sm:px-3"><span className="sm:hidden">Requests</span><span className="hidden sm:inline">My requests</span></Link>
            <LogoutButton />
          </nav>
        )}
      </div>
    </header>
  );
}
