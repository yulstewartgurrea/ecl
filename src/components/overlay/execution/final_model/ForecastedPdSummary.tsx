// src/components/overlay/execution/final_model/ForecastedPdSummary.tsx
import React from "react";

export type FinalModelRow = {
  variable: string;
  coefficient: number;
};

export type ScenarioRow = {
  date: string;      // already formatted for display
  upside: number;
  base: number;
  downside: number;
};

export type ForecastedPdSummaryProps = {
  finalModel: FinalModelRow[];
  mlrRows: ScenarioRow[];          // multiple rows
  forecastedPdRows: ScenarioRow[]; // multiple rows
};

const cn = (...xs: Array<string | false | undefined>) =>
  xs.filter(Boolean).join(" ");

// Coefficients: keep raw from API
const fmtCoeff = (v: number) => {
  if (!Number.isFinite(v)) return "";
  return `${String(v)}`;
};

/**
 * Convert a raw numeric value (01 probability or ratio) to a percentage
 * string with 2 decimal places.
 */
const formatPctNumber = (v: number): string => {
  if (!Number.isFinite(v)) return "";
  const pct = v * 100;
  if (!Number.isFinite(pct)) return "";

  // avoid super-long strings when values explode
  if (Math.abs(pct) >= 1e6) {
    return `${pct.toExponential(2)}%`;
  }
  return `${pct.toFixed(2)}%`;
};

// Used for MLR table cells (Best / Base / Worst)
const fmtNumber = (v: number) => v.toFixed(2);

// Used for Forecasted PD table cells (Best / Base / Worst)
const fmtPct = (v: number) => formatPctNumber(v);

const ForecastedPdSummary: React.FC<ForecastedPdSummaryProps> = ({
  finalModel,
  mlrRows,
  forecastedPdRows,
}) => {
  return (
    <div className="space-y-4">
      {/* Step badges / flow */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          1. Final overlay model
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          2. Multiple linear regression (MLR)
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          3. Forecasted PDs
        </span>
      </div>

      {/* Main layout: Final model on the left, MLR + PDs on the right */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)]">
        {/* LEFT: Final Overlay Model */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#f8c300] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-900">
            Final Overlay Model
          </div>

          <div className="px-3 pb-3 pt-2">
            <p className="mb-2 text-[11px] text-gray-500">
              Coefficients used by the overlay model.
            </p>
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full border-separate border-spacing-0 text-[11px] md:text-[12px] leading-snug">
                <thead>
                  <tr className="bg-gray-700 text-white">
                    <th className="px-2.5 py-1.5 text-left font-medium">
                      Variables
                    </th>
                    <th className="px-2.5 py-1.5 text-right font-medium">
                      Coefficients
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {finalModel.map((row, idx) => (
                    <tr
                      key={row.variable}
                      className={cn(
                        idx % 2 ? "bg-gray-50" : "bg-white",
                        "hover:bg-gray-50 transition-colors"
                      )}
                    >
                      <td className="px-2.5 py-1.5  border-gray-200 text-gray-800">
                        {row.variable}
                      </td>
                      <td className="px-2.5 py-1.5  border-gray-200 text-right tabular-nums text-gray-900">
                        {fmtCoeff(row.coefficient)}
                      </td>
                    </tr>
                  ))}

                  {finalModel.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-3 py-3 text-center text-gray-500 text-xs"
                      >
                        No coefficients provided.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* RIGHT: MLR + Forecasted PDs */}
        <div className="space-y-4">
          {/* 2. Multiple Linear Regression (MLR) */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-[#f8c300] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-900">
              Multiple Linear Regression (MLR)
            </div>

            <div className="px-3 pb-3 pt-2">
              <div className="overflow-hidden rounded-lg border border-gray-100 max-h-[260px] overflow-y-auto">
                <table className="w-full border-separate border-spacing-0 text-[11px] md:text-[12px] leading-snug">
                  <thead>
                    <tr className="text-xs">
                      <th className="bg-gray-700 text-white px-2.5 py-1.5 text-center font-medium">
                        Date
                      </th>
                      <th className="bg-gray-700 text-white px-2.5 py-1.5 text-center font-medium">
                        Upside
                      </th>
                      <th className="bg-gray-700 text-white px-2.5 py-1.5 text-center font-medium">
                        Base
                      </th>
                      <th className="bg-gray-700 text-white px-2.5 py-1.5 text-center font-medium">
                        Downside
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mlrRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-2.5 py-2 text-center text-xs text-gray-500"
                        >
                          No MLR results yet. Click{" "}
                          <span className="font-semibold">Run Forecasted PD</span>{" "}
                          above.
                        </td>
                      </tr>
                    )}

                    {mlrRows.map((row, idx) => (
                      <tr
                        key={row.date + idx}
                        className={idx % 2 ? "bg-gray-50" : "bg-white"}
                      >
                        <td className="px-2.5 py-1.5  border-gray-200 bg-slate-100 text-center text-gray-900">
                          {row.date}
                        </td>
                        <td className="px-2.5 py-1.5  border-gray-200 text-center tabular-nums bg-emerald-50">
                          {fmtNumber(row.upside)}
                        </td>
                        <td className="px-2.5 py-1.5  border-gray-200 text-center tabular-nums bg-amber-50">
                          {fmtNumber(row.base)}
                        </td>
                        <td className="px-2.5 py-1.5  border-gray-200 text-center tabular-nums bg-orange-50">
                          {fmtNumber(row.downside)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 3. Forecasted PDs */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-[#f8c300] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-900">
              Forecasted PDs
            </div>

            <div className="px-3 pb-3 pt-2">
              <div className="overflow-hidden rounded-lg border border-gray-100 max-h-[260px] overflow-y-auto">
                <table className="w-full border-separate border-spacing-0 text-[11px] md:text-[12px] leading-snug">
                  <thead>
                    <tr className="text-xs">
                      <th className="bg-gray-700 text-white px-2.5 py-1.5 text-center font-medium">
                        Date
                      </th>
                      <th className="bg-gray-700 text-white px-2.5 py-1.5 text-center font-medium">
                        Upside (%)
                      </th>
                      <th className="bg-gray-700 text-white px-2.5 py-1.5 text-center font-medium">
                        Base (%)
                      </th>
                      <th className="bg-gray-700 text-white px-2.5 py-1.5 text-center font-medium">
                        Downside (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastedPdRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-2.5 py-2 text-center text-xs text-gray-500"
                        >
                          No forecasted PDs yet. Click{" "}
                          <span className="font-semibold">Run Forecasted PD</span>{" "}
                          above.
                        </td>
                      </tr>
                    )}

                    {forecastedPdRows.map((row, idx) => (
                      <tr
                        key={row.date + idx}
                        className={idx % 2 ? "bg-gray-50" : "bg-white"}
                      >
                        <td className="px-2.5 py-1.5  border-gray-200 bg-slate-100 text-center text-gray-900">
                          {row.date}
                        </td>
                        <td className="px-2.5 py-1.5  border-gray-200 text-center tabular-nums bg-emerald-50">
                          {fmtPct(row.upside)}
                        </td>
                        <td className="px-2.5 py-1.5  border-gray-200 text-center tabular-nums bg-amber-50">
                          {fmtPct(row.base)}
                        </td>
                        <td className="px-2.5 py-1.5  border-gray-200 text-center tabular-nums bg-orange-50">
                          {fmtPct(row.downside)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ForecastedPdSummary;
