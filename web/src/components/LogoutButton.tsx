"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="hidden rounded-lg px-3 py-2 text-muted hover:bg-canvas sm:inline-block"
      onClick={async () => {
        await fetch("/api/v1/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      Log out
    </button>
  );
}
