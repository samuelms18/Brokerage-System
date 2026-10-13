"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** POST/PUT JSON, surface the problem+json message, refresh server data on success. */
export function usePost() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(url: string, body?: unknown, method = "POST"): Promise<unknown | null> {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
      const fields = data.errors ? Object.values(data.errors as Record<string, string[]>).flat().join(" ") : "";
      setError(fields ? `${data.title}: ${fields}` : data.title ?? "Something went wrong");
      return null;
    }
    router.refresh();
    return data;
  }
  return { busy, error, setError, send };
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? <p role="alert" className="mt-2 text-sm text-critical">{error}</p> : null;
}

/** Default "due" value for datetime-local inputs: tomorrow 10:00 local. */
export function tomorrowAt(hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export const toIso = (local: string) => new Date(local).toISOString();
