// src/components/overlay/execution/final_model/PdCalibrationSummary.tsx
import React from "react";

export type PdCalibrationRow = {
  bucket: string;
  obligors: number | null;
  ttcPd: string;                 // e.g. "0.1734" or "Portfolio FL PiT PD"
  flPitBest: number | string;
  flPitBase: number | string;
  flPitWorst: number | string;
};

export type PdCalibrationSummaryProps = {
  rows: PdCalibrationRow[];
};

/**
 * Convert a raw probability value (0–1) to a percentage string with 2 decimals.
 * - Multiplies by 100
 * - Uses exponential notation for very large values to avoid huge strings.
 */
const formatPctNumber = (n: number): string => {
  const pct = n * 100;
  if (!Number.isFinite(pct)) return "";

  if (Math.abs(pct) >= 1e6) {
    // keep it readable for crazy-large values
    return `${pct.toExponential(2)}%`;
  }
  return `${pct.toFixed(2)}%`;
};

const fmtPctFromRaw = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === "") return "";

  const num =
    typeof v === "number" ? v : Number.parseFloat(String(v).trim());

  if (Number.isNaN(num)) {
    // if it's not numeric (e.g. "Portfolio FL PiT PD"), just show raw
    return String(v);
  }

  return formatPctNumber(num);
};

const fmtTtcPd = (ttcPd: string): string => {
  const num = Number.parseFloat(ttcPd);
  if (Number.isNaN(num)) {
    // e.g. "Portfolio FL PiT PD" for the Total row
    return ttcPd;
  }
  return formatPctNumber(num);
};

const PdCalibrationSummary: React.FC<PdCalibrationSummaryProps> = ({
  rows,
}) => {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="space-y-4 text-[12px] md:text-[13px]">
      {/* Legend / badges */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            TTC PD and FL PiT PD by bucket (shown in % with 2 decimals)
          </span>
        </div>
      </div>

      {/* Main table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full border-collapse text-[12px] md:text-[13px]">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="bg-gray-700 text-white text-center px-3 py-2 font-medium uppercase tracking-wide align-middle"
              >
                Bucket
              </th>
              <th
                rowSpan={2}
                className="bg-gray-700 text-white text-center px-3 py-2 font-medium uppercase tracking-wide align-middle"
              >
                Obligors
              </th>
              <th
                rowSpan={2}
                className="bg-gray-700 text-white text-center px-3 py-2 font-medium uppercase tracking-wide align-middle"
              >
                TTC PD
              </th>
              <th
                colSpan={3}
                className="bg-[#f8c300] text-gray-900 text-center px-3 py-2 font-semibold uppercase tracking-wide"
              >
                FL PiT PD
              </th>
            </tr>
            <tr>
              <th className="bg-gray-700 px-3 py-1 text-center text-[11px] font-medium text-white border-t border-gray-200">
                Best
              </th>
              <th className="bg-gray-700 px-3 py-1 text-center text-[11px] font-medium text-white border-t border-gray-200">
                Base
              </th>
              <th className="bg-gray-700 px-3 py-1 text-center text-[11px] font-medium text-white border-t border-gray-200">
                Worst
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isTotal =
                row.bucket.toLowerCase() === "total";
              return (
                <tr
                  key={`${row.bucket}-${idx}`}
                  className={`border-t border-gray-200 ${
                    isTotal ? "bg-slate-100 font-semibold" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-center text-gray-900">
                    {row.bucket}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {row.obligors != null ? row.obligors : "—"}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {fmtTtcPd(row.ttcPd)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums bg-emerald-50">
                    {fmtPctFromRaw(row.flPitBest)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums bg-amber-50">
                    {fmtPctFromRaw(row.flPitBase)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums bg-orange-50">
                    {fmtPctFromRaw(row.flPitWorst)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500">
        Numeric values are interpreted as probabilities (0–1) and shown as
        percentages with 2 decimal places. Non-numeric labels (like{" "}
        <span className="font-semibold">"Portfolio FL PiT PD"</span>) are
        displayed as-is.
      </p>
    </div>
  );
};

export default PdCalibrationSummary;