// components/asa/table/agingBuckets.ts
// Shared helpers for the "About this table" panels on the Flowrate Approach tabs.
import type { AnyRow } from "./aging.types";
import { deriveKeys, fmtDate, isProbablyDateKey } from "./aging.types";

export type AgingColumn = { key: string; range: string };

const norm = (s: string) => (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
const isZeroDay = (k: string) => /^0\s*day$/.test(norm(k));
// Upload validation accepts PAR, MPD or DPD aging columns (1, 30, 60, ... in steps of 30)
const agingDays = (k: string) => {
  const m = norm(k).match(/^(par|mpd|dpd)\s*(\d+)$/);
  return m ? Number(m[2]) : null;
};

export const findDateKey = (rows: AnyRow[]) => deriveKeys(rows).find(isProbablyDateKey);

export const findTotalKey = (rows: AnyRow[]) =>
  deriveKeys(rows).find((k) => norm(k) === "total loan balance with c/p");

export const findCurrentKey = (rows: AnyRow[]) => deriveKeys(rows).find(isZeroDay);

/** Rows that have a report date, newest first (the uploaded order is not assumed). */
export function sortNewestFirst(rows: AnyRow[], dateKey: string): AnyRow[] {
  return rows
    .filter((r) => r?.[dateKey])
    .sort((a, b) => fmtDate(b[dateKey]).localeCompare(fmtDate(a[dateKey])));
}

/** The "0 day" column and the past-due columns ("par 1", "par 30", ...). */
export const bucketKeys = (rows: AnyRow[]) =>
  deriveKeys(rows).filter((k) => isZeroDay(k) || agingDays(k) !== null);

/**
 * Past-due columns sorted by days, with the range each one covers.
 * Ranges follow the aging report convention: par 1 = 1–30, par 30 = 31–60, ..., last = N+1 and up.
 */
export function agingColumns(rows: AnyRow[]): AgingColumn[] {
  const cols = deriveKeys(rows)
    .map((key) => ({ key, days: agingDays(key) }))
    .filter((c): c is { key: string; days: number } => c.days !== null)
    .sort((a, b) => a.days - b.days);

  return cols.map((c, i) => {
    const from = c.days === 1 ? 1 : c.days + 1;
    const next = cols[i + 1];
    return {
      key: c.key,
      range: next ? `${from}–${next.days} days past due` : `${from}+ days past due`,
    };
  });
}

/** Names to use in the text, following the uploaded headers: e.g. "0 day" and "PAR" (or DPD / MPD). */
export function bucketLabels(rows: AnyRow[]) {
  const first = agingColumns(rows)[0];
  return {
    current: deriveKeys(rows).find(isZeroDay) ?? "0 day",
    pastDue: first ? norm(first.key).slice(0, 3).toUpperCase() : "PAR",
  };
}

/** "par 1 = 1–30 days, par 30 = 31–60 days, and so on" */
export function rangeExamples(cols: AgingColumn[]) {
  const shown = cols.slice(0, 2).map((c) => `${c.key} = ${c.range.replace(" past due", "")}`);
  return shown.join(", ") + (cols.length > 2 ? ", and so on" : "");
}

export const fmtAmount = (n: number) =>
  n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });

type DefinitionContext = { current: string; pastDue: string; cols: AgingColumn[]; last: AgingColumn };

/**
 * Column definitions for the "About this table" panels, following the uploaded headers.
 * Covers date, 0 day, the past-due columns as a group (not one entry per column), the last bucket and the total.
 */
export function columnDefinitions(
  rows: AnyRow[],
  text: {
    date: string;
    current: (ctx: DefinitionContext) => string;
    pastDue: (ctx: DefinitionContext) => string;
    last: (ctx: DefinitionContext) => string;
    total?: string;
  }
): { name: string; text: string }[] {
  const keys = deriveKeys(rows);
  const dateKey = findDateKey(rows);
  const totalKey = findTotalKey(rows);
  const current = keys.find(isZeroDay);
  const cols = agingColumns(rows);
  const ctx: DefinitionContext = {
    current: current ?? "0 day",
    pastDue: bucketLabels(rows).pastDue,
    cols,
    last: cols[cols.length - 1],
  };

  const defs: { name: string; text: string }[] = [];
  if (dateKey) defs.push({ name: dateKey, text: text.date });
  if (current) defs.push({ name: current, text: text.current(ctx) });
  if (cols.length) defs.push({ name: `${ctx.pastDue} columns`, text: text.pastDue(ctx) });
  if (cols.length > 1) defs.push({ name: ctx.last.key, text: text.last(ctx) });
  if (totalKey && text.total) defs.push({ name: totalKey, text: text.total });
  return defs;
}
