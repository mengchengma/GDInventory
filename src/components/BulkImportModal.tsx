"use client";

import { useMemo, useState, FormEvent } from "react";
import { parseBulkInput, type BulkRow } from "@/lib/bulkParse";

export type { BulkRow };


export default function BulkImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { rows, headerMap } = useMemo(() => parseBulkInput(text), [text]);
  const validRows = useMemo(() => rows.filter((r) => !r._error), [rows]);
  const errorCount = rows.length - validRows.length;
  const mappedFields = useMemo(
    () => (headerMap ? Array.from(new Set(headerMap.values())) : []),
    [headerMap]
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (validRows.length === 0) {
      setErr("Nothing to import — paste some rows first.");
      return;
    }
    if (errorCount > 0) {
      if (
        !confirm(
          `${errorCount} row(s) have errors and will be skipped. Import ${validRows.length} valid row(s)?`
        )
      ) {
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/items/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: validRows.map(
            ({ _lineNumber: _l, _error: _e, ...rest }) => rest
          ),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }
      const data = await res.json();
      onImported(data.inserted ?? validRows.length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-t-2xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-zinc-100">Bulk import</h3>
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
            <div className="mb-1.5 font-medium text-zinc-300">
              Paste a spreadsheet — including the header row
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div>
                • Copy straight out of Google Sheets or Excel. Columns are
                matched by their header name, in any order.
              </div>
              <div>
                • Understood headers:{" "}
                <span className="text-emerald-300">
                  Item Name, SKU, Category, Case Price, Items Per Case, Sale
                  Price, Cases, Loose Units, Low Threshold, Notes
                </span>
              </div>
              <div>
                • Derived columns (Unit Price, Profit Margin, Total) are ignored
                — the app recalculates those.
              </div>
              <div>
                • No header row? Falls back to this fixed order:{" "}
                <span className="text-zinc-300">
                  name, category, units_per_case, cases, loose_units,
                  low_threshold, case_price, sale_price, notes
                </span>
              </div>
              <div>
                • Only <span className="text-zinc-300">name</span> is required.
                Lines starting with # are comments.
              </div>
            </div>
          </div>

          {headerMap && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span className="font-medium">Header detected — mapping:</span>
              {mappedFields.map((f) => (
                <span
                  key={f}
                  className="rounded-sm bg-emerald-500/15 px-1.5 py-px font-mono text-[10px]"
                >
                  {f}
                </span>
              ))}
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Item Name\tSKU\tCase Price\tItems Per Case\tSale Price\nBloom (Crisp Apple)\t842595138214\t$28.00\t12\t$2.99\nC4 (Godzilla)\t842595139099\t$28.00\t12\t$3.50`}
            rows={8}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
          />

          {rows.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <div className="font-medium text-zinc-300">
                  Preview ({rows.length} row{rows.length !== 1 ? "s" : ""})
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-300">
                    {validRows.length} valid
                  </span>
                  {errorCount > 0 && (
                    <span className="text-red-300">
                      {errorCount} with errors
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full text-xs">
                  <thead className="bg-zinc-950/60 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Name</th>
                      <th className="px-2 py-2 text-left font-medium">SKU</th>
                      <th className="px-2 py-2 text-left font-medium">
                        Category
                      </th>
                      <th className="px-2 py-2 text-right font-medium">U/C</th>
                      <th className="px-2 py-2 text-right font-medium">
                        Cases
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        Loose
                      </th>
                      <th className="px-2 py-2 text-right font-medium">Low</th>
                      <th className="px-2 py-2 text-right font-medium">
                        $/case
                      </th>
                      <th className="px-2 py-2 text-right font-medium">
                        $/unit
                      </th>
                      <th className="px-2 py-2 text-left font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {rows.slice(0, 50).map((r) => (
                      <tr
                        key={r._lineNumber}
                        className={
                          r._error
                            ? "bg-red-950/30 text-red-300"
                            : "text-zinc-200"
                        }
                      >
                        <td className="px-2 py-1.5">
                          {r.name || (
                            <span className="text-red-400">—</span>
                          )}
                          {r._error && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-red-400">
                              {r._error}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-zinc-500">
                          {r.sku || <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="px-2 py-1.5 text-zinc-400">
                          {r.category || (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.units_per_case}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.cases}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {r.loose_units}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">
                          {r.min_threshold || ""}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">
                          {r.case_cost === null
                            ? ""
                            : r.case_cost.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-zinc-400">
                          {r.unit_price === null
                            ? ""
                            : r.unit_price.toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-zinc-500">
                          {r.notes && (
                            <span className="line-clamp-1 italic">
                              {r.notes}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 50 && (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-2 py-2 text-center text-[11px] text-zinc-500"
                        >
                          + {rows.length - 50} more row
                          {rows.length - 50 !== 1 ? "s" : ""} (not shown in
                          preview)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {err && (
            <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {err}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-800 p-4 sm:p-5">
          <span className="text-xs text-zinc-500">
            {validRows.length > 0
              ? `Ready to import ${validRows.length} item${
                  validRows.length !== 1 ? "s" : ""
                }`
              : "Paste rows above to preview"}
          </span>
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
              disabled={submitting || validRows.length === 0}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Importing…"
                : `Import ${validRows.length} item${
                    validRows.length !== 1 ? "s" : ""
                  }`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
