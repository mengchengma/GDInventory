"use client";

import { useMemo } from "react";

export type CalendarEvent = {
  id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
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

      <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-1.5">
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

  const base =
    "relative flex min-h-0 flex-col overflow-hidden rounded-lg border p-1 sm:p-1.5 transition";
  const tone = cell.isToday
    ? "border-emerald-400/70 bg-emerald-400/10 ring-1 ring-emerald-400/40"
    : hasEvents
      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
      : "border-white/[0.06] bg-white/[0.02]";
  const dim = cell.isPast && !cell.isToday ? "opacity-40" : "";

  return (
    <div className={`${base} ${tone} ${dim}`}>
      <div
        className={`mb-0.5 shrink-0 text-right text-[11px] font-semibold tabular-nums sm:text-sm ${
          cell.isToday
            ? "text-emerald-300"
            : hasEvents
              ? "text-white/80"
              : "text-white/40"
        }`}
      >
        {cell.day}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
        {cell.events.slice(0, 2).map((e) => (
          <div
            key={e.id}
            className="truncate rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-medium leading-tight text-emerald-100 sm:text-[11px]"
            title={e.title}
          >
            {e.event_time && (
              <span className="mr-1 tabular-nums text-emerald-300/80">
                {formatTimeShort(e.event_time)}
              </span>
            )}
            {e.title}
          </div>
        ))}
        {cell.events.length > 2 && (
          <div className="px-1 text-[9px] font-medium text-emerald-300/70 sm:text-[10px]">
            +{cell.events.length - 2} more
          </div>
        )}
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

function formatTimeShort(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  if (!Number.isFinite(h)) return t;
  const suffix = h >= 12 ? "p" : "a";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return mStr && mStr !== "00" ? `${h12}:${mStr}${suffix}` : `${h12}${suffix}`;
}
