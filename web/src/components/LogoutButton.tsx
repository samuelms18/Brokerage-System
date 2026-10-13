"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      aria-label="Log out"
      className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-canvas sm:w-auto sm:px-3"
      onClick={async () => {
        await fetch("/api/v1/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 sm:hidden"><path fill="currentColor" d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5zm6.6 4.6L15.2 9l2 2H9v2h8.2l-2 2 1.4 1.4L21 12z" /></svg>
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
