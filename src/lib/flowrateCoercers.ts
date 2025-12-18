// src/lib/flowrateCoercers.ts
import type {
  AgingCategory,
  MonthRow,
  RatesColumnSet,
  DistributionBy,
  AgingKey,
} from "../components/asa/credit/CreditLossRateMatrix";
import type { CreditLossRateRow } from "../components/asa/graph/CreditLossRateCharts";

/* ---------- helpers ---------- */
const clean = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, "");

export function pick(o: any, candidates: string[]) {
  for (const k of candidates) {
    if (o && Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    const found = Object.keys(o || {}).find((kk) => clean(kk) === clean(k));
    if (found) return (o as any)[found];
  }
  return undefined;
}

/** "331.31%" -> 3.3131 ; "" / "-" / "#N/A" -> 0 ; numbers passthrough */
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
  return Number.isFinite(n) ? n : 0;
}

export function latestByDate<T extends { Date?: string; date?: string }>(
  arr: T[]
): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  const get = (r: any) => (r?.Date ?? r?.date ?? "").toString();
  const sorted = arr.slice().sort((a, b) => get(b).localeCompare(get(a)));
  return sorted[0];
}

function parseBool(v: any): boolean | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "yes" || s === "true") return true;
    if (s === "no" || s === "false") return false;
  }
  return Boolean(v);
}

/* ---------- Step 5 (backend-aligned) categories ---------- */
/**
 * ✅ IMPORTANT: These must match the backend response keys.
 * This fixes the wrong header like "0 day to PAR 1".
 */
export const CATS: AgingCategory[] = [
  { key: "0 day" as AgingKey, label: "0 day" },
  { key: "par 1" as AgingKey, label: "par 1" },
  { key: "par 30" as AgingKey, label: "par 30" },
  { key: "par 60" as AgingKey, label: "par 60" },
  { key: "par 90" as AgingKey, label: "par 90" },
  { key: "par 120" as AgingKey, label: "par 120" },
  { key: "par 150" as AgingKey, label: "par 150" },
  { key: "par 180" as AgingKey, label: "par 180" },
  { key: "par 210" as AgingKey, label: "par 210" },
  { key: "par 240" as AgingKey, label: "par 240" },
  { key: "par 270" as AgingKey, label: "par 270" },
  { key: "par 300" as AgingKey, label: "par 300" },
  { key: "par 330" as AgingKey, label: "par 330" },
  { key: "par 360" as AgingKey, label: "par 360" },
];

/**
 * Candidates for each backend key (robust to casing / minor variants)
 */
type KeyMap = Record<AgingKey, string[]>;
export const STEP5_KEYS: KeyMap = {
  "0 day": ["0 day", "0 Day", "0day"],
  "par 1": ["par 1", "PAR 1", "par1"],
  "par 30": ["par 30", "PAR 30", "par30"],
  "par 60": ["par 60", "PAR 60", "par60"],
  "par 90": ["par 90", "PAR 90", "par90"],
  "par 120": ["par 120", "PAR 120", "par120"],
  "par 150": ["par 150", "PAR 150", "par150"],
  "par 180": ["par 180", "PAR 180", "par180"],
  "par 210": ["par 210", "PAR 210", "par210"],
  "par 240": ["par 240", "PAR 240", "par240"],
  "par 270": ["par 270", "PAR 270", "par270"],
  "par 300": ["par 300", "PAR 300", "par300"],
  "par 330": ["par 330", "PAR 330", "par330"],
  "par 360": ["par 360", "PAR 360", "par360"],
};

function emptyCols(): Record<AgingKey, number> {
  return {
    "0 day": 0,
    "par 1": 0,
    "par 30": 0,
    "par 60": 0,
    "par 90": 0,
    "par 120": 0,
    "par 150": 0,
    "par 180": 0,
    "par 210": 0,
    "par 240": 0,
    "par 270": 0,
    "par 300": 0,
    "par 330": 0,
    "par 360": 0,
  };
}

/* ---------- coercers ---------- */

/**
 * ✅ Step 5 rows (backend-aligned)
 * Accepts payload shapes:
 * - payload.data = [...]
 * - payload.data.flow_rate_calculation = [...]
 * - payload = [...]
 *
 * Builds MonthRow with:
 * - cols using exact backend bucket keys
 * - monotonic from "Monotonic?"
 * - weighted from "Weighted Credit Loss Rate per Month"
 */
export function coerceRowsFromStep5(payload: any): MonthRow[] {
  const block =
    payload?.data?.flow_rate_calculation ??
    payload?.data?.["flow_rate_calculation"] ??
    payload?.data ??
    payload?.rows ??
    payload;

  const arr: any[] = Array.isArray(block) ? block : [];

  return arr.map((r) => {
    const date = (
      pick(r, ["Date", "Report Date", "date", "report_date"]) ?? ""
    ).toString();

    const cols = emptyCols();
    (Object.keys(cols) as AgingKey[]).forEach((k) => {
      cols[k] = pctToDecimal(pick(r, STEP5_KEYS[k]));
    });

    const monotonic = parseBool(pick(r, ["Monotonic?", "Monotonic", "monotonic"]));

    const weightedRaw = pick(r, [
      "Weighted Credit Loss Rate per Month",
      "Weighted credit loss rate / month",
      "weighted_credit_loss_rate",
      "weighted",
    ]);
    const weighted =
      weightedRaw !== undefined && weightedRaw !== null && weightedRaw !== ""
        ? pctToDecimal(weightedRaw)
        : undefined;

    return { date, cols, monotonic, weighted };
  });
}

/**
 * Optional: Rate sets (only if backend provides it).
 * If none provided, we return [] (Step5 table can render without it).
 */
export function coerceRateSets(payload: any, rows: MonthRow[]): RatesColumnSet[] {
  const explicit =
    payload?.data?.historical_credit_loss_rate ??
    payload?.data?.historical_rates ??
    payload?.data?.["Historical Credit Loss Rate"] ??
    null;

  if (explicit && !Array.isArray(explicit) && typeof explicit === "object") {
    const values = emptyCols();
    (Object.keys(values) as AgingKey[]).forEach((k) => {
      values[k] = pctToDecimal(pick(explicit, STEP5_KEYS[k]));
    });
    return [{ name: "Historical Credit Loss Rate", values }];
  }

  if (Array.isArray(explicit)) {
    const sets: RatesColumnSet[] = explicit.map((obj: any, i: number) => {
      const values = emptyCols();
      (Object.keys(values) as AgingKey[]).forEach((k) => {
        values[k] = pctToDecimal(pick(obj, STEP5_KEYS[k]));
      });
      return { name: obj?.name ?? `Rate Set ${i + 1}`, values };
    });
    return sets.filter(Boolean);
  }

  // Do not invent/transform: return empty when not provided.
  // (If you want fallback avg, you can add it back.)
  void rows;
  return [];
}

/**
 * Distribution (if you still need it for other steps/charts).
 * Returns backend-aligned keys; missing buckets default to 0.
 */
export function coerceDistribution(step5: any, step3?: any): DistributionBy | undefined {
  // 1) Step5 explicit distribution block (if exists)
  const d1 =
    step5?.data?.distribution ??
    step5?.data?.["distribution"] ??
    step5?.data?.["Distribution"] ??
    null;

  if (d1 && typeof d1 === "object" && !Array.isArray(d1)) {
    const asOf = (d1?.asOfLabel ?? d1?.asOf ?? "").toString();
    const values = emptyCols();
    (Object.keys(values) as AgingKey[]).forEach((k) => {
      values[k] = pctToDecimal(pick(d1, STEP5_KEYS[k]));
    });
    return { type: "asOf", asOfLabel: asOf || "", values };
  }

  // 2) Step3 distribution table (common)
  const distBlock =
    step3?.data?.["flow_of_balance_principal_matrix (distribution)"] ??
    step3?.data?.flow_of_balance_principal_matrix_distribution ??
    null;

  if (Array.isArray(distBlock) && distBlock.length) {
    const latest = latestByDate(distBlock as any[]);
    const date =
      (latest?.Date ?? latest?.date ?? latest?.["Report Date"] ?? "").toString();

    const values = emptyCols();

    // step3 distribution usually has these labels:
    values["0 day"] = pctToDecimal(pick(latest, ["0 day", "0 Day"]));
    values["par 1"] = pctToDecimal(
      pick(latest, ["PAR 1  (1 & 30 days)", "PAR 1 (1 & 30 days)", "PAR 1"])
    );
    values["par 30"] = pctToDecimal(
      pick(latest, ["PAR 30  (31 & 60 days)", "PAR 30 (31 & 60 days)", "PAR 30"])
    );
    values["par 60"] = pctToDecimal(
      pick(latest, ["PAR 60  (61 & 90 days)", "PAR 60 (61 & 90 days)", "PAR 60"])
    );
    values["par 90"] = pctToDecimal(
      pick(latest, ["PAR 90  (91 & 120 days)", "PAR 90 (91 & 120 days)", "PAR 90"])
    );
    values["par 120"] = pctToDecimal(
      pick(latest, ["PAR 120  (121 & 180 days)", "PAR 120 (121 & 180 days)", "PAR 120"])
    );
    values["par 180"] = pctToDecimal(
      pick(latest, ["PAR 180  (181 & 240 days)", "PAR 180 (181 & 240 days)", "PAR 180"])
    );
    values["par 240"] = pctToDecimal(
      pick(latest, ["PAR 240  (241 & 360 days)", "PAR 240 (241 & 360 days)", "PAR 240"])
    );
    values["par 360"] = pctToDecimal(
      pick(latest, ["PAR 360  (361 & Up days)", "PAR 360 (361 & Up days)", "PAR 360"])
    );

    // step3 doesn't usually have par150/par210/par270/par300/par330; they remain 0.
    return { type: "asOf", asOfLabel: `as of ${date}`, values };
  }

  return undefined;
}

/* ---------- map MonthRow[] -> charts rows ---------- */
export function toChartRows(rows: MonthRow[]): CreditLossRateRow[] {
  return (rows || []).map((r) => ({
    date: r.date,
    par_0_1: r.cols["0 day"] ?? null,
    par_1_30: r.cols["par 1"] ?? null,
    par_30_60: r.cols["par 30"] ?? null,
    par_60_90: r.cols["par 60"] ?? null,
    par_90_120: r.cols["par 90"] ?? null,
    par_120_180: r.cols["par 120"] ?? null,
    par_180_240: r.cols["par 180"] ?? null,
    par_240_360: r.cols["par 240"] ?? null,
    par_360_plus: r.cols["par 360"] ?? null,
    weighted_loss_rate: r.weighted ?? null,
  }));
}
