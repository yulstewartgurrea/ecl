import React, { useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

/* ===================== Types (exported) ===================== */
export type AgingKey = string;
export type AgingCategory = { key: AgingKey; label: string };
export type MonthRow = Record<string, any>;

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
  historicalRateSets?: RatesColumnSet[];
  distribution?: DistributionBy;
  defaultRateSetIndex?: number;
  showNotes?: boolean;
  onExportCsv?: (csv: string) => void;
  className?: string;
};

/* ===================== Utils ===================== */
const clean = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, "").trim();

function pickKey(keys: string[], candidates: string[]) {
  for (const cand of candidates) {
    const c = clean(cand);
    const found = keys.find((k) => clean(k) === c);
    if (found) return found;
  }
  for (const cand of candidates) {
    const c = clean(cand);
    const found = keys.find((k) => clean(k).includes(c));
    if (found) return found;
  }
  return undefined;
}

function toFraction(v: any): number | null {
  if (v === null || v === undefined || v === "" || v === "-") return 0;
  if (typeof v === "string" && v.trim().toUpperCase() === "#N/A") return null;

  if (typeof v === "number") {
    if (!Number.isFinite(v)) return 0;
    if (Math.abs(v) > 1.5) return v / 100;
    return v;
  }

  const raw = String(v).replace(/,/g, "").trim();
  if (!raw) return 0;
  if (raw.toUpperCase() === "#DIV/0!") return 0;
  if (raw.toUpperCase() === "#N/A") return null;

  const hasPct = raw.endsWith("%");
  const numStr = hasPct ? raw.slice(0, -1) : raw;
  const n = Number(numStr);
  if (!Number.isFinite(n)) return 0;

  if (hasPct) return n / 100;
  if (Math.abs(n) > 1.5) return n / 100;
  return n;
}

const pct = (fraction: number | null, digits = 6) => {
  if (fraction === null) return "#N/A";
  const v = Number(fraction ?? 0) * 100;
  return `${v.toLocaleString(undefined, {
    style: "decimal",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
};

const isMonotonicNonDecreasing = (arr: number[]) =>
  arr.every((v, i) => (i === 0 ? true : v >= arr[i - 1]));

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

function parseBool(v: any): boolean | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "yes" || s === "true" || s === "1") return true;
  if (s === "no" || s === "false" || s === "0") return false;
  return undefined;
}

/**
 *  FIXED TYPES: rows is explicitly an ARRAY
 */
function deriveSchema(rows: ReadonlyArray<MonthRow>) {
  const keySet = rows.reduce<Set<string>>((set, r) => {
    Object.keys(r || {}).forEach((k) => set.add(k));
    return set;
  }, new Set<string>());

  const keys = Array.from(keySet);

  const dateKey = pickKey(keys, ["date", "Date", "report date", "report_date", "as_of_date", "month", "period"]);
  const monotonicKey = pickKey(keys, ["monotonic", "Monotonic?", "monotonic?"]);
  const weightedKey = pickKey(keys, [
    "weighted credit loss rate per month",
    "Weighted Credit Loss Rate per Month",
    "weighted",
    "weighted_rate",
  ]);

  const bucketKeys = keys.filter(
    (k) => k !== dateKey && k !== monotonicKey && k !== weightedKey
  );

  const bucketSort = (a: string, b: string) => {
    const na = Number(a.match(/(\d+(\.\d+)?)/)?.[1] ?? "NaN");
    const nb = Number(b.match(/(\d+(\.\d+)?)/)?.[1] ?? "NaN");
    const aHas = Number.isFinite(na);
    const bHas = Number.isFinite(nb);
    if (aHas && bHas) return na - nb;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return clean(a).localeCompare(clean(b));
  };
  bucketKeys.sort(bucketSort);

  return { dateKey, monotonicKey, weightedKey, bucketKeys };
}

/* ===================== Small UI bits ===================== */
const Card: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string }>> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center justify-between px-4 py-3  border-yellow-600/30 bg-yellow-500 rounded-t-2xl">
      <div className="flex items-center gap-2">
        <CalculatorIcon className="h-5 w-5 text-gray-700" />
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-700 -mt-0.5">{subtitle}</p>}
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

/* ===================== Component ===================== */
const CreditLossRateMatrix: React.FC<CreditLossRateMatrixProps> = ({
  title = "Credit Loss Rate Approach",
  subtitle = "",
  categories,
  rows,
  historicalRateSets,
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

  const schema = useMemo(() => deriveSchema(rows), [rows]);

  const autoCategories = useMemo<AgingCategory[]>(() => {
    if (categories && categories.length) return categories;
    return schema.bucketKeys.map((k) => ({ key: k, label: k }));
  }, [categories, schema.bucketKeys]);

  const [rateSetIndex, setRateSetIndex] = useState(defaultRateSetIndex || 0);

  const tableRows = useMemo(() => {
    return rows.map((r) => {
      const bucketFractions = autoCategories.map((c) => toFraction(r?.[c.key]) ?? 0);
      const fallbackMonotonic = isMonotonicNonDecreasing(bucketFractions);

      const mono =
        schema.monotonicKey
          ? (parseBool(r?.[schema.monotonicKey]) ?? fallbackMonotonic)
          : fallbackMonotonic;

      const weighted = schema.weightedKey ? toFraction(r?.[schema.weightedKey]) : null;

      return { _raw: r, _monotonic: mono, _weighted: weighted };
    });
  }, [rows, autoCategories, schema.monotonicKey, schema.weightedKey]);

  const doExport = () => {
    const headers: string[] = [];
    headers.push(schema.dateKey ?? "Row");
    autoCategories.forEach((c) => headers.push(c.label));
    if (schema.monotonicKey) headers.push(schema.monotonicKey);
    if (schema.weightedKey) headers.push(schema.weightedKey);

    const data = tableRows.map((t, idx) => {
      const r = t._raw;
      const out: (string | number)[] = [];

      out.push(schema.dateKey ? String(r?.[schema.dateKey] ?? "") : String(idx + 1));
      autoCategories.forEach((c) => out.push(pct(toFraction(r?.[c.key]), 6)));
      if (schema.monotonicKey) out.push(t._monotonic ? "Yes" : "No");
      if (schema.weightedKey) out.push(pct(t._weighted, 6));

      return out;
    });

    const csv = toCSV(headers, data);
    if (onExportCsv) onExportCsv(csv);
    else download("credit_loss_rate_step5.csv", csv);
  };

  return (
    <div className={`w-full ${className}`}>
      <Card title={title} subtitle={subtitle}>
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 w-full">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-gray-700">
                <th className="px-3 py-2 text-left font-semibold ">
                  {schema.dateKey ?? "Row"}
                </th>

                {autoCategories.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right font-semibold ">
                    {c.label}
                  </th>
                ))}

                {schema.monotonicKey && (
                  <th className="px-3 py-2 text-center font-semibold ">
                    {schema.monotonicKey}
                  </th>
                )}

                {schema.weightedKey && (
                  <th className="px-3 py-2 text-right font-semibold ">
                    {schema.weightedKey}
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {tableRows.map((t, idx) => {
                const r = t._raw;
                return (
                  <tr key={`${idx}`} className="odd:bg-white even:bg-gray-50/50">
                    <td className="px-3 py-2  text-gray-900">
                      {schema.dateKey ? String(r?.[schema.dateKey] ?? "") : String(idx + 1)}
                    </td>

                    {autoCategories.map((c) => (
                      <td key={c.key} className="px-3 py-2  text-right tabular-nums">
                        {pct(toFraction(r?.[c.key]), 6)}
                      </td>
                    ))}

                    {schema.monotonicKey && (
                      <td className="px-3 py-2  text-center">
                        {t._monotonic ? (
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
                    )}

                    {schema.weightedKey && (
                      <td className="px-3 py-2  text-right font-medium text-gray-900 tabular-nums">
                        {pct(t._weighted, 6)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default CreditLossRateMatrix;

