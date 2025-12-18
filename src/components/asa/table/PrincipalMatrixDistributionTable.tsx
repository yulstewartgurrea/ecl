// components/asa/table/PrincipalMatrixDistributionTable.tsx
import { useMemo } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import { BUCKET_KEYS, toNum, isNA, fmtDate, fmtPct } from "./aging.types";
import type { AgingRow } from "./aging.types";

export type DistRow = AgingRow;

function toDistributionRow(r: AgingRow) {
  // If backend distribution is already provided, total will be 1.
  // If principal rows are passed by mistake, this computes distribution.
  const total = Math.max(1e-9, toNum(r["total loan balance with c/p"]));
  const out: any = { ...r };

  BUCKET_KEYS.forEach((k) => {
    const v = r[k];
    out[k] = isNA(v) ? 0 : toNum(v) / total;
  });

  // total distribution should display as 100%
  out["total loan balance with c/p"] = 1;

  return out as DistRow;
}

const cols: Column<DistRow>[] = [
  { key: "date", header: "date", width: 140, formatter: (v) => fmtDate(v as any) },
  {
    key: "total loan balance with c/p",
    header: "total loan balance with c/p",
    width: 240,
    align: "right",
    formatter: (v) => fmtPct(v, 6),
  },
  ...BUCKET_KEYS.map<Column<DistRow>>((k) => ({
    key: k,
    header: k,
    width: 140,
    align: "right",
    formatter: (v) => fmtPct(typeof v === "number" ? v : toNum(v), 6),
  })),
];

export default function PrincipalMatrixDistributionTable({
  rows,
  height = 420,
}: {
  rows: AgingRow[];
  height?: number | string;
}) {
  const dist = useMemo(() => rows.map(toDistributionRow), [rows]);

  return (
    <SpreadsheetTable<DistRow>
      columns={cols}
      rows={dist}
      height={height}
      rowKey={(r, i) => `${r.product ?? ""}-${String(r.date)}-${i}`}
      zebra
      emptyText="No data"
    />
  );
}
