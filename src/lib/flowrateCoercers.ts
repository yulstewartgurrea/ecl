// src/lib/flowrateCoercers.ts
import type {
  AgingCategory,
  MonthRow,
  RatesColumnSet,
  DistributionBy,
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
/** "331.31%" -> 3.3131 ; "" / "-" / "#N/A" -> 0 */
export function pctToDecimal(v: any): number {
  if (v == null) return 0;
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

/* ---------- labels ---------- */
export const CATS: AgingCategory[] = [
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

type KeyMap = Record<AgingCategory["key"], string[]>;
export const FLOW_KEYS: KeyMap = {
  d0: ["0 Day to PAR 1", "0 day to PAR 1", "0 day→PAR 1", "d0topar1"],
  par1_30: ["PAR 1 to PAR 30", "par 1 to par 30", "par1topar30"],
  par30_60: ["PAR 30 to PAR 60", "par 30 to par 60", "par30topar60"],
  par60_90: ["PAR 60 to PAR 90", "par 60 to par 90", "par60topar90"],
  par90_120: ["PAR 90 to PAR 120", "par 90 to par 120", "par90topar120"],
  par120_180: ["PAR 120 to PAR 180", "par 120 to par 180", "par120topar180"],
  par180_240: ["PAR 180 to PAR 240", "par 180 to par 240", "par180topar240"],
  par240_360: ["PAR 240 to PAR 360", "par 240 to par 360", "par240topar360"],
  par360p: ["PAR 360 above", "par 360 above", "par360+"],
};

/* ---------- coercers ---------- */
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
    const cols: MonthRow["cols"] = {
      d0: pctToDecimal(pick(r, FLOW_KEYS.d0)),
      par1_30: pctToDecimal(pick(r, FLOW_KEYS.par1_30)),
      par30_60: pctToDecimal(pick(r, FLOW_KEYS.par30_60)),
      par60_90: pctToDecimal(pick(r, FLOW_KEYS.par60_90)),
      par90_120: pctToDecimal(pick(r, FLOW_KEYS.par90_120)),
      par120_180: pctToDecimal(pick(r, FLOW_KEYS.par120_180)),
      par180_240: pctToDecimal(pick(r, FLOW_KEYS.par180_240)),
      par240_360: pctToDecimal(pick(r, FLOW_KEYS.par240_360)),
      par360p: pctToDecimal(pick(r, FLOW_KEYS.par360p)),
    };

    const monotonicStr = pick(r, ["Monotonic?", "Monotonic", "monotonic"]);
    let monotonic: boolean | undefined = undefined;
    if (
      monotonicStr !== undefined &&
      monotonicStr !== null &&
      monotonicStr !== ""
    ) {
      const str = String(monotonicStr).toLowerCase().trim();
      monotonic = str === "yes" || monotonicStr === true;
    }
    const weightedRate = pick(r, [
      "Weighted Credit Loss Rate per Month",
      "Weighted credit loss rate / month",
      "weighted_credit_loss_rate",
    ]);
    const weighted =
      weightedRate != null && weightedRate !== ""
        ? pctToDecimal(weightedRate)
        : undefined;

    return { date, cols, monotonic, weighted };
  });
}

export function coerceRateSets(
  payload: any,
  rows: MonthRow[]
): RatesColumnSet[] {
  const explicit =
    payload?.data?.historical_credit_loss_rate ??
    payload?.data?.historical_rates ??
    payload?.data?.["Historical Credit Loss Rate"] ??
    null;

  if (explicit && !Array.isArray(explicit) && typeof explicit === "object") {
    const values = {
      d0: pctToDecimal(pick(explicit, FLOW_KEYS.d0)),
      par1_30: pctToDecimal(pick(explicit, FLOW_KEYS.par1_30)),
      par30_60: pctToDecimal(pick(explicit, FLOW_KEYS.par30_60)),
      par60_90: pctToDecimal(pick(explicit, FLOW_KEYS.par60_90)),
      par90_120: pctToDecimal(pick(explicit, FLOW_KEYS.par90_120)),
      par120_180: pctToDecimal(pick(explicit, FLOW_KEYS.par120_180)),
      par180_240: pctToDecimal(pick(explicit, FLOW_KEYS.par180_240)),
      par240_360: pctToDecimal(pick(explicit, FLOW_KEYS.par240_360)),
      par360p: pctToDecimal(pick(explicit, FLOW_KEYS.par360p)),
    };
    return [{ name: "Historical Credit Loss Rate", values }];
  }

  if (Array.isArray(explicit)) {
    const sets: RatesColumnSet[] = explicit.map((obj: any, i: number) => ({
      name: obj?.name ?? `Rate Set ${i + 1}`,
      values: {
        d0: pctToDecimal(pick(obj, FLOW_KEYS.d0)),
        par1_30: pctToDecimal(pick(obj, FLOW_KEYS.par1_30)),
        par30_60: pctToDecimal(pick(obj, FLOW_KEYS.par30_60)),
        par60_90: pctToDecimal(pick(obj, FLOW_KEYS.par60_90)),
        par90_120: pctToDecimal(pick(obj, FLOW_KEYS.par90_120)),
        par120_180: pctToDecimal(pick(obj, FLOW_KEYS.par120_180)),
        par180_240: pctToDecimal(pick(obj, FLOW_KEYS.par180_240)),
        par240_360: pctToDecimal(pick(obj, FLOW_KEYS.par240_360)),
        par360p: pctToDecimal(pick(obj, FLOW_KEYS.par360p)),
      },
    }));
    if (sets.length) return sets;
  }

  if (!rows.length) return [];
  const keys = CATS.map((c) => c.key);
  const sums: Record<string, number> = Object.fromEntries(
    keys.map((k) => [k, 0])
  );
  rows.forEach((r) =>
    keys.forEach((k) => (sums[k] += r.cols[k as keyof MonthRow["cols"]] || 0))
  );
  const avg: Record<any, number> = Object.fromEntries(
    keys.map((k) => [k, (sums[k] || 0) / rows.length])
  );
  return [{ name: "Historical (avg of months)", values: avg as any }];
}

export function coerceDistribution(
  step5: any,
  step3?: any
): DistributionBy | undefined {
  const d1 =
    step5?.data?.distribution ??
    step5?.data?.["distribution"] ??
    step5?.data?.["Distribution"] ??
    null;
  if (d1 && typeof d1 === "object" && !Array.isArray(d1)) {
    const asOf = d1?.asOfLabel ?? d1?.asOf ?? "";
    const values = {
      d0: pctToDecimal(pick(d1, FLOW_KEYS.d0)),
      par1_30: pctToDecimal(pick(d1, FLOW_KEYS.par1_30)),
      par30_60: pctToDecimal(pick(d1, FLOW_KEYS.par30_60)),
      par60_90: pctToDecimal(pick(d1, FLOW_KEYS.par60_90)),
      par90_120: pctToDecimal(pick(d1, FLOW_KEYS.par90_120)),
      par120_180: pctToDecimal(pick(d1, FLOW_KEYS.par120_180)),
      par180_240: pctToDecimal(pick(d1, FLOW_KEYS.par180_240)),
      par240_360: pctToDecimal(pick(d1, FLOW_KEYS.par240_360)),
      par360p: pctToDecimal(pick(d1, FLOW_KEYS.par360p)),
    };
    return { type: "asOf", asOfLabel: asOf || "", values };
  }

  const distBlock =
    step3?.data?.["flow_of_balance_principal_matrix (distribution)"] ??
    step3?.data?.flow_of_balance_principal_matrix_distribution ??
    null;

  if (Array.isArray(distBlock) && distBlock.length) {
    const latest = latestByDate(distBlock as any[]);
    const date = (
      latest?.Date ??
      latest?.date ??
      latest?.["Report Date"] ??
      ""
    ).toString();
    const values = {
      d0: pctToDecimal(pick(latest, ["0 day", "0 Day"])),
      par1_30: pctToDecimal(
        pick(latest, ["PAR 1  (1 & 30 days)", "PAR 1 (1 & 30 days)"])
      ),
      par30_60: pctToDecimal(
        pick(latest, ["PAR 30  (31 & 60 days)", "PAR 30 (31 & 60 days)"])
      ),
      par60_90: pctToDecimal(
        pick(latest, ["PAR 60  (61 & 90 days)", "PAR 60 (61 & 90 days)"])
      ),
      par90_120: pctToDecimal(
        pick(latest, ["PAR 90  (91 & 120 days)", "PAR 90 (91 & 120 days)"])
      ),
      par120_180: pctToDecimal(
        pick(latest, ["PAR 120  (121 & 180 days)", "PAR 120 (121 & 180 days)"])
      ),
      par180_240: pctToDecimal(
        pick(latest, ["PAR 180  (181 & 240 days)", "PAR 180 (181 & 240 days)"])
      ),
      par240_360: pctToDecimal(
        pick(latest, ["PAR 240  (241 & 360 days)", "PAR 240 (241 & 360 days)"])
      ),
      par360p: pctToDecimal(
        pick(latest, ["PAR 360  (361 & Up days)", "PAR 360 (361 & Up days)"])
      ),
    };
    return { type: "asOf", asOfLabel: `as of ${date}`, values };
  }
  return undefined;
}

/* ---------- map MonthRow[] -> charts rows ---------- */
export function toChartRows(rows: MonthRow[]): CreditLossRateRow[] {
  return (rows || []).map((r) => ({
    date: r.date,
    par_0_1: r.cols.d0 ?? null,
    par_1_30: r.cols.par1_30 ?? null,
    par_30_60: r.cols.par30_60 ?? null,
    par_60_90: r.cols.par60_90 ?? null,
    par_90_120: r.cols.par90_120 ?? null,
    par_120_180: r.cols.par120_180 ?? null,
    par_180_240: r.cols.par180_240 ?? null,
    par_240_360: r.cols.par240_360 ?? null,
    par_360_plus: r.cols.par360p ?? null,
    weighted_loss_rate: r.weighted ?? null,
  }));
}
