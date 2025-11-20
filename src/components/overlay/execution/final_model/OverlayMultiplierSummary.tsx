// src/components/overlay/execution/final_model/OverlayMultiplierSummary.tsx
import React from "react";

export type OverlayMultiplierRow = {
  reportDate: string; // e.g., "2024-10-31"
  odrPercent: number; // e.g., 4.28 (already in % terms)
  best: number;       // raw multiplier (0–1 or >1)
  base: number;
  worst: number;
};

export type OverlayMultiplierSummaryProps = {
  rows: OverlayMultiplierRow[];
};

// ODR already comes as a percentage value (e.g. 4.28)
const fmtPct = (v: number) =>
  `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

/**
 * Convert overlay multiplier value to a percentage string with 2 decimals.
 * Interprets the value as 0–1 probability or ratio and multiplies by 100.
 * Uses exponential notation for very large values to keep them readable.
 */
const formatPctNumber = (n: number): string => {
  const pct = n * 100;
  if (!Number.isFinite(pct)) return "";

  if (Math.abs(pct) >= 1e6) {
    // avoid ultra-long strings when values are huge
    return `${pct.toExponential(2)}%`;
  }
  return `${pct.toFixed(2)}%`;
};

const fmtMult = (v: number) => formatPctNumber(v);

const OverlayMultiplierSummary: React.FC<OverlayMultiplierSummaryProps> = ({
  rows,
}) => {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="space-y-4 text-[12px] md:text-[13px]">
      {/* Badges / legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Observed default rate (ODR)
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Overlay multiplier (in %)
          </span>
        </div>

        <span className="hidden md:inline-flex items-center rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
          Overlay multiplier ≈ forecasted PD / latest actual PD (ODR)
        </span>
      </div>

      {/* Single combined table */}
      <div className="overflow-x-auto rounded-lg ">
        <table className="min-w-full border-collapse text-[12px] md:text-[13px]">
          <thead>
            <tr>
              <th className="bg-gray-700 text-white text-center px-3 py-2 font-medium uppercase tracking-wide">
                Report date
              </th>
              {/* If you want to show ODR again, just uncomment this and the td below */}
              {/* <th className="bg-[#f8c300] text-gray-900 text-center px-3 py-2 font-semibold uppercase tracking-wide">
                Observed default rate (ODR)
              </th> */}
              <th
                colSpan={3}
                className="bg-[#f8c300] text-gray-900 text-center px-3 py-2 font-semibold uppercase tracking-wide"
              >
                Overlay multiplier (%)
              </th>
            </tr>
            <tr>
              <th className="bg-gray-700 px-3 py-1 text-center text-[11px] font-medium text-gray-700 "></th>
              {/* <th className="bg-gray-100 px-3 py-1 text-center text-[11px] font-medium text-gray-700 "></th> */}
              <th className="bg-gray-700 px-2 py-1 text-center text-[11px] font-medium text-white ">
                Best
              </th>
              <th className="bg-gray-700 px-2 py-1 text-center text-[11px] font-medium text-white ">
                Base
              </th>
              <th className="bg-gray-700 px-2 py-1 text-center text-[11px] font-medium text-white ">
                Worst
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={`${row.reportDate}-${idx}`}
                className="border-t border-gray-200"
              >
                <td className="bg-slate-50 px-3 py-2 text-center font-medium text-gray-900 tabular-nums">
                  {row.reportDate}
                </td>
                {/* <td className="bg-amber-50 px-3 py-2 text-center text-[13px] font-semibold text-amber-800 tabular-nums">
                  {fmtPct(row.odrPercent)}
                </td> */}
                <td className="bg-emerald-50 px-2.5 py-1.5 text-center tabular-nums">
                  {fmtMult(row.best)}
                </td>
                <td className="bg-amber-50 px-2.5 py-1.5 text-center tabular-nums">
                  {fmtMult(row.base)}
                </td>
                <td className="bg-orange-50 px-2.5 py-1.5 text-center tabular-nums">
                  {fmtMult(row.worst)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Formula hint for small screens */}
      <p className="text-[11px] text-gray-500 md:hidden">
        Overlay multiplier ≈{" "}
        <span className="font-semibold text-gray-700">
          forecasted PD / latest actual PD (ODR)
        </span>
        .
      </p>
    </div>
  );
};

export default OverlayMultiplierSummary;