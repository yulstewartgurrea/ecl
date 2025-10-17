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

/* ===================== Sensible defaults (so it renders) ===================== */
const DEFAULT_CATEGORIES: AgingCategory[] = [
  { key: "d0", label: "0 day to PAR 1" },
  { key: "par1_30", label: "PAR 1 to PAR 30" },
  { key: "par30_60", label: "PAR 30 to PAR 60" },
  { key: "par60_90", label: "PAR 60 to PAR 90" },
  { key: "par90_120", label: "PAR 90 to PAR 120" },
  { key: "par120_180", label: "PAR 120 to PAR 180" },
  { key: "par180_240", label: "PAR 180 to PAR 240" },
  { key: "par240_360", label: "PAR 240 to PAR 360" },
  { key: "par360p", label: "PAR 360 above" },
];

const DEFAULT_ROWS: MonthRow[] = [
  {
    date: "2025-08-31",
    cols: {
      d0: 0.0011588,
      par1_30: 0.250136,
      par30_60: 0.262342,
      par60_90: 0.281607,
      par90_120: 0.066089,
      par120_180: 0.114862,
      par180_240: 0.205884,
      par240_360: 0.236813,
      par360p: 1.0,
    },
  },
  {
    date: "2025-07-31",
    cols: {
      d0: 0.001,
      par1_30: 0.2,
      par30_60: 0.22,
      par60_90: 0.24,
      par90_120: 0.06,
      par120_180: 0.11,
      par180_240: 0.19,
      par240_360: 0.23,
      par360p: 1.0,
    },
  },
];

const DEFAULT_RATESETS: RatesColumnSet[] = [
  {
    name: "Historical Credit Loss Rate",
    values: {
      d0: 0.0012,
      par1_30: 0.2501,
      par30_60: 0.2623,
      par60_90: 0.2816,
      par90_120: 0.0661,
      par120_180: 0.1149,
      par180_240: 0.2059,
      par240_360: 0.2368,
      par360p: 1.0,
    },
  },
  {
    name: "Historical Credit Loss Rate (w/o Jul–Sep 2024)",
    values: {
      d0: 0.0002,
      par1_30: 0.0558,
      par30_60: 0.0606,
      par60_90: 0.0661,
      par90_120: 0.0661,
      par120_180: 0.1149,
      par180_240: 0.2059,
      par240_360: 0.2368,
      par360p: 1.0,
    },
  },
];

const DEFAULT_DISTRIBUTION: DistributionBy = {
  type: "asOf",
  asOfLabel: "as of Aug 2025",
  values: {
    d0: 0.962052,
    par1_30: 0.001825,
    par30_60: 0.003864,
    par60_90: 0.004209,
    par90_120: 0.000581,
    par120_180: 0.010536,
    par180_240: 0.001193,
    par240_360: 0.000037,
    par360p: 0.000001,
  },
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
  categories = DEFAULT_CATEGORIES,
  rows = DEFAULT_ROWS,
  historicalRateSets = DEFAULT_RATESETS,
  distribution = DEFAULT_DISTRIBUTION,
  defaultRateSetIndex = 0,
  showNotes = true,
  onExportCsv,
  className = "",
}) => {
  const [rateSetIndex, setRateSetIndex] = useState(defaultRateSetIndex);
  const activeRates = historicalRateSets[rateSetIndex]?.values ?? {};
  const hasPerMonthDist = distribution.type === "perMonth";

  const overallWeighted = useMemo(() => {
    if (distribution.type === "asOf") return computeWeighted(distribution.values, activeRates);
    const per = Object.values(distribution.valuesByRow);
    if (!per.length) return 0;
    return per.reduce((acc, d) => acc + computeWeighted(d, activeRates), 0) / per.length;
  }, [distribution, activeRates]);

  const tableRows = useMemo(() => {
    return rows.map((r, i) => {
      const ordered = categories.map((c) => r.cols[c.key] ?? 0);
      const monotonic = isMonotonicNonDecreasing(ordered);
      const dist =
        distribution.type === "perMonth"
          ? distribution.valuesByRow[i] ?? r.cols
          : distribution.values;
      return { ...r, monotonic, weighted: computeWeighted(dist, activeRates) };
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
    <div className={`grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 ${className}`}>
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

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-[980px] w-full text-xs">
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

      {/* RIGHT */}
      <div className="flex flex-col gap-5">
        <Card title="Assumptions" subtitle="Active historical loss rates and balance distribution">
          <div className="space-y-4">
            {/* Rate set */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Historical Credit Loss Rate</h4>
                <Badge>{historicalRateSets[rateSetIndex]?.name ?? "—"}</Badge>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-[420px] w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold border-b">Aging Category</th>
                      <th className="px-3 py-2 text-right font-semibold border-b">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.key} className="odd:bg-white even:bg-gray-50/50">
                        <td className="px-3 py-1.5 border-b">{c.label}</td>
                        <td className="px-3 py-1.5 border-b text-right tabular-nums">
                          {pct(activeRates[c.key] ?? 0, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Distribution */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  {distribution.type === "asOf"
                    ? `Distribution of balances ${distribution.asOfLabel}`
                    : "Distribution of balances (per-month)"}
                </h4>
                <Badge tone="gray">{hasPerMonthDist ? "per month" : "as-of"}</Badge>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-[420px] w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold border-b">Aging Category</th>
                      <th className="px-3 py-2 text-right font-semibold border-b">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => {
                      const share =
                        distribution.type === "asOf"
                          ? distribution.values[c.key] ?? 0
                          : distribution.valuesByRow?.[0]?.[c.key] ?? 0; // sample month
                      return (
                        <tr key={c.key} className="odd:bg-white even:bg-gray-50/50">
                          <td className="px-3 py-1.5 border-b">{c.label}</td>
                          <td className="px-3 py-1.5 border-b text-right tabular-nums">
                            {pct(share, 3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overall */}
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Overall weighted credit loss rate</p>
                  <p className="text-[11px] text-gray-500">
                    Computed from the selected rate set × distribution.
                  </p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-gray-900 font-semibold tabular-nums">
                  {pct(overallWeighted, 4)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {showNotes && (
          <Card title="Notes">
            <ul className="list-disc ml-4 text-xs text-gray-600 space-y-1">
              <li>Inputs are decimals; UI shows percentages.</li>
              <li>“Monotonic?” checks non-decreasing across aging buckets per row.</li>
              <li>
                Right-panel “Overall weighted” uses the selected rate set and the current distribution.
              </li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CreditLossRateMatrix;
