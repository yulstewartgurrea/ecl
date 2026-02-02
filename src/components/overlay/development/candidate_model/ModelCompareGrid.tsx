// components/overlay/development/candidate_model/ModelCompareGrid.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ----------------------- Types ----------------------- */

export type ModelVariable = {
  name: string;
  coeff_X1: number;
  "p-value_X1": number | string;
  vif_X1?: number | string;
  raw?: number | string;   // ← change this line
};




export type ModelMetrics = {
  Adj_R_Squared?: number; // 0..1
  RMSE?: number;
  MAPE?: number | string;
  R_Squared?: number | string;
};

export type ModelSpec = {
  title: string;
  variables: ModelVariable[];
  metrics?: ModelMetrics;
  previewUrl?: string;

  // extras used by Step 6/7
  raw?: any;                         // the original server row
  index?: number;                    // internal index
  Y?: string;
  X1?: string;
  X2?: string;
  R_Squared?: number | string;
  Adj_R_Squared?: number | string;
  MAPE?: number | string;
};

export type ModelCompareGridProps = {
  models: ModelSpec[];
  className?: string;

  /** index of the card currently centered in the scroller */
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;

  /** index the user chose (selected model) */
  chosenIndex?: number | null;
  onChosenIndexChange?: (index: number) => void;

  /** enable/disable choosing; default: true */
  selectable?: boolean;
};

/* ----------------------- Grid ----------------------- */

export function ModelCompareGrid({
  models,
  className,
  selectedIndex,
  onSelectedIndexChange,
  chosenIndex,
  onChosenIndexChange,
  selectable = true,
}: ModelCompareGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // internal fallbacks if not controlled
  const [internalIndex, setInternalIndex] = useState(0);
  const [internalChosen, setInternalChosen] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(4);
  const [page, setPage] = useState(0);

  const activeIndex = selectedIndex ?? internalIndex;
  const pickedIndex = chosenIndex ?? internalChosen ?? -1;

  function setIndex(idx: number) {
    const clamped = Math.max(0, Math.min(idx, models.length - 1));
    if (selectedIndex == null) setInternalIndex(clamped);
    onSelectedIndexChange?.(clamped);
    const nextPage = Math.floor(clamped / pageSize);
    setPage(nextPage);
  }

  function choose(idx: number) {
    if (!selectable) return;
    if (chosenIndex == null) setInternalChosen(idx);
    onChosenIndexChange?.(idx);
  }

  // Responsive page size based on available width
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const width = el.clientWidth;
      const next =
        width < 640 ? 1 : width < 900 ? 2 : width < 1200 ? 3 : 4;
      setPageSize(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(activeIndex, models.length - 1));
    const nextPage = Math.floor(clamped / pageSize);
    setPage(nextPage);
  }, [activeIndex, models.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(models.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, models.length);
  const visibleModels = models.slice(pageStart, pageEnd);

  const prevPage = () => setPage((p) => Math.max(0, p - 1));
  const nextPage = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  return (
    <div ref={containerRef} className={className}>
      {/* Controls */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className="cursor-pointer rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base font-medium text-neutral-800 disabled:opacity-40"
            aria-label="Previous model"
          >
            ← Previous
          </button>
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages - 1}
            className="cursor-pointer rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base font-medium text-neutral-800 disabled:opacity-40"
            aria-label="Next model"
          >
            Next →
          </button>
        </div>

        {/* Page dots */}
        <div className="flex items-center gap-6">
          <span className="text-sm text-neutral-600">
            Page {currentPage + 1} / {totalPages}
          </span>
          <div className="flex cursor-pointer items-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Go to Page ${i + 1}`}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  i === currentPage ? "bg-neutral-900" : "bg-neutral-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid gap-8 pb-4 pt-2 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {visibleModels.map((m, i) => {
          const globalIndex = pageStart + i;
          return (
            <div key={globalIndex} className="p-2">
              <SelectableCard
                data-card={globalIndex}
                model={m}
                displayTitle={`Candidate Model ${globalIndex + 1}`}
                selected={globalIndex === pickedIndex}
                onSelect={() => choose(globalIndex)}
                tabIndex={0}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------- Card (selectable) --------------------- */

function SelectableCard({
  model,
  selected,
  onSelect,
  displayTitle,
  ...rest
}: {
  model: ModelSpec;
  selected: boolean;
  onSelect: () => void;
  displayTitle?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const rows = model.variables ?? [];

  const ring = selected ? "ring-2 ring-yellow-400 shadow-lg" : "hover:shadow-md";
  const border = selected ? "border-yellow-400" : "border-neutral-200";

  return (
    <div
      {...rest}
      role="button"
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`min-w-[360px] max-w-[520px] flex-1 scroll-mx-4 rounded-2xl border bg-white p-5 transition-all ${border} ${ring}`}
      style={{ scrollSnapAlign: "start" }}
    >
      {/* Selection pill */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">{displayTitle ?? model.title}</h3>
        <span
          className={`select-none rounded-full px-2 py-0.5 text-xs ${
            selected ? "bg-yellow-400 text-black" : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {selected ? "Selected" : "Tap to select"}
        </span>
      </div>

      {/* Optional preview thumbnail */}
      {model.previewUrl && (
        <img
          src={model.previewUrl}
          alt={`${displayTitle ?? model.title} preview`}
          className="mb-3 h-36 w-full rounded-lg object-contain"
        />
      )}

      {/* Variables table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="table-fixed w-full text-sm">
          <colgroup>
            <col className="w-[46%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
          </colgroup>

          <thead className="bg-gray-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left whitespace-nowrap">Variable</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Coefficient</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">P-Value</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">VIF</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100">
            {rows.map((r, idx) => (
              <tr key={idx} className="hover:bg-neutral-50">
                <td className="px-3 py-2 truncate text-neutral-800" title={r.name}>
                  {r.name}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {fmtNumber(r.coeff_X1)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {fmtPctOrVal(r["p-value_X1"])} {/* ← correct bracket access */}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {fmtPctOrVal(r.vif_X1)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-neutral-500">
                  No variables
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric
          label="Adj. R²"
          value={fmtPercent((model.metrics?.Adj_R_Squared as any) ?? (model as any).Adj_R_Squared)}
        />
        <Metric
          label="RMSE"
          value={fmtNumber((model.metrics?.RMSE as any) ?? (model as any).RMSE)}
        />
        <Metric
          label="MAPE"
          value={fmtPctOrVal((model.metrics?.MAPE as any) ?? (model as any).MAPE)}
        />
      </div>
    </div>
  );
}

/* --------------------- Small metric card --------------------- */

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold text-neutral-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

/* ----------------------- Format helpers ----------------------- */

function fmtNumber(v?: number) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function fmtPercent(v?: number) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return (Number(v) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%";
}
function fmtPctOrVal(v: number | string | undefined) {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (v >= 0 && v <= 1) {
    return (v * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%";
  }
  return v.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export default ModelCompareGrid;