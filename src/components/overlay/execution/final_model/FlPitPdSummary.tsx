// src/components/overlay/execution/final_model/FlPitPdSummary.tsx
import React from "react";

export type FlPitBucketRow = {
  bucket: string; // "0", "1", "2", "3", "Portfolio PD"
  best: number;   // raw numeric from API (e.g. 0.1734)
  base: number;
  worst: number;
};

export type FlPitPdSummaryProps = {
  rows: FlPitBucketRow[];
};

const cn = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

/**
 * Convert a raw numeric value to percentage with EXACTLY 2 decimal places.
 * - Multiplies by 100
 * - Uses exponential notation for extremely large values to avoid overflow in UI
 */
const formatPctNumber = (v: number): string => {
  if (!Number.isFinite(v)) return "—";
  const pct = v * 100;
  if (!Number.isFinite(pct)) return "—";

  // Avoid crazy-long strings for huge numbers
  if (Math.abs(pct) >= 1e6) {
    return `${pct.toExponential(2)}%`;
  }

  return `${pct.toFixed(2)}%`;
};

const fmtPct = (v: number) => formatPctNumber(v);

const FlPitPdSummary: React.FC<FlPitPdSummaryProps> = ({ rows }) => {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
        No FL PiT PD data to display.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-[#f8c300] px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-900">
        Final FL PiT PDs by bucket and scenario
      </div>

      <div className="overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-[12px] leading-tight">
          <thead>
            {/* Row 1: group header */}
            <tr className="text-xs">
              <th className="bg-gray-700 text-white px-3 py-1.5 text-left font-medium">
                Bucket
              </th>
              <th
                colSpan={3}
                className="bg-gray-700 text-white px-3 py-1.5 text-center font-semibold"
              >
                FL PiT PD (%)
              </th>
            </tr>
            {/* Row 2: Best / Base / Worst labels */}
            <tr className="text-xs">
              <th className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 text-left" />
              <th className="bg-emerald-50 px-3 py-1.5 border-b border-emerald-200 text-center font-medium text-neutral-800">
                Best
              </th>
              <th className="bg-amber-50 px-3 py-1.5 border-b border-amber-200 text-center font-medium text-neutral-800">
                Base
              </th>
              <th className="bg-orange-50 px-3 py-1.5 border-b border-orange-200 text-center font-medium text-neutral-800">
                Worst
              </th>
            </tr>
          </thead>

          <tbody className="text-neutral-900">
            {rows.map((r, i) => {
              const isPortfolio =
                r.bucket.toLowerCase().includes("portfolio");
              const rowBg = i % 2 === 1 ? "bg-neutral-50" : "bg-white";

              return (
                <tr key={r.bucket} className={rowBg}>
                  <td
                    className={cn(
                      "px-3 py-1.5 border-b border-neutral-200 whitespace-nowrap",
                      isPortfolio
                        ? "bg-slate-100 font-medium text-neutral-900"
                        : rowBg
                    )}
                  >
                    {r.bucket}
                  </td>
                  <td className="px-3 py-1.5 border-b border-neutral-200 tabular-nums text-center bg-emerald-50">
                    {fmtPct(r.best)}
                  </td>
                  <td className="px-3 py-1.5 border-b border-neutral-200 tabular-nums text-center bg-amber-50">
                    {fmtPct(r.base)}
                  </td>
                  <td className="px-3 py-1.5 border-b border-neutral-200 tabular-nums text-center bg-orange-50">
                    {fmtPct(r.worst)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-2 text-[11px] text-gray-500">
        Values are shown as percentages (×100) with exactly 2 decimal places.
      </p>
    </div>
  );
};

export default FlPitPdSummary;