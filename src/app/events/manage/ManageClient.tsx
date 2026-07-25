"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Event = {
  id: string;
  title: string;
  description: string;
  event_date: string | null;
  event_time: string | null;
  image_url: string;
  image_key: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export default function ManageClient() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === events.length ? new Set() : new Set(events.map((e) => e.id))
    );
  };

  async function deleteOne(id: string) {
    if (!confirm("Delete this event?")) return;
    const prev = events;
    setEvents((p) => p.filter((e) => e.id !== id));
    setSelected((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setEvents(prev);
      setError("Failed to delete event");
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} event${selected.size !== 1 ? "s" : ""}?`))
      return;
    setBusy(true);
    const ids = Array.from(selected);
    const prev = events;
    setEvents((p) => p.filter((e) => !selected.has(e.id)));
    setSelected(new Set());
    let failed = 0;
    await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
        if (!res.ok) failed += 1;
      })
    );
    if (failed > 0) {
      setEvents(prev);
      setError(`Failed to delete ${failed} event${failed !== 1 ? "s" : ""}`);
    }
    setBusy(false);
  }

  const allSelected = events.length > 0 && selected.size === events.length;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to slideshow
        </Link>
        <div className="text-xs text-zinc-500">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </div>
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Manage events
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Quickly review, select, and remove events. To edit details, click a
          card.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-200/80 hover:text-red-100"
          >
            ×
          </button>
        </div>
      )}

      {events.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100"
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded border ${
                allSelected
                  ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              {allSelected && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          <button
            type="button"
            disabled={selected.size === 0 || busy}
            onClick={deleteSelected}
            className="rounded-md border border-red-900/40 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-500/60 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-red-900/40 disabled:hover:bg-transparent"
          >
            {busy
              ? "Deleting…"
              : selected.size > 0
                ? `Delete ${selected.size} selected`
                : "Delete selected"}
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {events.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              isSelected={selected.has(e.id)}
              onToggle={() => toggle(e.id)}
              onDelete={() => deleteOne(e.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function EventCard({
  event,
  isSelected,
  onToggle,
  onDelete,
}: {
  event: Event;
  isSelected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const dateLabel = useMemo(
    () => formatDateShort(event.event_date, event.event_time),
    [event.event_date, event.event_time]
  );

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border transition ${
        isSelected
          ? "border-emerald-500/60 ring-2 ring-emerald-500/20"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-white/20 bg-black/60 backdrop-blur transition hover:bg-black/80"
        aria-label={isSelected ? "Deselect" : "Select"}
      >
        {isSelected && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-emerald-300"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete event"
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/60 text-red-300 opacity-0 backdrop-blur transition hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-200 group-hover:opacity-100"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      </button>

      <div className="aspect-square w-full overflow-hidden bg-zinc-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.image_url}
          alt={event.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="border-t border-zinc-800/70 bg-zinc-900/60 p-2.5">
        <div className="truncate text-sm font-medium text-zinc-100">
          {event.title}
        </div>
        {dateLabel && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
            {dateLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/5] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-16 text-center">
      <p className="text-sm font-medium text-zinc-300">No events yet</p>
      <p className="mt-1 text-xs text-zinc-500">
        Add events from the slideshow page and they’ll show up here.
      </p>
    </div>
  );
}

function formatDateShort(
  isoDate: string | null,
  isoTime: string | null
): string | null {
  if (!isoDate && !isoTime) return null;
  try {
    const d = new Date(
      `${isoDate ?? "1970-01-01"}T${(isoTime ?? "00:00:00").slice(0, 8)}`
    );
    const parts: string[] = [];
    if (isoDate) {
      parts.push(
        d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    }
    if (isoTime) {
      parts.push(
        d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      );
    }
    return parts.join(" · ");
  } catch {
    return isoDate ?? isoTime;
  }
}
