"use client";

import {
  useEffect,
  useMemo,
  useState,
  FormEvent,
  KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BulkImportModal from "@/components/BulkImportModal";
import {
  LOW_MARGIN_PCT,
  formatMoney,
  formatMoneyCompact,
  formatPct,
  marginPct,
  unitCost,
  unitMargin,
  valueAtCost,
  valueAtRetail,
} from "@/lib/money";

type Item = {
  id: string;
  name: string;
  category: string;
  units_per_case: number;
  cases: number;
  loose_units: number;
  min_threshold: number;
  archived: boolean;
  case_cost: number | null;
  unit_price: number | null;
  sku: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

const UNCATEGORIZED = "Uncategorized";

type SortOption = "recent" | "name" | "stock-low" | "stock-high";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Recently added",
  name: "Name (A→Z)",
  "stock-low": "Stock: low first",
  "stock-high": "Stock: high first",
};

function isSortOption(v: string): v is SortOption {
  return v === "recent" || v === "name" || v === "stock-low" || v === "stock-high";
}

function sortItems(items: Item[], sortBy: SortOption): Item[] {
  const arr = [...items];
  switch (sortBy) {
    case "name":
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "stock-low":
      arr.sort((a, b) => totalUnits(a) - totalUnits(b));
      break;
    case "stock-high":
      arr.sort((a, b) => totalUnits(b) - totalUnits(a));
      break;
    case "recent":
    default:
      arr.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      break;
  }
  return arr;
}

function totalUnits(it: Pick<Item, "cases" | "units_per_case" | "loose_units">) {
  return it.cases * it.units_per_case + it.loose_units;
}

function stockState(
  it: Pick<Item, "cases" | "units_per_case" | "loose_units" | "min_threshold">
): "out" | "low" | "ok" {
  const t = totalUnits(it);
  if (t === 0) return "out";
  if (it.min_threshold > 0 && t <= it.min_threshold) return "low";
  return "ok";
}

export default function InventoryClient() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [stockFilters, setStockFilters] = useState<Array<"low" | "out">>([]);

  const toggleStockFilter = (kind: "low" | "out") => {
    setStockFilters((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
    setActiveCategory("All");
  };
  const isStockFilterActive = stockFilters.length > 0;
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [showMoney, setShowMoney] = useState(false);

  useEffect(() => {
    setShowMoney(localStorage.getItem("gd_show_money") === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("gd_show_money", showMoney ? "1" : "0");
  }, [showMoney]);

  // Hydrate sort preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("gd_sort");
    if (saved && isSortOption(saved)) setSortBy(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("gd_sort", sortBy);
  }, [sortBy]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/items?archived=all", { cache: "no-store" });
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

  async function addItem(input: {
    name: string;
    category: string;
    units_per_case: number;
    cases: number;
    loose_units: number;
    min_threshold: number;
    case_cost: number | null;
    unit_price: number | null;
    sku: string;
    notes: string;
  }) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to add item");
    }
    const data = await res.json();
    setItems((prev) => [...prev, data.item]);
  }

  async function patchItem(id: string, patch: Partial<Item>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
    try {
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
      return data.item as Item;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      const res = await fetch("/api/items?archived=all", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
      throw err;
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item forever? This cannot be undone.")) return;
    const prev = items;
    setItems((p) => p.filter((it) => it.id !== id));
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(prev);
      setError("Failed to delete item");
    }
  }

  async function renameCategory(from: string, to: string) {
    if (from === UNCATEGORIZED) {
      setError("Can't rename the Uncategorized group");
      return;
    }
    const cleanTo = to.trim();
    if (!cleanTo || cleanTo === from) return;

    // Optimistic
    setItems((prev) =>
      prev.map((it) => (it.category === from ? { ...it, category: cleanTo } : it))
    );
    try {
      const res = await fetch("/api/categories/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to: cleanTo }),
      });
      if (!res.ok) throw new Error("Failed to rename category");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
      const res = await fetch("/api/items?archived=all", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    }
  }

  const activeItems = useMemo(
    () => items.filter((it) => !it.archived),
    [items]
  );
  const archivedItems = useMemo(
    () => items.filter((it) => it.archived),
    [items]
  );

  const visibleItems = showArchived ? archivedItems : activeItems;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of visibleItems) {
      set.add(it.category || UNCATEGORIZED);
    }
    return Array.from(set).sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [visibleItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleItems.filter((it) => {
      const cat = it.category || UNCATEGORIZED;
      if (activeCategory !== "All" && cat !== activeCategory) return false;
      if (stockFilters.length > 0) {
        const s = stockState(it);
        if (s === "ok") return false;
        if (!stockFilters.includes(s)) return false;
      }
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.notes.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (it.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [visibleItems, query, activeCategory, stockFilters]);

  const flatItems = useMemo(
    () => sortItems(filtered, sortBy),
    [filtered, sortBy]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of filtered) {
      const cat = it.category || UNCATEGORIZED;
      const list = map.get(cat) ?? [];
      list.push(it);
      map.set(cat, list);
    }
    return Array.from(map.entries())
      .map(([cat, list]) => [cat, sortItems(list, sortBy)] as const)
      .sort(([a], [b]) => {
        if (a === UNCATEGORIZED) return 1;
        if (b === UNCATEGORIZED) return -1;
        return a.localeCompare(b);
      });
  }, [filtered, sortBy]);

  // Stats only count active items
  const stats = useMemo(() => {
    let cases = 0;
    let units = 0;
    let low = 0;
    let outOfStock = 0;
    let cost = 0;
    let retail = 0;
    let pricedCount = 0;
    for (const it of activeItems) {
      cases += it.cases;
      units += totalUnits(it);
      const s = stockState(it);
      if (s === "out") outOfStock += 1;
      else if (s === "low") low += 1;

      const c = valueAtCost(it);
      const r = valueAtRetail(it);
      if (c !== null) cost += c;
      if (r !== null) retail += r;
      if (c !== null || r !== null) pricedCount += 1;
    }
    return {
      cases,
      units,
      low,
      outOfStock,
      cost,
      retail,
      profit: retail - cost,
      pricedCount,
    };
  }, [activeItems]);

  const allCategoryNames = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.category) set.add(it.category);
    }
    return Array.from(set).sort();
  }, [items]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <TopBar
        stats={stats}
        activeFilters={stockFilters}
        onToggleLow={() => toggleStockFilter("low")}
        onToggleOut={() => toggleStockFilter("out")}
        showMoney={showMoney}
        onLogout={logout}
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
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
            placeholder="Search beverages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <button
          onClick={() => setShowBulkImport(true)}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          Import
        </button>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
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
          Add item
        </button>
      </div>

      <CategoryChips
        categories={categories}
        active={activeCategory}
        onChange={setActiveCategory}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          onClick={() => {
            setShowArchived((v) => !v);
            setActiveCategory("All");
          }}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium transition ${
            showArchived
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
          >
            <rect x="2" y="4" width="20" height="5" rx="1" />
            <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M10 13h4" />
          </svg>
          {showArchived ? "Viewing archived" : "Show archived"}
          {archivedItems.length > 0 && (
            <span className="ml-0.5 rounded-sm bg-zinc-800 px-1.5 py-px text-[10px] text-zinc-400">
              {archivedItems.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMoney((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-medium transition ${
              showMoney
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            }`}
            title="Show cost, price and margin"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
              aria-hidden
            >
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Pricing
          </button>
          <SortPicker value={sortBy} onChange={setSortBy} />
        </div>
      </div>

      {showAddForm && (
        <div className="mt-4">
          <AddItemForm
            existingCategories={allCategoryNames}
            onCancel={() => setShowAddForm(false)}
            onAdd={async (input) => {
              await addItem(input);
              setShowAddForm(false);
            }}
          />
        </div>
      )}

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

      <div className="mt-5">
        {isStockFilterActive && (
          <StockFilterBanner
            activeFilters={stockFilters}
            count={flatItems.length}
          />
        )}

        {loading ? (
          <SkeletonList />
        ) : isStockFilterActive ? (
          flatItems.length === 0 ? (
            <EmptyStockState activeFilters={stockFilters} />
          ) : (
            <FlatItemList
              items={flatItems}
              onPatch={patchItem}
              onEdit={(it) => setEditing(it)}
              showMoney={showMoney}
            />
          )
        ) : grouped.length === 0 ? (
          <EmptyState
            mode={
              showArchived
                ? "archived"
                : items.length > 0
                  ? "no-matches"
                  : "empty"
            }
          />
        ) : (
          <div className="space-y-7">
            {grouped.map(([category, list]) => (
              <CategorySection
                key={category}
                category={category}
                items={list}
                onPatch={patchItem}
                onEdit={(it) => setEditing(it)}
                onRenameCategory={renameCategory}
                showMoney={showMoney}
              />
            ))}
          </div>
        )}
      </div>

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onImported={async () => {
            setShowBulkImport(false);
            const res = await fetch("/api/items?archived=all", {
              cache: "no-store",
            });
            if (res.ok) {
              const data = await res.json();
              setItems(data.items ?? []);
            }
          }}
        />
      )}

      {editing && (
        <EditItemModal
          item={editing}
          existingCategories={allCategoryNames}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await patchItem(editing.id, patch);
            setEditing(null);
          }}
          onArchive={async () => {
            await patchItem(editing.id, { archived: !editing.archived });
            setEditing(null);
          }}
          onDelete={async () => {
            await deleteItem(editing.id);
            setEditing(null);
          }}
        />
      )}

      <footer className="mt-12 pb-6 text-center text-xs text-zinc-600">
        Gaming Dojo Inventory
      </footer>
    </main>
  );
}

function TopBar({
  stats,
  activeFilters,
  onToggleLow,
  onToggleOut,
  showMoney,
  onLogout,
}: {
  stats: {
    cases: number;
    units: number;
    low: number;
    outOfStock: number;
    cost: number;
    retail: number;
    profit: number;
    pricedCount: number;
  };
  activeFilters: Array<"low" | "out">;
  onToggleLow: () => void;
  onToggleOut: () => void;
  showMoney: boolean;
  onLogout: () => void;
}) {
  return (
    <header>
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30 sm:h-11 sm:w-11">
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
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              Gaming Dojo
            </h1>
            <p className="text-[11px] text-zinc-400 sm:text-xs">
              Inventory tracker
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Sections are reached through the hub, not sideways from each other. */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-300"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Hub
          </Link>
          <button
            onClick={onLogout}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <StatBox label="Total cases" value={stats.cases} />
        <StatBox label="Total units" value={stats.units} tone="emerald" />
        <StatBox
          label="Low stock"
          value={stats.low}
          tone="amber"
          onClick={onToggleLow}
          active={activeFilters.includes("low")}
        />
        <StatBox
          label="Out of stock"
          value={stats.outOfStock}
          tone="danger"
          onClick={onToggleOut}
          active={activeFilters.includes("out")}
        />
      </div>

      {showMoney && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-3 sm:gap-3">
          <StatBox
            label="Stock value (cost)"
            display={formatMoneyCompact(stats.cost)}
          />
          <StatBox
            label="Retail value"
            display={formatMoneyCompact(stats.retail)}
          />
          <StatBox
            label="Potential profit"
            display={formatMoneyCompact(stats.profit)}
            tone="emerald"
          />
        </div>
      )}
    </header>
  );
}

function StatBox({
  label,
  value,
  display,
  tone = "default",
  onClick,
  active = false,
}: {
  label: string;
  value?: number;
  /** Pre-formatted text (e.g. currency). Falls back to `value`. */
  display?: string;
  tone?: "default" | "emerald" | "amber" | "danger";
  onClick?: () => void;
  active?: boolean;
}) {
  let toneClasses = "border-zinc-800 bg-zinc-900/60 text-zinc-100";
  if (tone === "emerald") {
    toneClasses = "border-emerald-500/30 bg-emerald-500/5 text-emerald-300";
  } else if (tone === "amber") {
    toneClasses =
      (value ?? 0) > 0
        ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
        : "border-zinc-800 bg-zinc-900/60 text-zinc-300";
  } else if (tone === "danger") {
    toneClasses =
      (value ?? 0) > 0
        ? "border-red-500/30 bg-red-500/5 text-red-300"
        : "border-zinc-800 bg-zinc-900/60 text-zinc-300";
  }

  const activeRing =
    active && tone === "amber"
      ? "ring-2 ring-amber-500/40"
      : active && tone === "danger"
        ? "ring-2 ring-red-500/40"
        : "";
  const interactive = onClick
    ? "cursor-pointer transition hover:brightness-125 active:scale-[0.98]"
    : "";

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left sm:px-4 sm:py-3.5 ${toneClasses} ${activeRing} ${interactive}`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:text-[11px]">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold tabular-nums sm:text-2xl">
        {display ?? value}
      </div>
    </Wrapper>
  );
}

function SortPicker({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-zinc-500">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
        aria-hidden
      >
        <path d="M3 6h13M3 12h9M3 18h5M17 8V3M17 3l-3 3M17 3l3 3M21 16v5M21 21l3-3M21 21l-3-3" />
      </svg>
      <span className="font-medium text-zinc-400">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-xs font-medium text-zinc-200 outline-none transition hover:border-zinc-700 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
      >
        {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
          <option key={k} value={k} className="bg-zinc-900">
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

function CategoryChips({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (c: string) => void;
}) {
  const all = ["All", ...categories];

  return (
    <div className="mt-4 -mx-1 flex flex-wrap gap-1.5 px-1">
      {all.map((c) => {
        const isActive = c === active;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              isActive
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function AddItemForm({
  existingCategories,
  onAdd,
  onCancel,
}: {
  existingCategories: string[];
  onAdd: (input: {
    name: string;
    category: string;
    units_per_case: number;
    cases: number;
    loose_units: number;
    min_threshold: number;
    case_cost: number | null;
    unit_price: number | null;
    sku: string;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unitsPerCase, setUnitsPerCase] = useState("24");
  const [cases, setCases] = useState("0");
  const [loose, setLoose] = useState("0");
  const [threshold, setThreshold] = useState("0");
  const [caseCost, setCaseCost] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [sku, setSku] = useState("");
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
      await onAdd({
        name: name.trim(),
        category: category.trim(),
        units_per_case: Math.max(1, Number(unitsPerCase) || 1),
        cases: Math.max(0, Number(cases) || 0),
        loose_units: Math.max(0, Number(loose) || 0),
        min_threshold: Math.max(0, Number(threshold) || 0),
        case_cost: caseCost.trim() === "" ? null : Number(caseCost),
        unit_price: unitPrice.trim() === "" ? null : Number(unitPrice),
        sku: sku.trim(),
        notes,
      });
      setName("");
      setCategory("");
      setUnitsPerCase("24");
      setCases("0");
      setLoose("0");
      setThreshold("0");
      setCaseCost("");
      setUnitPrice("");
      setSku("");
      setNotes("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSubmitting(false);
    }
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
          onClick={onCancel}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Cancel
        </button>
      </div>

      <datalist id="category-list">
        {existingCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Coca-Cola"
            className={fieldInput}
          />
        </Field>
        <Field label="Category">
          <input
            type="text"
            list="category-list"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. CAN SODA"
            className={fieldInput}
          />
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Units / case">
          <input
            type="number"
            min={1}
            value={unitsPerCase}
            onChange={(e) => setUnitsPerCase(e.target.value)}
            className={`${fieldInput} tabular-nums`}
          />
        </Field>
        <Field label="Cases">
          <input
            type="number"
            min={0}
            value={cases}
            onChange={(e) => setCases(e.target.value)}
            className={`${fieldInput} tabular-nums`}
          />
        </Field>
        <Field label="Loose units">
          <input
            type="number"
            min={0}
            value={loose}
            onChange={(e) => setLoose(e.target.value)}
            className={`${fieldInput} tabular-nums`}
          />
        </Field>
        <Field
          label="Low at"
          hint="Warn when total units ≤ this. 0 = off."
        >
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className={`${fieldInput} tabular-nums`}
          />
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Case price" hint="you pay">
          <MoneyInput value={caseCost} onChange={setCaseCost} />
        </Field>
        <Field label="Sale price" hint="per unit">
          <MoneyInput value={unitPrice} onChange={setUnitPrice} />
        </Field>
        <Field label="SKU">
          <input
            type="text"
            inputMode="numeric"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Optional"
            className={`${fieldInput} tabular-nums`}
          />
        </Field>
      </div>

      <MarginHint
        caseCost={caseCost}
        unitPrice={unitPrice}
        unitsPerCase={unitsPerCase}
      />

      <div className="mt-3">
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional…"
            className={`${fieldInput} resize-y`}
          />
        </Field>
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

const fieldInput =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20";

function MoneyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
        $
      </span>
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className={`${fieldInput} pl-7 tabular-nums`}
      />
    </div>
  );
}

/** Live "→ $0.77/unit · $1.23 margin · 61%" readout under the cost fields. */
function MarginHint({
  caseCost,
  unitPrice,
  unitsPerCase,
}: {
  caseCost: string;
  unitPrice: string;
  unitsPerCase: string;
}) {
  const per = Math.max(1, Number(unitsPerCase) || 1);
  const cost = caseCost.trim() === "" ? null : Number(caseCost);
  const price = unitPrice.trim() === "" ? null : Number(unitPrice);

  if (cost === null && price === null) return null;
  if (cost !== null && !Number.isFinite(cost)) return null;
  if (price !== null && !Number.isFinite(price)) return null;

  const perUnit = cost === null ? null : cost / per;
  const margin = perUnit === null || price === null ? null : price - perUnit;
  const pct =
    margin === null || price === null || price === 0
      ? null
      : (margin / price) * 100;

  const tone =
    margin === null
      ? "text-zinc-500"
      : margin < 0
        ? "text-red-300"
        : pct !== null && pct < LOW_MARGIN_PCT
          ? "text-amber-300"
          : "text-emerald-300";

  return (
    <div className={`mt-2 text-[11px] tabular-nums ${tone}`}>
      {perUnit !== null && <>{formatMoney(perUnit)} unit price</>}
      {margin !== null && (
        <>
          {" · "}
          {formatMoney(margin)} profit
          {pct !== null && <> · {formatPct(pct)}</>}
          {margin < 0 && " — selling below cost"}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
        {required && <span className="text-red-400">*</span>}
        {hint && (
          <span className="ml-auto normal-case tracking-normal text-zinc-600">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function StockFilterBanner({
  activeFilters,
  count,
}: {
  activeFilters: Array<"low" | "out">;
  count: number;
}) {
  const hasLow = activeFilters.includes("low");
  const hasOut = activeFilters.includes("out");
  const both = hasLow && hasOut;

  const tone = both
    ? "border-zinc-700/60 bg-zinc-800/40 text-zinc-200"
    : hasLow
      ? "border-amber-500/30 bg-amber-500/5 text-amber-200"
      : "border-red-500/30 bg-red-500/5 text-red-200";

  const label = both
    ? "low + out-of-stock"
    : hasLow
      ? "low-stock"
      : "out-of-stock";

  return (
    <div
      className={`mb-4 rounded-lg border px-3 py-2 text-xs ${tone}`}
    >
      Showing <span className="font-semibold tabular-nums">{count}</span>{" "}
      {label} item{count === 1 ? "" : "s"} · click the stat again to untoggle
    </div>
  );
}

function FlatItemList({
  items,
  onPatch,
  onEdit,
  showMoney,
}: {
  items: Item[];
  onPatch: (id: string, patch: Partial<Item>) => Promise<Item>;
  onEdit: (item: Item) => void;
  showMoney: boolean;
}) {
  return (
    <div>
      <ColumnHeader showMoney={showMoney} />
      <div className="divide-y divide-zinc-900 rounded-xl border border-zinc-800/70 bg-zinc-900/30">
        {items.map((it) => (
          <ItemRow
            key={it.id}
            item={it}
            onPatch={onPatch}
            onEdit={onEdit}
            showCategory
            showMoney={showMoney}
          />
        ))}
      </div>
    </div>
  );
}

/** Grid template shared by the column header and every row, so they stay aligned. */
const ROW_GRID = "sm:grid-cols-[1fr_140px_140px_90px_36px]";
const ROW_GRID_MONEY =
  "sm:grid-cols-[1fr_120px_120px_80px_78px_78px_92px_36px]";

function ColumnHeader({ showMoney }: { showMoney: boolean }) {
  return (
    <div
      className={`hidden gap-3 px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:grid ${
        showMoney ? ROW_GRID_MONEY : ROW_GRID
      }`}
    >
      <div>Item</div>
      <div className="text-center">Cases</div>
      <div className="text-center">Loose units</div>
      <div className="text-right">Total</div>
      {showMoney && (
        <>
          <div className="text-right">Unit price</div>
          <div className="text-right">Sale price</div>
          <div className="text-right">Profit margin</div>
        </>
      )}
      <div />
    </div>
  );
}

function EmptyStockState({
  activeFilters,
}: {
  activeFilters: Array<"low" | "out">;
}) {
  const hasLow = activeFilters.includes("low");
  const hasOut = activeFilters.includes("out");
  const both = hasLow && hasOut;

  const title = both
    ? "Everything is well stocked"
    : hasLow
      ? "Nothing is running low"
      : "Nothing is out of stock";
  const sub = both
    ? "No low-stock or out-of-stock items right now."
    : hasLow
      ? "No low-stock items right now."
      : "No out-of-stock items right now.";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/60">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-emerald-400"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

function CategorySection({
  category,
  items,
  onPatch,
  onEdit,
  onRenameCategory,
  showMoney,
}: {
  category: string;
  items: Item[];
  onPatch: (id: string, patch: Partial<Item>) => Promise<Item>;
  onEdit: (item: Item) => void;
  onRenameCategory: (from: string, to: string) => Promise<void>;
  showMoney: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(category);
  const sectionTotal = items.reduce((acc, it) => acc + totalUnits(it), 0);
  const canRename = category !== UNCATEGORIZED;

  async function commitRename() {
    const next = draft.trim();
    setRenaming(false);
    if (next && next !== category) {
      await onRenameCategory(category, next);
    } else {
      setDraft(category);
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-zinc-800/80 pb-2">
        {renaming ? (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(category);
                setRenaming(false);
              }
            }}
            className="flex-1 rounded-md border border-emerald-500/40 bg-zinc-950 px-2 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300 outline-none"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
              {category}
            </h2>
            {canRename && (
              <button
                onClick={() => {
                  setDraft(category);
                  setRenaming(true);
                }}
                className="rounded p-0.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Rename category"
                title="Rename category"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            )}
          </div>
        )}
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">
          {items.length} {items.length === 1 ? "item" : "items"} · {sectionTotal} units
        </span>
      </div>

      <ColumnHeader showMoney={showMoney} />

      <div className="divide-y divide-zinc-900 rounded-xl border border-zinc-800/70 bg-zinc-900/30">
        {items.map((it) => (
          <ItemRow
            key={it.id}
            item={it}
            onPatch={onPatch}
            onEdit={onEdit}
            showMoney={showMoney}
          />
        ))}
      </div>
    </section>
  );
}

function ItemRow({
  item,
  onPatch,
  onEdit,
  showCategory = false,
  showMoney = false,
}: {
  item: Item;
  onPatch: (id: string, patch: Partial<Item>) => Promise<Item>;
  onEdit: (item: Item) => void;
  showCategory?: boolean;
  showMoney?: boolean;
}) {
  const t = totalUnits(item);
  const state = stockState(item);
  const cost = unitCost(item);
  const margin = unitMargin(item);
  const pct = marginPct(item);
  const isThinMargin = pct !== null && pct < LOW_MARGIN_PCT;

  async function setField(field: "cases" | "loose_units", value: number) {
    const clean = Math.max(0, Math.trunc(value));
    if (clean === item[field]) return;
    try {
      await onPatch(item.id, { [field]: clean });
    } catch {
      /* parent handles error */
    }
  }

  const totalColor =
    state === "out"
      ? "text-red-400"
      : state === "low"
        ? "text-amber-300"
        : "text-emerald-300";

  return (
    <div
      className={`grid grid-cols-1 items-center gap-3 px-3 py-3 ${
        showMoney ? ROW_GRID_MONEY : ROW_GRID
      } ${item.archived ? "opacity-60" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(item)}
            className="block truncate text-left text-sm font-medium text-zinc-100 transition hover:text-emerald-300"
          >
            {item.name || "(unnamed)"}
          </button>
          {state === "low" && (
            <span className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/30">
              Low
            </span>
          )}
          {showMoney && isThinMargin && (
            <span className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/30">
              Thin
            </span>
          )}
          {item.archived && (
            <span className="shrink-0 rounded-sm bg-zinc-800 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-zinc-400">
              Archived
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
          {showCategory && (
            <>
              <span className="rounded-sm bg-zinc-800/70 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                {item.category || UNCATEGORIZED}
              </span>
              <span className="text-zinc-700">•</span>
            </>
          )}
          <span>{item.units_per_case} units/case</span>
          {showMoney && item.sku && (
            <>
              <span className="text-zinc-700">•</span>
              <span className="tabular-nums">{item.sku}</span>
            </>
          )}
          {item.min_threshold > 0 && (
            <>
              <span className="text-zinc-700">•</span>
              <span>low at ≤{item.min_threshold}</span>
            </>
          )}
          {item.notes && (
            <>
              <span className="text-zinc-700">•</span>
              <span className="truncate italic">{item.notes}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:justify-center">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 sm:hidden">
          Cases
        </span>
        <NumberAdjuster
          value={item.cases}
          onChange={(v) => setField("cases", v)}
        />
      </div>

      <div className="flex items-center gap-2 sm:justify-center">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 sm:hidden">
          Loose
        </span>
        <NumberAdjuster
          value={item.loose_units}
          onChange={(v) => setField("loose_units", v)}
        />
      </div>

      <div
        className={`text-sm font-semibold tabular-nums sm:text-right ${totalColor}`}
      >
        <span className="sm:hidden text-[10px] uppercase tracking-wider text-zinc-500 not-italic">
          Total:{" "}
        </span>
        {t} <span className="text-[10px] font-normal text-zinc-500">units</span>
      </div>

      {showMoney && (
        <>
          <MoneyCell label="Unit price" value={formatMoney(cost)} muted />
          <MoneyCell label="Sale price" value={formatMoney(item.unit_price)} />
          <MoneyCell
            label="Profit margin"
            value={formatMoney(margin)}
            sub={pct === null ? undefined : formatPct(pct)}
            tone={
              margin === null
                ? "muted"
                : margin < 0
                  ? "danger"
                  : isThinMargin
                    ? "warn"
                    : "good"
            }
          />
        </>
      )}

      <button
        onClick={() => onEdit(item)}
        className="hidden h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200 sm:flex"
        aria-label="Edit item"
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
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
    </div>
  );
}

function MoneyCell({
  label,
  value,
  sub,
  tone = "default",
  muted = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "danger" | "muted";
  muted?: boolean;
}) {
  const color =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "danger"
          ? "text-red-400"
          : muted || tone === "muted"
            ? "text-zinc-400"
            : "text-zinc-200";

  return (
    <div className="flex items-baseline gap-2 sm:block sm:text-right">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 sm:hidden">
        {label}
      </span>
      <span className={`text-sm font-medium tabular-nums ${color}`}>
        {value}
      </span>
      {sub && (
        <span className="text-[10px] tabular-nums text-zinc-500 sm:ml-1">
          {sub}
        </span>
      )}
    </div>
  );
}

function NumberAdjuster({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const n = Math.max(0, Math.trunc(Number(draft)));
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    if (n !== value) onChange(n);
    else setDraft(String(value));
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setDraft(String(value));
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        aria-label="Decrease"
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
          <path d="M5 12h14" />
        </svg>
      </button>
      <input
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className="h-8 w-full min-w-0 bg-transparent text-center text-sm font-semibold tabular-nums text-zinc-100 outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-400 transition hover:bg-emerald-500/10 hover:text-emerald-300 active:scale-95"
        aria-label="Increase"
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
      </button>
    </div>
  );
}

function EditItemModal({
  item,
  existingCategories,
  onClose,
  onSave,
  onArchive,
  onDelete,
}: {
  item: Item;
  existingCategories: string[];
  onClose: () => void;
  onSave: (patch: Partial<Item>) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unitsPerCase, setUnitsPerCase] = useState(String(item.units_per_case));
  const [threshold, setThreshold] = useState(String(item.min_threshold));
  const [caseCost, setCaseCost] = useState(
    item.case_cost === null ? "" : String(item.case_cost)
  );
  const [unitPrice, setUnitPrice] = useState(
    item.unit_price === null ? "" : String(item.unit_price)
  );
  const [sku, setSku] = useState(item.sku ?? "");
  const [notes, setNotes] = useState(item.notes);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErr("Name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        category: category.trim(),
        units_per_case: Math.max(1, Number(unitsPerCase) || 1),
        min_threshold: Math.max(0, Number(threshold) || 0),
        case_cost: caseCost.trim() === "" ? null : Number(caseCost),
        unit_price: unitPrice.trim() === "" ? null : Number(unitPrice),
        sku: sku.trim(),
        notes,
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
          <h3 className="text-base font-semibold text-zinc-100">
            Edit item
            {item.archived && (
              <span className="ml-2 rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Archived
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close"
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

        <datalist id="edit-category-list">
          {existingCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="space-y-3">
          <Field label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={fieldInput}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px_110px]">
            <Field label="Category">
              <input
                type="text"
                list="edit-category-list"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="(uncategorized)"
                className={fieldInput}
              />
            </Field>
            <Field label="Units / case">
              <input
                type="number"
                min={1}
                value={unitsPerCase}
                onChange={(e) => setUnitsPerCase(e.target.value)}
                className={`${fieldInput} tabular-nums`}
              />
            </Field>
            <Field label="Low at">
              <input
                type="number"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className={`${fieldInput} tabular-nums`}
              />
            </Field>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Case price" hint="you pay">
                <MoneyInput value={caseCost} onChange={setCaseCost} />
              </Field>
              <Field label="Sale price" hint="per unit">
                <MoneyInput value={unitPrice} onChange={setUnitPrice} />
              </Field>
              <Field label="SKU">
                <input
                  type="text"
                  inputMode="numeric"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Optional"
                  className={`${fieldInput} tabular-nums`}
                />
              </Field>
            </div>
            <MarginHint
              caseCost={caseCost}
              unitPrice={unitPrice}
              unitsPerCase={unitsPerCase}
            />
          </div>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${fieldInput} resize-y`}
            />
          </Field>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {err}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onArchive}
              className="rounded-lg border border-amber-700/50 px-3 py-2 text-xs font-medium text-amber-300 transition hover:border-amber-500/60 hover:bg-amber-500/10"
            >
              {item.archived ? "Restore" : "Archive"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
            >
              Delete forever
            </button>
          </div>
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

function SkeletonList() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i}>
          <div className="mb-2 h-3 w-32 animate-pulse rounded bg-zinc-800/60" />
          <div className="h-40 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  mode,
}: {
  mode: "empty" | "no-matches" | "archived";
}) {
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
        {mode === "empty"
          ? "Nothing in the inventory yet"
          : mode === "archived"
            ? "No archived items"
            : "No matches"}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {mode === "empty"
          ? "Click “Add item” to add your first beverage."
          : mode === "archived"
            ? "Items you archive will appear here."
            : "Try a different search term or category."}
      </p>
    </div>
  );
}
