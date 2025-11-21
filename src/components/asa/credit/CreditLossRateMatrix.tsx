import React, { useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

/* ===================== Types (exported) ===================== */
export type AgingKey =
  | "d0"
  | "par1_30"
  | "par30_60"
  | "par60_90"
  | "par90_120"
  | "par120_180"
  | "par180_240"
  | "par240_360"
  | "par360p";

export type AgingCategory = { key: AgingKey; label: string };

export type MonthRow = {
  date: string;                  // display label for the row
  cols: Record<AgingKey, number>;// decimals (0.075 → 7.5%)
  monotonic?: boolean;           // optional: monotonic value from API
  weighted?: number;              // optional: weighted credit loss rate from API
};

export type RatesColumnSet = {
  name: string;                  // e.g. "All months"
  values: Record<AgingKey, number>;
};

export type DistributionBy =
  | { type: "asOf"; asOfLabel: string; values: Record<AgingKey, number> }
  | { type: "perMonth"; valuesByRow: Record<number, Record<AgingKey, number>> };

export type CreditLossRateMatrixProps = {
  title?: string;
  subtitle?: string;
  categories?: AgingCategory[];
  rows?: MonthRow[];
  historicalRateSets?: RatesColumnSet[];
  distribution?: DistributionBy;
  defaultRateSetIndex?: number;
  showNotes?: boolean;
  onExportCsv?: (csv: string) => void; // if provided, called instead of auto download
  className?: string;
};

/* ===================== Utils ===================== */
const pct = (v: number, digits = 3) =>
  (v ?? 0).toLocaleString(undefined, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const isMonotonicNonDecreasing = (arr: number[]) =>
  arr.every((v, i) => (i === 0 ? true : v >= arr[i - 1]));

const normalize = (rec: Record<AgingKey, number>): Record<AgingKey, number> => {
  const total = Object.values(rec).reduce((a, b) => a + (b || 0), 0) || 1;
  const out: Record<AgingKey, number> = { ...rec };
  (Object.keys(out) as AgingKey[]).forEach((k) => (out[k] = (out[k] || 0) / total));
  return out;
};

const computeWeighted = (
  dist: Record<AgingKey, number>,
  rates: Record<AgingKey, number>
) => {
  const d = normalize(dist);
  return (Object.keys(d) as AgingKey[]).reduce(
    (acc, k) => acc + (d[k] || 0) * (rates[k] || 0),
    0
  );
};

const toCSV = (headers: string[], rows: (string | number)[][]) => {
  const esc = (s: string | number) =>
    `"${String(s).replace(/"/g, '""')}"`; // <-- use regex, not replaceAll
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
};


const download = (filename: string, text: string) => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/* ===================== Small UI bits ===================== */
const Card: React.FC<
  React.PropsWithChildren<{ title: string; subtitle?: string }>
> = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-600/30 bg-yellow-500  backdrop-blur rounded-t-2xl">
      <div className="flex items-center gap-2">
        <CalculatorIcon className="h-5 w-5 text-gray-700" />
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 -mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Badge: React.FC<
  React.PropsWithChildren<{ tone?: "green" | "red" | "gray" }>
> = ({ tone = "gray", children }) => {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
};

/* ===================== Reusable Matrix ===================== */
const CreditLossRateMatrix: React.FC<CreditLossRateMatrixProps> = ({
  title = "Credit Loss Rate Approach",
  subtitle = "Historical credit loss rates, distribution, and weighted loss computation.",
  categories,
  rows,
  historicalRateSets,
  distribution,
  defaultRateSetIndex = 0,
  showNotes = true,
  onExportCsv,
  className = "",
}) => {
  // Show "no data available" if critical props are missing
  if (!categories || !rows || rows.length === 0 || !historicalRateSets || historicalRateSets.length === 0) {
    return (
      <div className={`w-full ${className}`}>
        <Card title={title} subtitle={subtitle}>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center w-full">
            <p className="text-sm text-gray-600">No data available</p>
          </div>
        </Card>
      </div>
    );
  }

  const [rateSetIndex, setRateSetIndex] = useState(defaultRateSetIndex || 0);
  const activeRates = historicalRateSets[rateSetIndex]?.values ?? {};

  const tableRows = useMemo(() => {
    console.log(showNotes)
    return rows.map((r, i) => {
      // Use API-provided values if available, otherwise recalculate
      let monotonic: boolean;
      let weighted: number;
      
      if (r.monotonic !== undefined) {
        // Use API-provided monotonic value
        monotonic = r.monotonic;
      } else {
        // Fallback: calculate from columns
        const ordered = categories.map((c) => r.cols[c.key] ?? 0);
        monotonic = isMonotonicNonDecreasing(ordered);
      }
      
      if (r.weighted !== undefined) {
        // Use API-provided weighted value
        weighted = r.weighted;
      } else {
        // Fallback: calculate from distribution and rates
        const dist = distribution
          ? (distribution.type === "perMonth"
              ? distribution.valuesByRow[i] ?? r.cols
              : distribution.values)
          : r.cols;
        weighted = computeWeighted(dist, activeRates);
      }
      
      return { ...r, monotonic, weighted };
    });
  }, [rows, categories, distribution, activeRates]);

  const doExport = () => {
    const headers = [
      "Date",
      ...categories.map((c) => c.label),
      "Monotonic?",
      "Weighted credit loss rate per month",
    ];
    const data = tableRows.map((r) => [
      r.date,
      ...categories.map((c) => pct(r.cols[c.key], 6)),
      r.monotonic ? "Yes" : "No",
      pct(r.weighted, 6),
    ]);
    const csv = toCSV(headers, data);
    if (onExportCsv) onExportCsv(csv);
    else download("credit_loss_rate_step5.csv", csv);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* LEFT */}
      <Card title={title} subtitle={subtitle}>
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="h-4 w-4 text-gray-500" />
            <p className="text-xs text-gray-600">
              Values are decimals → shown as percentages. Monotonic means non-decreasing across
              aging buckets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-600">Rate set:</span>
              <select
                className="text-xs rounded-md border-gray-300 focus:ring-yellow-400 focus:border-yellow-400 cursor-pointer"
                value={rateSetIndex}
                onChange={(e) => setRateSetIndex(Number(e.target.value))}
              >
                {historicalRateSets.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={doExport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-yellow-400 border border-yellow-400 text-gray-900 hover:brightness-95 cursor-pointer"
              title="Export as CSV"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 w-full">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-gray-700">
                <th className="px-3 py-2 text-left font-semibold border-b">Date</th>
                {categories.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right font-semibold border-b">
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold border-b">Monotonic?</th>
                <th className="px-3 py-2 text-right font-semibold border-b">
                  Weighted credit loss rate / month
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, idx) => (
                <tr key={`${r.date}-${idx}`} className="odd:bg-white even:bg-gray-50/50">
                  <td className="px-3 py-2 border-b text-gray-900">{r.date}</td>
                  {categories.map((c) => (
                    <td key={c.key} className="px-3 py-2 border-b text-right tabular-nums">
                      {pct(r.cols[c.key], 6)}
                    </td>
                  ))}
                  <td className="px-3 py-2 border-b text-center">
                    {r.monotonic ? (
                      <Badge tone="green">
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge tone="red">
                        <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                        No
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 border-b text-right font-medium text-gray-900 tabular-nums">
                    {pct(r.weighted, 6)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
};

export default CreditLossRateMatrix;
