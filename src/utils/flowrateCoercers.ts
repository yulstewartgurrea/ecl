// src/utils/flowrateCoercers.ts
import type { MonthRow } from "../components/asa/credit/CreditLossRateMatrix";
import type { CreditLossRateAnyRow } from "../components/asa/graph/CreditLossRateCharts";

/* ---------- helpers ---------- */
const normalizeKey = (value: string) =>
  (value ?? "").toLowerCase().replace(/\s+/g, "");

export function pickValueByKeys(obj: any, candidateKeys: string[]) {
  for (const key of candidateKeys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    const found = Object.keys(obj || {}).find(
      (existing) => normalizeKey(existing) === normalizeKey(key)
    );
    if (found) return (obj as any)[found];
  }
  return undefined;
}

export function pctToDecimal(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  const raw = String(v).trim();
  if (!raw || raw === "-" || raw.toUpperCase() === "#N/A") return 0;

  const s = raw.replace(/,/g, "").replace(/\s+/g, "");
  if (s.endsWith("%")) {
    const n = Number(s.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : 0;
  }

  const n = Number(s);
  if (Number.isFinite(n) && Math.abs(n) > 1.5) return n / 100; // treat as percent
  return Number.isFinite(n) ? n : 0;
}

function isPlainObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Find the first array of objects in a response (safe, typed)
 */
export function findFirstRowArray(payload: any): any[] {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (!isPlainObject(data)) return [];

  const obj = data as Record<string, any>;

  // direct candidates
  const directCandidates = [
    "flow_rate_calculation",
    "credit_loss_calculation",
    "credit_loss_rate",
    "rows",
    "data",
  ];
  for (const k of directCandidates) {
    if (Array.isArray(obj[k])) return obj[k];
  }

  // scan top-level arrays
  for (const [, v] of Object.entries(obj) as [string, any][]) {
    if (Array.isArray(v)) return v;
  }

  // scan 1 level deep
  for (const [, v] of Object.entries(obj) as [string, any][]) {
    if (isPlainObject(v)) {
      for (const vv of Object.values(v as Record<string, any>)) {
        if (Array.isArray(vv)) return vv;
      }
    }
  }

  return [];
}

/**
 * Step5 coercer now returns raw rows (MonthRow = Record<string, any>).
 * No static keys.
 */
export function coerceRowsFromStep5(payload: any): MonthRow[] {
  const arr = findFirstRowArray(payload);
  return (Array.isArray(arr) ? arr : []).map((r: any) => ({ ...(r || {}) }));
}

/**
 * Rate sets: return [] unless backend provides a clear object/array.
 * Kept dynamic.
 */
export function coerceRateSets(payload: any): { name: string; values: Record<string, number> }[] {
  const data = payload?.data ?? payload;
  if (!isPlainObject(data)) return [];

  const obj = data as Record<string, any>;
  const explicit =
    obj.historical_credit_loss_rate ??
    obj.historical_rates ??
    obj["Historical Credit Loss Rate"] ??
    obj.historicalRateSets ??
    obj.rateSets ??
    null;

  if (!explicit) return [];

  // object -> one set
  if (isPlainObject(explicit)) {
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(explicit as Record<string, any>)) {
      if (k === "name" || k === "label") continue;
      values[k] = pctToDecimal(v);
    }
    return [{ name: "Historical Credit Loss Rate", values }];
  }

  // array -> multiple sets
  if (Array.isArray(explicit)) {
    return (explicit as any[]).map((row, i) => {
      const values: Record<string, number> = {};
      for (const [k, v] of Object.entries(row || {})) {
        if (k === "name" || k === "label") continue;
        values[k] = pctToDecimal(v);
      }
      return { name: row?.name ?? row?.label ?? `Rate Set ${i + 1}`, values };
    });
  }

  return [];
}

export function coerceDistribution(_step5: any, _step3?: any) {
  return undefined;
}

/**
 * OPTIONAL: If you still want a helper for charts, keep it dynamic:
 * (no fixed par_* mapping)
 */
export function toChartRowsDynamic(rows: MonthRow[]): CreditLossRateAnyRow[] {
  return (rows || []).map((r: any) => ({ ...(r || {}) }));
}
