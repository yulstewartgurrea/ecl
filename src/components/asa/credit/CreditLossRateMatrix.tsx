import React, { useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

/* ===================== Types (exported) ===================== */
/**
 * ✅ MUST match backend keys exactly (including spaces)
 */
export type AgingKey =
  | "0 day"
  | "par 1"
  | "par 30"
  | "par 60"
  | "par 90"
  | "par 120"
  | "par 150"
  | "par 180"
  | "par 210"
  | "par 240"
  | "par 270"
  | "par 300"
  | "par 330"
  | "par 360";

export type AgingCategory = { key: AgingKey; label: string };

export type MonthRow = {
  date: string; // backend: "date"
  cols: Record<AgingKey, number>; // backend bucket columns
  monotonic?: boolean; // backend: "Monotonic?"
  weighted?: number; // backend: "Weighted Credit Loss Rate per Month"
};

export type RatesColumnSet = {
  name: string;
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
  historicalRateSets?: RatesColumnSet[]; // optional now
  distribution?: DistributionBy; // optional
  defaultRateSetIndex?: number;
  showNotes?: boolean;
  onExportCsv?: (csv: string) => void;
  className?: string;
};

/* ===================== Defaults (exact backend labels) ===================== */
export const DEFAULT_CATEGORIES: AgingCategory[] = [
  { key: "0 day", label: "0 day" },
  { key: "par 1", label: "par 1" },
  { key: "par 30", label: "par 30" },
  { key: "par 60", label: "par 60" },
  { key: "par 90", label: "par 90" },
  { key: "par 120", label: "par 120" },
  { key: "par 150", label: "par 150" },
  { key: "par 180", label: "par 180" },
  { key: "par 210", label: "par 210" },
  { key: "par 240", label: "par 240" },
  { key: "par 270", label: "par 270" },
  { key: "par 300", label: "par 300" },
  { key: "par 330", label: "par 330" },
  { key: "par 360", label: "par 360" },
];

/* ===================== Utils ===================== */
const pct = (v: number, digits = 6) =>
  `${((v ?? 0) * 100).toLocaleString(undefined, {
    style: "decimal",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;

const isMonotonicNonDecreasing = (arr: number[]) =>
  arr.every((v, i) => (i === 0 ? true : v >= arr[i - 1]));

/* ===================== CSV helpers ===================== */
const toCSV = (headers: string[], rows: (string | number)[][]) => {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
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

/* ===================== Backend helpers ===================== */
export function backendRowToCols(r: any): Record<AgingKey, number> {
  return {
    "0 day": Number(r?.["0 day"] ?? 0),
    "par 1": Number(r?.["par 1"] ?? 0),
    "par 30": Number(r?.["par 30"] ?? 0),
    "par 60": Number(r?.["par 60"] ?? 0),
    "par 90": Number(r?.["par 90"] ?? 0),
    "par 120": Number(r?.["par 120"] ?? 0),
    "par 150": Number(r?.["par 150"] ?? 0),
    "par 180": Number(r?.["par 180"] ?? 0),
    "par 210": Number(r?.["par 210"] ?? 0),
    "par 240": Number(r?.["par 240"] ?? 0),
    "par 270": Number(r?.["par 270"] ?? 0),
    "par 300": Number(r?.["par 300"] ?? 0),
    "par 330": Number(r?.["par 330"] ?? 0),
    "par 360": Number(r?.["par 360"] ?? 0),
  };
}

function parseMonotonic(v: any): boolean | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "yes" || s === "true") return true;
    if (s === "no" || s === "false") return false;
  }
  return Boolean(v);
}

/**
 * ✅ Build MonthRow[] from your backend "data": [...]
 * Includes monotonic + weighted from backend fields.
 */
export function buildRowsFromBackendArray(arr: any[]): MonthRow[] {
  return (Array.isArray(arr) ? arr : []).map((r: any) => ({
    date: String(r?.date ?? ""),
    cols: backendRowToCols(r),
    monotonic: parseMonotonic(r?.["Monotonic?"]),
    weighted: r?.["Weighted Credit Loss Rate per Month"] != null
      ? Number(r?.["Weighted Credit Loss Rate per Month"])
      : undefined,
  }));
}

/* ===================== Small UI bits ===================== */
const Card: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string }>> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-600/30 bg-yellow-500 backdrop-blur rounded-t-2xl">
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

const Badge: React.FC<React.PropsWithChildren<{ tone?: "green" | "red" | "gray" }>> = ({
  tone = "gray",
  children,
}) => {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
};

/* ===================== Reusable Matrix ===================== */
const CreditLossRateMatrix: React.FC<CreditLossRateMatrixProps> = ({
  title = "Credit Loss Rate Approach",
  subtitle = "Backend-aligned results (exact keys/labels).",
  categories = DEFAULT_CATEGORIES,
  rows,
  historicalRateSets, // optional
  defaultRateSetIndex = 0,
  showNotes = true,
  onExportCsv,
  className = "",
}) => {
  if (!rows || rows.length === 0) {
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

  const tableRows = useMemo(() => {
    // We prefer backend-provided monotonic & weighted.
    // If missing, we compute monotonic as fallback; weighted stays 0 unless you want to compute it.
    return rows.map((r) => {
      const ordered = categories.map((c) => r.cols?.[c.key] ?? 0);
      const monotonic =
        r.monotonic !== undefined ? r.monotonic : isMonotonicNonDecreasing(ordered);

      const weighted = r.weighted ?? 0;

      return { ...r, monotonic, weighted };
    });
  }, [rows, categories]);

  const doExport = () => {
    const headers = ["Date", ...categories.map((c) => c.label), "Monotonic?", "Weighted Credit Loss Rate per Month"];
    const data = tableRows.map((r) => [
      r.date,
      ...categories.map((c) => pct(r.cols?.[c.key] ?? 0, 6)),
      r.monotonic ? "Yes" : "No",
      pct(r.weighted ?? 0, 6),
    ]);
    const csv = toCSV(headers, data);
    if (onExportCsv) onExportCsv(csv);
    else download("credit_loss_rate_step5.csv", csv);
  };

  return (
    <div className={`w-full ${className}`}>
      <Card title={title} subtitle={subtitle}>
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <InformationCircleIcon className="h-4 w-4 text-gray-500" />
            {showNotes && (
              <p className="text-xs text-gray-600">
                Display is aligned to backend response keys/labels (no extra transformations).
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* keep selector only if you pass rate sets; otherwise it won't show */}
            {historicalRateSets && historicalRateSets.length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-600">Rate set:</span>
                <select
                  className="text-xs rounded-md border-gray-300 focus:ring-yellow-400 focus:border-yellow-400 cursor-pointer"
                  value={rateSetIndex}
                  onChange={(e) => setRateSetIndex(Number(e.target.value))}
                >
                  {historicalRateSets.map((s, i) => (
                    <option key={`${s.name}-${i}`} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                  Weighted Credit Loss Rate per Month
                </th>
              </tr>
            </thead>

            <tbody>
              {tableRows.map((r, idx) => (
                <tr key={`${r.date}-${idx}`} className="odd:bg-white even:bg-gray-50/50">
                  <td className="px-3 py-2 border-b text-gray-900">{r.date}</td>

                  {/* ✅ FIXED: show actual bucket values */}
                  {categories.map((c) => (
                    <td key={c.key} className="px-3 py-2 border-b text-right tabular-nums">
                      {pct(r.cols?.[c.key] ?? 0, 6)}
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

                  {/* ✅ Weighted from backend */}
                  <td className="px-3 py-2 border-b text-right font-medium text-gray-900 tabular-nums">
                    {pct(r.weighted ?? 0, 6)}
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
