// Reusable types + formatters for aging tables

export type AgingRow = {
  product: string;
  date: string | Date;
  total_loan_balance_with_cp?: number | string;
  d0?: number | string;
  par1?: number | string;    // 1–30
  par30?: number | string;   // 31–60
  par60?: number | string;   // 61–90
  par90?: number | string;   // 91–120
  par120?: number | string;  // 121–180
  par180?: number | string;  // 181–240
  par240?: number | string;  // 241–360
  par360?: number | string;  // 361+
};

// tuple of bucket keys so TS understands keyof indexing
export const BUCKET_KEYS = [
  "d0",
  "par1",
  "par30",
  "par60",
  "par90",
  "par120",
  "par180",
  "par240",
  "par360",
] as const;

export type BucketKey = typeof BUCKET_KEYS[number];

// ---------- Helpers ----------
export function isNA(v: unknown): boolean {
  return typeof v === "string" && v.trim().toUpperCase() === "#N/A";
}

export function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (isNA(v)) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
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
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtPct(n: unknown) {
  if (n === null || n === undefined || n === "") return "";
  if (isNA(n)) return "#N/A";
  const num = typeof n === "string" ? Number(n.replace(/,/g, "")) : Number(n);
  if (Number.isNaN(num)) return String(n);
  return `${(num * 100).toFixed(2)}%`;
}

export function fmtDate(d: string | Date) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
