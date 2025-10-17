// components/asa/table/PrincipalMatrixDistributionTable.tsx
import React, { useMemo } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import { BUCKET_KEYS, toNum, isNA, fmtDate, fmtPct } from "./aging.types";
import type { AgingRow } from "./aging.types";

export type DistRow = AgingRow & {};

function toDistributionRow(r: AgingRow) {
  const total = Math.max(1e-9, toNum(r.total_loan_balance_with_cp));
  const out: any = { ...r };
  BUCKET_KEYS.forEach((k) => {
    const v = r[k];
    out[k] = isNA(v) ? 0 : toNum(v) / total;
  });
  return out as DistRow;
}

const cols: Column<DistRow>[] = [
  { key: "product", header: "Product", width: 140, sticky: true },
  { key: "date", header: "Date", width: 140, formatter: (v) => fmtDate(v as any) },
  ...BUCKET_KEYS.map<Column<DistRow>>((k) => ({
    key: k,
    header:
      k === "d0"
        ? "0 day"
        : k === "par1"
        ? "PAR 1 (1 & 30 days)"
        : k === "par30"
        ? "PAR 30 (31 & 60 days)"
        : k === "par60"
        ? "PAR 60 (61 & 90 days)"
        : k === "par90"
        ? "PAR 90 (91 & 120 days)"
        : k === "par120"
        ? "PAR 120 (121 & 180 days)"
        : k === "par180"
        ? "PAR 180 (181 & 240 days)"
        : k === "par240"
        ? "PAR 240 (241 & 360 days)"
        : "PAR 360 (361 & Up days)",
    width: 180,
    align: "right",
    formatter: (v) => fmtPct(typeof v === "number" ? v : 0),
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
      rowKey={(r, i) => `${r.product}-${r.date}-${i}`}
      zebra
      // removed headerBg / headerText so this matches Step 5's neutral table header
      emptyText="No data"
    />
  );
}
