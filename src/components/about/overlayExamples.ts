// components/about/overlayExamples.ts
// Worked examples shared by the Overlay Development and Execution "About this table" panels.

export type Row = Record<string, unknown>;

export const num = (v: unknown) =>
  typeof v === "number" ? v : v == null || v === "" ? NaN : Number(String(v).replace(/,/g, ""));

const NON_VARIABLE_KEYS = new Set([
  "Date", "date", "year", "quarter", "month", "month (int)", "id", "period_id", "x", "index", "time", "Time",
]);

const monthOf = (r: Row) => num(r["month (int)"] ?? r.month);

/**
 * Interpolation: the first month after a quarter-end equals
 * quarter-end value + (next quarter-end value − quarter-end value) ÷ 3.
 */
export function interpolationExample(rows: Row[], fmt: (n: number) => string) {
  if (!rows?.length) return null;
  const keys = Object.keys(rows[0]).filter((k) => !NON_VARIABLE_KEYS.has(k));
  // Prefer the point forecast in Execution, where each variable has forecast bands too
  const vars = [...keys.filter((k) => k.includes("Point Forecast")), ...keys.filter((k) => !k.includes("Point Forecast"))];
  for (let i = 1; i + 2 < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    const next = rows[i + 2];
    if (monthOf(prev) % 3 !== 0 || monthOf(next) % 3 !== 0) continue;
    for (const v of vars) {
      const a = num(prev[v]);
      const b = num(next[v]);
      const c = num(cur[v]);
      // skip variables whose change is invisible at the table's precision
      if (![a, b, c].every(Number.isFinite) || fmt(a) === fmt(b)) continue;
      const result = fmt(a + (b - a) / 3);
      const shown = fmt(c);
      return {
        heading: `${v} for ${cur.id ?? `month ${monthOf(cur)}`}`,
        steps: [
          `${prev.id} value + (${next.id} value − ${prev.id} value) ÷ 3`,
          `${fmt(a)} + (${fmt(b)} − ${fmt(a)}) ÷ 3`,
        ],
        result,
        tableValue: shown === result ? result : shown,
      };
    }
  }
  return null;
}

/** Logit transformation of the loss / default rate: ln(p ÷ (1 − p)). */
export function logitExample(rows: Row[], fmt: (n: number) => string) {
  if (!rows?.length) return null;
  const logitKey = Object.keys(rows[0]).find((k) => k.endsWith(".logit"));
  if (!logitKey) return null;
  const rateKey = logitKey.replace(/\.logit$/, "");
  const row = rows.find((r) => {
    const p = num(r[rateKey]);
    return p > 0 && p < 1 && Number.isFinite(num(r[logitKey]));
  });
  if (!row) return null;
  const p = num(row[rateKey]);
  const result = fmt(Math.log(p / (1 - p)));
  const shown = fmt(num(row[logitKey]));
  return {
    heading: `${logitKey} for ${row.time ?? row.Time ?? ""}`.trim(),
    steps: [`ln(${rateKey} ÷ (1 − ${rateKey}))`, `ln(${fmt(p)} ÷ ${fmt(1 - p)})`],
    result,
    tableValue: shown === result ? result : shown,
  };
}
