// AgingScenarioTable.tsx
import React from "react";

export type AgingRow = {
  bucket: string;   // e.g., "0 DPD", "1 - 30 DPD"
  ttcPd: number;    // percent (e.g., 13.07)
  upside: number;   // percent
  baseline: number; // percent
  downside: number; // percent
};

export type Multis = { upside: number; baseline: number; downside: number };

export type AgingScenarioTableProps = {
  title?: string;
  rows: AgingRow[];
  heightClass?: string;           // e.g. "max-h-[70vh]" or "h-[360px]"
  zebra?: boolean;                // default true
  multipliers?: Multis | null;    // optional footer block
};

const cn = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

const pct = (v?: number) =>
  v == null || Number.isNaN(Number(v))
    ? ""
    : `${Number(v).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}%`;

const AgingScenarioTable: React.FC<AgingScenarioTableProps> = ({
  title,
  rows,
  heightClass = "h-[360px]",
  zebra = true,
  multipliers = null,
}) => {
  const hasRows = rows.length > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3  border-gray-100 px-4 pt-4 pb-3">
        <div className="space-y-0.5">
          <h3 className="text-sm md:text-base font-semibold text-gray-900">
            {title ?? "Aging bucket vs scenario PD"}
          </h3>
          <p className="text-xs text-gray-500">
            Through-the-cycle PDs by delinquency bucket with scenario overlays.
          </p>
          {hasRows && (
            <p className="text-[11px] text-gray-400">
              {rows.length} aging buckets  TTC + Upside / Baseline / Downside.
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 border border-gray-200">
            <span className="h-2 w-2 rounded-full bg-gray-500" />
            TTC PD
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Upside
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 border border-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Baseline
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 border border-orange-200">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            Downside
          </span>
        </div>
      </div>

      {/* Table section */}
      <div className="px-4 pb-4 pt-3">
        <div
          className={cn(
            "overflow-auto rounded-xl border border-gray-100 bg-white",
            heightClass
          )}
        >
          {/* border-separate plays well with sticky cells */}
          <table className="w-full border-separate border-spacing-0 text-[12px] md:text-[13px] leading-tight">
            <thead>
              {/* Row 1: group headers */}
              <tr className="text-[11px] uppercase tracking-wide">
                <th
                  rowSpan={2}
                  className="
                    sticky left-0 z-20
                    bg-gray-700 text-white
                    px-3 py-2 text-left font-semibold whitespace-nowrap
                     border-slate-900 rounded-tl-xl
                  "
                >
                  Aging bucket
                </th>

                <th
                  rowSpan={2}
                  className="
                    bg-gray-800 text-white
                    px-3 py-2 text-center font-semibold whitespace-nowrap
                     border-slate-900
                  "
                >
                  TTC PD
                </th>

                <th
                  colSpan={3}
                  className="
                    bg-[#f8c300] text-gray-900
                    px-3 py-2 text-center font-semibold whitespace-nowrap
                     border-yellow-500 rounded-tr-xl
                  "
                >
                  Scenario PD
                </th>
              </tr>

              {/* Row 2: scenario labels */}
              <tr className="bg-slate-800 text-[11px] text-black">
                <th className="px-3 py-2 text-center font-medium bg-emerald-100  border-slate-800">
                  Upside
                </th>
                <th className="px-3 py-2 text-center font-medium bg-amber-100  border-slate-800">
                  Baseline
                </th>
                <th className="px-3 py-2 text-center font-medium bg-orange-100  border-slate-800">
                  Downside
                </th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {rows.map((r, i) => {
                const rowBg = zebra && i % 2 ? "bg-gray-50" : "bg-white";
                return (
                  <tr
                    key={r.bucket}
                    className={cn(
                      rowBg,
                      "hover:bg-gray-50 transition-colors"
                    )}
                  >
                    {/* sticky bucket cell */}
                    <td
                      className={cn(
                        "sticky left-0 z-10",
                        rowBg,
                        "px-3 py-2 whitespace-nowrap text-[12px] font-medium text-gray-800",
                        " border-gray-200 border-r border-gray-200"
                      )}
                      title={r.bucket}
                    >
                      {r.bucket}
                    </td>

                    {/* TTC */}
                    <td
                      className={cn(
                        rowBg,
                        "px-3 py-2 text-center tabular-nums  border-gray-200"
                      )}
                    >
                      <span className="inline-flex items-center justify-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-800">
                        {pct(r.ttcPd)}
                      </span>
                    </td>

                    {/* Scenarios */}
                    <td
                      className={cn(
                        rowBg,
                        "px-3 py-2 text-center tabular-nums  border-gray-200"
                      )}
                    >
                      <span className="inline-flex items-center justify-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                        {pct(r.upside)}
                      </span>
                    </td>
                    <td
                      className={cn(
                        rowBg,
                        "px-3 py-2 text-center tabular-nums  border-gray-200"
                      )}
                    >
                      <span className="inline-flex items-center justify-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                        {pct(r.baseline)}
                      </span>
                    </td>
                    <td
                      className={cn(
                        rowBg,
                        "px-3 py-2 text-center tabular-nums  border-gray-200"
                      )}
                    >
                      <span className="inline-flex items-center justify-center rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-900">
                        {pct(r.downside)}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {!hasRows && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-gray-500"
                  >
                    No rows to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Multipliers strip */}
        {multipliers && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Scenario multipliers vs TTC PD
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="flex flex-col items-center justify-center rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-100">
                <span className="text-[11px] font-medium text-emerald-900">
                  Upside
                </span>
                <span className="text-base font-semibold text-emerald-900">
                  {multipliers.upside.toFixed(2)}Ã—
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-amber-50 px-3 py-2 border border-amber-100">
                <span className="text-[11px] font-medium text-amber-900">
                  Baseline
                </span>
                <span className="text-base font-semibold text-amber-900">
                  {multipliers.baseline.toFixed(2)}Ã—
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg bg-orange-50 px-3 py-2 border border-orange-100">
                <span className="text-[11px] font-medium text-orange-900">
                  Downside
                </span>
                <span className="text-base font-semibold text-orange-900">
                  {multipliers.downside.toFixed(2)}Ã—
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgingScenarioTable;
