"use client";

import { useMemo } from "react";

export type CalendarEvent = {
  id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  image_url: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Cell = {
  day: number;
  iso: string;
  isToday: boolean;
  isPast: boolean;
  events: CalendarEvent[];
};

export default function CalendarSlide({
  events,
  today = new Date(),
}: {
  events: CalendarEvent[];
  today?: Date;
}) {
  const { cells, leadingBlanks, monthLabel, monthEventCount, undatedCount } =
    useMemo(() => buildMonth(events, today), [events, today]);

  return (
    <div className="flex h-full w-full flex-col px-4 py-4 sm:px-8 sm:py-6">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
          {monthLabel}
        </h2>
        <div className="text-right text-[11px] uppercase tracking-[0.18em] text-emerald-300/80 sm:text-xs">
          {monthEventCount} event{monthEventCount === 1 ? "" : "s"} this month
          {undatedCount > 0 && (
            <span className="ml-2 text-white/30">
              · {undatedCount} undated
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 pb-1 sm:gap-1.5">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35 sm:text-xs"
          >
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {cells.map((cell) => (
          <DayCell key={cell.iso} cell={cell} />
        ))}
      </div>
    </div>
  );
}

function DayCell({ cell }: { cell: Cell }) {
  const hasEvents = cell.events.length > 0;
  const hero = cell.events[0];
  const extra = cell.events.length - 1;

  const ring = cell.isToday
    ? "border-emerald-400/70 ring-1 ring-emerald-400/50"
    : hasEvents
      ? "border-emerald-500/25"
      : "border-white/[0.06]";
  const dim = cell.isPast && !cell.isToday ? "opacity-45" : "";

  // Empty day — just the number on a faint tile.
  if (!hero) {
    return (
      <div
        className={`relative flex min-h-0 items-start justify-end overflow-hidden rounded-lg border bg-white/[0.02] p-1 sm:p-1.5 ${ring} ${dim}`}
      >
        <span
          className={`text-[11px] font-semibold tabular-nums sm:text-sm ${
            cell.isToday ? "text-emerald-300" : "text-white/35"
          }`}
        >
          {cell.day}
        </span>
      </div>
    );
  }

  // Day with events — the photo is the tile.
  return (
    <div
      className={`group relative min-h-0 overflow-hidden rounded-lg border ${ring} ${dim}`}
      title={cell.events.map((e) => e.title).join(" · ")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero.image_url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />

      {/* Legibility scrim: darker at the bottom for the title, light veil up top for the date */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/40" />

      <div className="relative flex h-full flex-col justify-between p-1 sm:p-1.5">
        <div className="flex items-start justify-end gap-1">
          {extra > 0 && (
            <span className="rounded-sm bg-emerald-500/85 px-1 text-[8px] font-bold leading-[1.4] text-zinc-950 sm:text-[10px]">
              +{extra}
            </span>
          )}
          <span
            className={`text-[11px] font-bold tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-sm ${
              cell.isToday ? "text-emerald-300" : "text-white"
            }`}
          >
            {cell.day}
          </span>
        </div>

        <div className="min-w-0 truncate text-[8px] font-semibold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] sm:text-[11px]">
          {hero.title}
        </div>
      </div>
    </div>
  );
}

function buildMonth(events: CalendarEvent[], today: Date) {
  const year = today.getFullYear();
  const month = today.getMonth();

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = first.getDay();

  const todayIso = toIso(today);

  // Group dated events by their ISO date, sorted by time within a day.
  const byDate = new Map<string, CalendarEvent[]>();
  let undatedCount = 0;
  for (const e of events) {
    if (!e.event_date) {
      undatedCount += 1;
      continue;
    }
    const key = e.event_date.slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(e);
    byDate.set(key, list);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
  }

  const cells: Cell[] = [];
  let monthEventCount = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toIso(new Date(year, month, day));
    const dayEvents = byDate.get(iso) ?? [];
    monthEventCount += dayEvents.length;
    cells.push({
      day,
      iso,
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      events: dayEvents,
    });
  }

  const monthLabel = first.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return { cells, leadingBlanks, monthLabel, monthEventCount, undatedCount };
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

