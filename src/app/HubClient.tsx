"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

// ────────────────────────────────────────────────────────────
// Hub — the landing screen after staff login.
//
// Deliberately just a launcher: three destinations, no stats. The sections
// below it are kept separate on purpose, so each one links back here rather
// than sideways to its sibling.
// ────────────────────────────────────────────────────────────

export default function HubClient() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-emerald-400"
              aria-hidden
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.27 6.96 12 12.01l8.73-5.05" />
              <path d="M12 22.08V12" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Gaming Dojo
            </h1>
            <p className="text-xs text-zinc-400">Staff hub</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
        >
          Sign out
        </button>
      </header>

      <div className="mt-8 grid flex-1 content-start gap-4 sm:mt-12 sm:grid-cols-2">
        <Tile
          href="/inventory"
          title="Inventory"
          description="Stock levels, costs, and bulk import."
          icon={
            <>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <path d="M3.27 6.96 12 12.01l8.73-5.05" />
              <path d="M12 22.08V12" />
            </>
          }
        />

        <Tile
          href="/events"
          title="Events"
          description="Tournaments and specials shown on the website."
          icon={
            <>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-4.5-4.5-9 9" />
            </>
          }
        />

        <Tile
          href="/members"
          title="Register member"
          description="Hand the tablet to a customer to create their account."
          className="sm:col-span-2"
          icon={
            <>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" />
            </>
          }
        />
      </div>
    </main>
  );
}

function Tile({
  href,
  title,
  description,
  icon,
  className = "",
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      // Generous padding because this is driven by thumbs on a tablet, not a mouse.
      className={`group flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 active:scale-[0.99] sm:p-6 ${className}`}
    >
      <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-950 ring-1 ring-zinc-800 transition group-hover:ring-emerald-500/30">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-zinc-400 transition group-hover:text-emerald-400"
          aria-hidden
        >
          {icon}
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-base font-semibold text-zinc-100 sm:text-lg">
          {title}
        </div>
        <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">{description}</p>
      </div>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-auto h-5 w-5 shrink-0 text-zinc-600 transition group-hover:text-emerald-400"
        aria-hidden
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
