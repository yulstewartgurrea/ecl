// components/overlay/development/candidate_model/ModelCompareGrid.tsx
import React, { useState } from "react";

/* ----------------------- Types ----------------------- */

export type ModelVariable = {
  name: string;
  coeff_X1: number;
  "p-value_X1": number | string;
  vif_X1?: number | string;
  raw?: number | string;   // ← change this line
  intercept?: number | string; // NEW: intercept value (model-level, repeated per var)
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
  intercepts?: string
};

export type ModelCompareGridProps = {
  models: ModelSpec[];
  className?: string;

  /** index the user chose (selected model) */
  chosenIndex?: number | null;
  onChosenIndexChange?: (index: number) => void;

  /** enable/disable choosing; default: true */
  selectable?: boolean;

  /** offset for display numbering and selection mapping */
  displayOffset?: number;
};

/* ----------------------- Grid ----------------------- */

export function ModelCompareGrid({
  models,
  className,
  chosenIndex,
  onChosenIndexChange,
  selectable = true,
  displayOffset = 0,
}: ModelCompareGridProps) {
  const [internalChosen, setInternalChosen] = useState<number | null>(null);
  const pickedIndex = chosenIndex ?? internalChosen ?? -1;


  function choose(idx: number) {
    if (!selectable) return;
    if (chosenIndex == null) setInternalChosen(idx);
    onChosenIndexChange?.(idx);
  }

  return (
    <div className={className}>
      {/* 2 cards per row on md+ (keeps mobile single column) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
        {models.map((m, i) => {
          const globalIndex = displayOffset + i;
          return (
            <SelectableCard
              key={globalIndex}
              data-card={globalIndex}
              model={m}
              displayTitle={`Candidate Model ${globalIndex + 1}`}
              selected={globalIndex === pickedIndex}
              onSelect={() => choose(globalIndex)}
              tabIndex={0}
              className="w-full"
            />
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
console.log('rows: ',rows)
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
      className={`w-full rounded-2xl border bg-white p-5 transition-all ${border} ${ring}`}
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
    <div className="overflow-hidden rounded-xl border border-neutral-200 w-full">
      <table className="table-fixed w-full text-sm">
        <thead className="bg-gray-700 text-white">
          <tr>
            <th className="w-[40%] px-3 py-2 text-left whitespace-nowrap">
              Variable
            </th>
            <th className="w-[15%] px-3 py-2 text-right whitespace-nowrap">
              Intercept
            </th>
            <th className="w-[15%] px-3 py-2 text-right whitespace-nowrap">
              Coefficient
            </th>
            <th className="w-[15%] px-3 py-2 text-right whitespace-nowrap">
              P-Value
            </th>
            <th className="w-[15%] px-3 py-2 text-right whitespace-nowrap">
              VIF
            </th>
          </tr>
        </thead>
        
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r, idx) => (
            <tr key={idx} className="hover:bg-neutral-50">
              <td
                className="w-[40%] px-3 py-2 truncate text-neutral-800"
                title={r.name}
              >
                {r.name}
              </td>

              <td className="w-[15%] px-3 py-2 text-right font-mono tabular-nums">
                {fmtNumber(r.intercept as any)}
              </td>

              <td className="w-[15%] px-3 py-2 text-right font-mono tabular-nums">
                {fmtNumber(r.coeff_X1)}
              </td>

              <td className="w-[15%] px-3 py-2 text-right font-mono tabular-nums">
                {fmtPctOrVal(r["p-value_X1"])}
              </td>

              <td className="w-[15%] px-3 py-2 text-right font-mono tabular-nums">
                {fmtPctOrVal(r.vif_X1)}
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-4 text-center text-neutral-500"
              >
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
