// components/asa/table/aging.types.ts

export type AnyRow = Record<string, any>;

const clean = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, "").trim();

export function isNA(v: unknown): boolean {
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

export function fmtNum(v: unknown) {
  if (v === null || v === undefined || v === "") return "";
  if (isNA(v)) return "#N/A";
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtDate(v: unknown) {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);

  // already ISO date (yyyy-mm-dd...)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Percent formatter:
 * expects fraction (0..1). Handles NA.
 * Uses more decimals for tiny values.
 */
export function fmtPctFraction(v: unknown) {
  if (v === null || v === undefined || v === "") return "";
  if (isNA(v)) return "#N/A";
  const n = toNum(v);
  const pct = n * 100;

  const abs = Math.abs(n);
  const digits = abs < 0.0001 ? 6 : abs < 0.01 ? 4 : 2;

  return `${pct.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** Flowrate coercion: converts numbers/strings into fraction 0..1 */
export function toFraction(v: unknown): number | "#N/A" {
  if (v === null || v === undefined || v === "" || v === "-") return 0;
  if (isNA(v)) return "#N/A";

  if (typeof v === "number") {
    if (!Number.isFinite(v)) return 0;
    // if backend gives 97 = 97% -> 0.97
    if (Math.abs(v) > 1.5) return v / 100;
    return v; // already 0..1
  }

  const raw = String(v).replace(/,/g, "").trim();
  if (!raw) return 0;
  const up = raw.toUpperCase();
  if (up === "#DIV/0!") return 0;
  if (up === "#N/A") return "#N/A";

  const hasPct = raw.endsWith("%");
  const numStr = hasPct ? raw.slice(0, -1) : raw;
  const n = Number(numStr);
  if (!Number.isFinite(n)) return 0;

  if (hasPct) return n / 100;
  if (Math.abs(n) > 1.5) return n / 100;
  return n;
}

/**
 * 100% dynamic: get union of keys from rows.
 * No static columns at all.
 */
export function deriveKeys(rows: AnyRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows || []) {
    Object.keys(r || {}).forEach((k) => set.add(k));
  }
  return Array.from(set);
}

/**
 * "nice" ordering WITHOUT any static bucket list:
 * - keys containing "date" first
 * - then keys containing "product" (if present)
 * - then everything else (stable alphanumeric)
 */
export function sortKeysSmart(keys: string[]): string[] {
  const score = (k: string) => {
    const ck = clean(k);
    if (ck.includes("date")) return 0;
    if (ck.includes("product")) return 1;
    return 2;
  };

  return keys.slice().sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;

    // if both non-meta, keep stable by key name
    return clean(a).localeCompare(clean(b));
  });
}

export function isProbablyDateKey(k: string) {
  return clean(k).includes("date");
}

export function isProbablyNumericColumn(rows: AnyRow[], key: string): boolean {
  for (const r of rows || []) {
    const v = r?.[key];
    if (v === null || v === undefined || v === "") continue;
    if (isNA(v)) return true;
    if (typeof v === "number") return true;
    if (typeof v === "string") {
      const s = v.replace(/,/g, "").trim();
      if (!s) continue;
      if (s.toUpperCase() === "#DIV/0!") return true;
      if (!Number.isNaN(Number(s.replace("%", "")))) return true;
    }
  }
  return false;
}
