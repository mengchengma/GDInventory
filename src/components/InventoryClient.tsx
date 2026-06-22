"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
  KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  name: string;
  quantity: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export default function InventoryClient() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/items", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load items");
        const data = await res.json();
        if (!cancelled) setItems(data.items ?? []);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function addItem(name: string, quantity: number, notes: string) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, quantity, notes }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to add item");
    }
    const data = await res.json();
    setItems((prev) => [data.item, ...prev]);
  }

  async function adjustItem(id: string, delta: number) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it
      )
    );
    try {
      const res = await fetch(`/api/items/${id}/adjust`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      // Reload to recover from optimistic mismatch
      const res = await fetch("/api/items", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    }
  }

  async function patchItem(
    id: string,
    patch: Partial<Pick<Item, "name" | "quantity" | "notes">>
  ) {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update");
    }
    const data = await res.json();
    setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const prev = items;
    setItems((p) => p.filter((it) => it.id !== id));
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(prev);
      setError("Failed to delete item");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.name.toLowerCase().includes(q) || it.notes.toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalQuantity = useMemo(
    () => items.reduce((acc, it) => acc + it.quantity, 0),
    [items]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <Header
        totalItems={items.length}
        totalQuantity={totalQuantity}
        onLogout={logout}
      />

      <div className="mt-6 sm:mt-8">
        <AddItemForm onAdd={addItem} />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Inventory ({filtered.length}
          {query && ` of ${items.length}`})
        </h2>
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search items or notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 sm:w-72"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-200/80 hover:text-red-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState hasItems={items.length > 0} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onAdjust={(d) => adjustItem(item.id, d)}
                onPatch={(p) => patchItem(item.id, p)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="mt-12 pb-6 text-center text-xs text-zinc-600">
        Gaming Dojo Inventory
      </footer>
    </main>
  );
}

function Header({
  totalItems,
  totalQuantity,
  onLogout,
}: {
  totalItems: number;
  totalQuantity: number;
  onLogout: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-emerald-400"
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
          <p className="text-xs text-zinc-400 sm:text-sm">Inventory tracker</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Stat label="Items" value={totalItems} />
        <Stat label="Total units" value={totalQuantity} accent />
        <button
          onClick={onLogout}
          className="ml-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        accent
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={`text-lg font-bold tabular-nums ${
          accent ? "text-emerald-300" : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function AddItemForm({
  onAdd,
}: {
  onAdd: (name: string, quantity: number, notes: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) {
      setErr("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      await onAdd(name.trim(), Number(quantity) || 0, notes);
      setName("");
      setQuantity("0");
      setNotes("");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-4 text-sm font-medium text-zinc-400 transition hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:text-emerald-300"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 transition group-hover:scale-110"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add new item
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-xl sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">New item</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setErr(null);
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Nintendo Switch controller"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Quantity
          </label>
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm tabular-nums text-zinc-100 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional notes…"
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add item"}
        </button>
      </div>
    </form>
  );
}

function ItemCard({
  item,
  onAdjust,
  onPatch,
  onDelete,
}: {
  item: Item;
  onAdjust: (delta: number) => void;
  onPatch: (
    patch: Partial<Pick<Item, "name" | "quantity" | "notes">>
  ) => Promise<void>;
  onDelete: () => void;
}) {
  const [nameDraft, setNameDraft] = useState(item.name);
  const [notesDraft, setNotesDraft] = useState(item.notes);
  const [quantityDraft, setQuantityDraft] = useState(String(item.quantity));
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Sync when item updates from server
  useEffect(() => {
    setNameDraft(item.name);
  }, [item.name]);
  useEffect(() => {
    setNotesDraft(item.notes);
  }, [item.notes]);
  useEffect(() => {
    setQuantityDraft(String(item.quantity));
  }, [item.quantity]);

  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  function onNotesChange(v: string) {
    setNotesDraft(v);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      if (v === item.notes) return;
      setSavingNotes(true);
      try {
        await onPatch({ notes: v });
        flashSaved();
      } finally {
        setSavingNotes(false);
      }
    }, 600);
  }

  async function commitName() {
    const v = nameDraft.trim();
    if (!v || v === item.name) {
      setNameDraft(item.name);
      return;
    }
    try {
      await onPatch({ name: v });
      flashSaved();
    } catch {
      setNameDraft(item.name);
    }
  }

  async function commitQuantity() {
    const n = Math.max(0, Math.trunc(Number(quantityDraft)));
    if (!Number.isFinite(n) || n === item.quantity) {
      setQuantityDraft(String(item.quantity));
      return;
    }
    try {
      await onPatch({ quantity: n });
      flashSaved();
    } catch {
      setQuantityDraft(String(item.quantity));
    }
  }

  function onNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setNameDraft(item.name);
      (e.target as HTMLInputElement).blur();
    }
  }

  function onQuantityKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setQuantityDraft(String(item.quantity));
      (e.target as HTMLInputElement).blur();
    }
  }

  const isLow = item.quantity === 0;

  return (
    <div className="group relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg transition hover:border-zinc-700">
      {savedFlash && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
          Saved
        </div>
      )}

      <input
        type="text"
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={onNameKey}
        className="-mx-1 mb-3 rounded-md bg-transparent px-1 text-lg font-semibold text-zinc-50 outline-none transition hover:bg-zinc-800/50 focus:bg-zinc-800/70 focus:ring-2 focus:ring-emerald-500/30"
      />

      <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <button
          onClick={() => onAdjust(-1)}
          disabled={item.quantity === 0}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-300"
          aria-label="Decrease quantity"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M5 12h14" />
          </svg>
        </button>

        <input
          type="number"
          min={0}
          value={quantityDraft}
          onChange={(e) => setQuantityDraft(e.target.value)}
          onBlur={commitQuantity}
          onKeyDown={onQuantityKey}
          className={`w-full bg-transparent text-center text-4xl font-bold tabular-nums outline-none transition ${
            isLow ? "text-zinc-500" : "text-emerald-300"
          }`}
        />

        <button
          onClick={() => onAdjust(1)}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 active:scale-95"
          aria-label="Increase quantity"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Notes
          </label>
          {savingNotes && (
            <span className="text-[10px] text-zinc-500">Saving…</span>
          )}
        </div>
        <textarea
          value={notesDraft}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">
          Updated {formatRelative(item.updated_at)}
        </span>
        <button
          onClick={onDelete}
          className="rounded-md px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
          aria-label="Delete item"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40"
        />
      ))}
    </div>
  );
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/60">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-zinc-500"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 3v18" />
        </svg>
      </div>
      <p className="text-sm font-medium text-zinc-300">
        {hasItems ? "No matches" : "Nothing in the inventory yet"}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {hasItems
          ? "Try a different search term."
          : "Add your first item using the form above."}
      </p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}
