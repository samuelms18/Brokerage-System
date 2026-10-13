"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBar({ params }: { params: string }) {
  const router = useRouter();
  const [q, setQ] = useState(new URLSearchParams(params).get("q") ?? "");
  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const sp = new URLSearchParams(params);
        if (q.trim()) sp.set("q", q.trim()); else sp.delete("q");
        sp.delete("page");
        router.push(`/?${sp.toString()}`);
      }}
    >
      <label htmlFor="q" className="sr-only">Search by property, area, college or landmark</label>
      <input id="q" className="input" placeholder="Search by area, college or property" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn btn-primary">Search</button>
    </form>
  );
}

export function SortSelect({ params }: { params: string }) {
  const router = useRouter();
  const sp = new URLSearchParams(params);
  const hasCollege = sp.has("college_id");
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Sort
      <select
        className="input h-10 min-h-0 w-auto py-0 text-sm"
        value={sp.get("sort") ?? "recommended"}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("sort", e.target.value);
          router.push(`/?${next.toString()}`, { scroll: false });
        }}
      >
        <option value="recommended">Recommended</option>
        <option value="rent_asc">Lowest rent</option>
        <option value="nearest" disabled={!hasCollege}>Nearest{hasCollege ? "" : " (pick a college)"}</option>
        <option value="newest">Newest</option>
      </select>
    </label>
  );
}
