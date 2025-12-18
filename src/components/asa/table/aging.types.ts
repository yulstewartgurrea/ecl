// components/asa/table/aging.types.ts

export type NA = "#N/A";

/** Backend keys for Step2/Step4 (principal + distribution + flowrate calc) */
export const BUCKET_KEYS = [
  "0 day",
  "par 1",
  "par 30",
  "par 60",
  "par 90",
  "par 120",
  "par 150",
  "par 180",
  "par 210",
  "par 240",
  "par 270",
  "par 300",
  "par 330",
  "par 360",
] as const;

export type BucketKey = (typeof BUCKET_KEYS)[number];

export type AgingRow = {
  product?: string; // backend may not send this; keep optional
  date: string | Date;

  /** backend key */
  "total loan balance with c/p": number | NA;

  /** backend buckets */
} & Record<BucketKey, number | NA>;

// ---------- Helpers ----------
export function isNA(v: unknown): v is NA {
  return typeof v === "string" && v.trim().toUpperCase() === "#N/A";
}

export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "" || v === "-") return 0;
  if (isNA(v)) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v as any);
  return Number.isFinite(n) ? n : 0;
}

// ---------- Formatters ----------
export function fmtNum(n: unknown) {
  if (n === null || n === undefined || n === "") return "";
  if (isNA(n)) return "#N/A";
  const num = typeof n === "string" ? Number(n.replace(/,/g, "")) : Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** v is a fraction (0..1) */
export function fmtPct(n: unknown, digits = 6) {
  if (n === null || n === undefined || n === "") return "";
  if (isNA(n)) return "#N/A";
  const num = typeof n === "string" ? Number(n.replace(/,/g, "")) : Number(n);
  if (!Number.isFinite(num)) return String(n);

  const pct = num * 100;
  return `${pct.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function fmtDate(d: string | Date) {
  if (!d) return "";
  const s = String(d);

  // already yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return s;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
