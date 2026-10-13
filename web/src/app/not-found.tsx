import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">This page isn&apos;t available</h1>
      <p className="mt-2 text-muted">The property may have been let out or is no longer listed.</p>
      <Link href="/" className="btn btn-primary mt-6">Browse properties</Link>
    </div>
  );
}
