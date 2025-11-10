// components/tableAutoAlign.ts
import type { ReactNode } from "react";

export type AnyRow = Record<string, string | number | null | undefined>;

export type DataTransformationData = {
  independent_data: AnyRow[];
  dependent_data: AnyRow[];
  independent_columns: string[];
};

// Column shape compatible with most table components; adjust if ExeTable requires extras.
export type ExeColumn = {
  key: string;                 // raw backend key (can include spaces/dots)
  header: string;              // header label
  accessor?: (row: AnyRow) => unknown;
  render?: (row: AnyRow) => ReactNode;
};

export function alignRows(resp: DataTransformationData): AnyRow[] {
  const indepByTime = new Map<string, AnyRow>();
  for (const r of resp.independent_data ?? []) {
    indepByTime.set(String(r["Time"]), r);
  }

  const depByTime = new Map<string, AnyRow>();
  for (const r of resp.dependent_data ?? []) {
    depByTime.set(String(r["Time"]), r);
  }

  const allTimes = new Set<string>([
    ...indepByTime.keys(),
    ...depByTime.keys(),
  ]);

  const rows: AnyRow[] = [];
  for (const T of Array.from(allTimes).sort()) {
    const i = indepByTime.get(T);
    const d = depByTime.get(T);
    const combined: AnyRow = {};

    if (i) Object.assign(combined, i);

    if (d) {
      for (const [k, v] of Object.entries(d)) {
        const hasValue =
          combined[k] !== undefined &&
          combined[k] !== null &&
          !(typeof combined[k] === "number" && Number.isNaN(combined[k] as number));
        if (!hasValue) combined[k] = v;
      }
    }

    if (!("Time" in combined)) combined["Time"] = T;
    if (!("id" in combined)) combined["id"] = i?.id ?? `row-${T}`;
    rows.push(combined);
  }

  return rows;
}

export function deriveExeColumns(
  resp: DataTransformationData,
  existingCols: ExeColumn[] = []
): ExeColumn[] {
  const seen = new Set(existingCols.map(c => c.key));
  const cols: ExeColumn[] = [...existingCols];

  const add = (k: string) => {
    if (!k || seen.has(k)) return;
    cols.push({
      key: k,
      header: k,
      accessor: (row) => row[k],
      render: (row) => formatCell(row[k]),
    });
    seen.add(k);
  };

  // Ensure Time appears (unless you already defined it in existingCols)
  add("Time");

  // 1) Respect backend-declared order
  for (const k of resp.independent_columns ?? []) add(String(k));

  // 2) Include any keys actually present in the data
  for (const r of resp.independent_data ?? []) for (const k of Object.keys(r)) add(k);
  for (const r of resp.dependent_data ?? []) for (const k of Object.keys(r)) add(k);

  return cols;
}

export function formatCell(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "—";
    return Math.abs(v) < 1 ? v.toFixed(6) : v.toLocaleString();
  }
  return String(v);
}