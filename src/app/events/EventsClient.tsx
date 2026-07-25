"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

const AUTO_ADVANCE_MS = 6000;

export default function EventsClient() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);

  const loadEvents = useCallback(async () => {
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
    loadEvents();
  }, [loadEvents]);

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || events.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % events.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [isPlaying, events.length]);

  // Clamp index if events shrink
  useEffect(() => {
    if (index >= events.length && events.length > 0) setIndex(0);
  }, [events.length, index]);

  const goNext = useCallback(() => {
    if (events.length === 0) return;
    setIndex((i) => (i + 1) % events.length);
  }, [events.length]);
  const goPrev = useCallback(() => {
    if (events.length === 0) return;
    setIndex((i) => (i - 1 + events.length) % events.length);
  }, [events.length]);
  const togglePlay = useCallback(() => setIsPlaying((v) => !v), []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, togglePlay]);

  const currentEvent = events[index];

  async function addEvent(input: {
    title: string;
    description: string;
    event_date: string | null;
    event_time: string | null;
    image_url: string;
    image_key: string | null;
  }) {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to add event");
    }
    const data = await res.json();
    setEvents((prev) => [data.event, ...prev]);
    setIndex(0);
  }

  async function patchEvent(id: string, patch: Partial<Event>) {
    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update");
    }
    const data = await res.json();
    setEvents((prev) => prev.map((e) => (e.id === id ? data.event : e)));
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    const prev = events;
    setEvents((p) => p.filter((e) => e.id !== id));
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setEvents(prev);
      setError("Failed to delete event");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        count={events.length}
        currentIndex={index}
        onAddClick={() => setShowAdd(true)}
      />

      {error && (
        <div className="mx-auto mt-4 flex w-full max-w-4xl items-center justify-between rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-200/80 hover:text-red-100"
          >
            ×
          </button>
        </div>
      )}

      <main className="relative flex flex-1 flex-col">
        {loading ? (
          <SlideshowSkeleton />
        ) : events.length === 0 ? (
          <EmptyEventsState onAdd={() => setShowAdd(true)} />
        ) : (
          <SlideshowStage
            event={currentEvent}
            onNext={goNext}
            onPrev={goPrev}
            onTogglePlay={togglePlay}
            isPlaying={isPlaying}
            hasMultiple={events.length > 1}
            onEdit={() => setEditing(currentEvent)}
          />
        )}

        {events.length > 0 && (
          <SlideshowControls
            index={index}
            total={events.length}
            isPlaying={isPlaying}
            onPrev={goPrev}
            onNext={goNext}
            onTogglePlay={togglePlay}
            onJump={setIndex}
          />
        )}
      </main>

      {showAdd && (
        <AddEventModal
          onClose={() => setShowAdd(false)}
          onAdd={async (input) => {
            await addEvent(input);
            setShowAdd(false);
          }}
        />
      )}

      {editing && (
        <EditEventModal
          event={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await patchEvent(editing.id, patch);
            setEditing(null);
          }}
          onDelete={async () => {
            await deleteEvent(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TopBar({
  count,
  currentIndex,
  onAddClick,
}: {
  count: number;
  currentIndex: number;
  onAddClick: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-900/80 bg-zinc-950/50 px-4 py-3 backdrop-blur sm:px-6">
      <Link
        href="/"
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
        Back to inventory
      </Link>

      <div className="hidden text-center sm:block">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
          Gaming Dojo
        </div>
        <div className="text-sm font-semibold text-zinc-100">Events</div>
      </div>

      <div className="flex items-center gap-3">
        {count > 0 && (
          <span className="hidden text-[11px] tabular-nums text-zinc-500 sm:inline">
            {currentIndex + 1} / {count}
          </span>
        )}
        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add event
        </button>
      </div>
    </header>
  );
}

function SlideshowStage({
  event,
  onNext,
  onPrev,
  onTogglePlay,
  isPlaying,
  hasMultiple,
  onEdit,
}: {
  event: Event;
  onNext: () => void;
  onPrev: () => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
  hasMultiple: boolean;
  onEdit: () => void;
}) {
  const dateLabel = useMemo(
    () => formatDateTime(event.event_date, event.event_time),
    [event.event_date, event.event_time]
  );

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
      {/* Image */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="group absolute inset-0 flex items-center justify-center focus:outline-none"
        aria-label={isPlaying ? "Pause slideshow" : "Resume slideshow"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={event.id}
          src={event.image_url}
          alt={event.title}
          className="max-h-full max-w-full object-contain animate-[fade_400ms_ease-out]"
        />
        {!isPlaying && (
          <span className="pointer-events-none absolute rounded-full bg-black/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white/80 opacity-0 transition group-hover:opacity-100">
            Paused
          </span>
        )}
      </button>

      {/* Prev / Next arrows */}
      {hasMultiple && (
        <>
          <NavArrow direction="prev" onClick={onPrev} />
          <NavArrow direction="next" onClick={onNext} />
        </>
      )}

      {/* Title / date / description overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-6 pb-12 pt-16 sm:px-10">
        <div className="pointer-events-auto mx-auto flex max-w-4xl items-end justify-between gap-4">
          <div className="min-w-0">
            {dateLabel && (
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-300/80">
                {dateLabel}
              </div>
            )}
            <h2 className="truncate text-2xl font-bold text-white sm:text-3xl">
              {event.title}
            </h2>
            {event.description && (
              <p className="mt-2 line-clamp-3 max-w-2xl text-sm text-zinc-200/80">
                {event.description}
              </p>
            )}
          </div>
          <button
            onClick={onEdit}
            className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70 backdrop-blur transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function NavArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const side = direction === "prev" ? "left-3" : "right-3";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous" : "Next"}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur transition hover:border-white/30 hover:bg-black/70 hover:text-white ${side}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        {direction === "prev" ? (
          <path d="M15 18 9 12l6-6" />
        ) : (
          <path d="m9 18 6-6-6-6" />
        )}
      </svg>
    </button>
  );
}

function SlideshowControls({
  index,
  total,
  isPlaying,
  onPrev,
  onNext,
  onTogglePlay,
  onJump,
}: {
  index: number;
  total: number;
  isPlaying: boolean;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 border-t border-zinc-900/80 bg-zinc-950/60 px-4 py-3 backdrop-blur">
      <button
        onClick={onPrev}
        className="rounded-md border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
        aria-label="Previous"
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
          <path d="M15 18 9 12l6-6" />
        </svg>
      </button>

      <button
        onClick={onTogglePlay}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
            <path d="M5 3v18l15-9L5 3z" />
          </svg>
        )}
        {isPlaying ? "Pause" : "Play"}
      </button>

      <button
        onClick={onNext}
        className="rounded-md border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
        aria-label="Next"
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
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      <div className="ml-3 flex items-center gap-1.5">
        {Array.from({ length: Math.min(total, 12) }).map((_, i) => {
          const active = i === index % 12;
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition ${
                active ? "w-6 bg-emerald-400" : "w-1.5 bg-zinc-700 hover:bg-zinc-600"
              }`}
            />
          );
        })}
        {total > 12 && (
          <span className="ml-1 text-[10px] tabular-nums text-zinc-500">
            +{total - 12}
          </span>
        )}
      </div>

      <span className="ml-3 hidden text-[11px] tabular-nums text-zinc-500 sm:inline">
        {index + 1} / {total}
      </span>
    </div>
  );
}

function AddEventModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (input: {
    title: string;
    description: string;
    event_date: string | null;
    event_time: string | null;
    image_url: string;
    image_key: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/events/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);
      setImageKey(data.key);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) return setErr("Title is required");
    if (!imageUrl.trim()) return setErr("Add an image (paste a URL or upload)");
    setSubmitting(true);
    try {
      await onAdd({
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate || null,
        event_time: eventTime || null,
        image_url: imageUrl.trim(),
        image_key: imageKey,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add event");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-zinc-100">New event</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
          <Field label="Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="e.g. Smash tournament — March"
              className={fieldInput}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Event date">
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={`${fieldInput} tabular-nums`}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className={`${fieldInput} tabular-nums`}
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional…"
              className={`${fieldInput} resize-y`}
            />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Image
              <span className="text-red-400">*</span>
            </div>
            <div className="mb-2 inline-flex rounded-md border border-zinc-800 bg-zinc-950 p-0.5">
              <button
                type="button"
                onClick={() => setMode("url")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  mode === "url"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Paste URL
              </button>
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  mode === "upload"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Upload
              </button>
            </div>

            {mode === "url" ? (
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageKey(null);
                }}
                placeholder="https://example.com/photo.jpg"
                className={fieldInput}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/60 p-4">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Choose image…"}
                </button>
                {imageUrl && imageKey && (
                  <div className="mt-2 truncate text-[11px] text-emerald-300">
                    ✓ Uploaded to imgbb
                  </div>
                )}
                {uploadError && (
                  <div className="mt-2 text-[11px] text-red-300">
                    {uploadError}
                  </div>
                )}
                <div className="mt-2 text-[10px] text-zinc-500">
                  Requires <code className="text-zinc-400">IMGBB_API_KEY</code>{" "}
                  to be set. Get a free key at{" "}
                  <a
                    href="https://api.imgbb.com/"
                    target="_blank"
                    rel="noopener"
                    className="text-emerald-400 hover:underline"
                  >
                    api.imgbb.com
                  </a>
                  .
                </div>
              </div>
            )}

            {imageUrl && (
              <div className="mt-2 overflow-hidden rounded-md border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  className="max-h-40 w-full object-cover"
                  onError={() => setErr("Image URL couldn’t be loaded")}
                />
              </div>
            )}
          </div>

          {err && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {err}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 p-4 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add event"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditEventModal({
  event,
  onClose,
  onSave,
  onDelete,
}: {
  event: Event;
  onClose: () => void;
  onSave: (patch: Partial<Event>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(event.title);
  const [eventDate, setEventDate] = useState(event.event_date ?? "");
  const [eventTime, setEventTime] = useState(
    event.event_time ? event.event_time.slice(0, 5) : ""
  );
  const [description, setDescription] = useState(event.description);
  const [imageUrl, setImageUrl] = useState(event.image_url);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) return setErr("Title is required");
    if (!imageUrl.trim()) return setErr("Image URL is required");
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate || null,
        event_time: eventTime || null,
        image_url: imageUrl.trim(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={save}
        className="w-full max-w-lg rounded-t-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">Edit event</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className={fieldInput}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Event date">
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={`${fieldInput} tabular-nums`}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className={`${fieldInput} tabular-nums`}
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${fieldInput} resize-y`}
            />
          </Field>
          <Field label="Image URL" required>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={fieldInput}
            />
          </Field>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {err}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-900/40 px-3 py-2 text-xs font-medium text-red-300 transition hover:border-red-500/60 hover:bg-red-500/10"
          >
            Delete event
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const fieldInput =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20";

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

function SlideshowSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center bg-black">
      <div className="h-64 w-96 max-w-full animate-pulse rounded-lg bg-zinc-900/60" />
    </div>
  );
}

function EmptyEventsState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-emerald-400"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-4.5-4.5-9 9" />
        </svg>
      </div>
      <div>
        <div className="text-lg font-semibold text-zinc-100">
          No events yet
        </div>
        <p className="mt-1 max-w-md text-sm text-zinc-400">
          Add photos from tournaments, meetups, or parties. Once you have a
          few, they’ll auto-advance in a full-screen slideshow.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add your first event
      </button>
    </div>
  );
}

function formatDateTime(
  isoDate: string | null,
  isoTime: string | null
): string | null {
  if (!isoDate && !isoTime) return null;
  try {
    const dateStr = isoDate ?? "1970-01-01";
    const timeStr = (isoTime ?? "00:00:00").slice(0, 8);
    const d = new Date(`${dateStr}T${timeStr}`);
    const dateLabel = isoDate
      ? d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
    const timeLabel = isoTime
      ? d.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
    return [dateLabel, timeLabel].filter(Boolean).join(" · ");
  } catch {
    return isoDate ?? isoTime;
  }
}
