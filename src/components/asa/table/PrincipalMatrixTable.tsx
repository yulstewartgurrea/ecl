// components/asa/table/PrincipalMatrixTable.tsx
import React from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import type { AgingRow } from "./aging.types";
import { fmtDate, fmtNum } from "./aging.types";

const cols: Column<AgingRow>[] = [
  { key: "product", header: "Product", width: 140, sticky: true },
  { key: "date", header: "Date", width: 140, formatter: (v) => fmtDate(v as any) },
  {
    key: "total_loan_balance_with_cp",
    header: "Total Loan Balance with C/P",
    width: 220,
    align: "right",
    formatter: fmtNum,
  },
  { key: "d0", header: "0 day", width: 130, align: "right", formatter: fmtNum },
  { key: "par1", header: "PAR 1 (1 & 30 days)", width: 180, align: "right", formatter: fmtNum },
  { key: "par30", header: "PAR 30 (31 & 60 days)", width: 190, align: "right", formatter: fmtNum },
  { key: "par60", header: "PAR 60 (61 & 90 days)", width: 190, align: "right", formatter: fmtNum },
  { key: "par90", header: "PAR 90 (91 & 120 days)", width: 200, align: "right", formatter: fmtNum },
  { key: "par120", header: "PAR 120 (121 & 180 days)", width: 210, align: "right", formatter: fmtNum },
  { key: "par180", header: "PAR 180 (181 & 240 days)", width: 210, align: "right", formatter: fmtNum },
  { key: "par240", header: "PAR 240 (241 & 360 days)", width: 210, align: "right", formatter: fmtNum },
  { key: "par360", header: "PAR 360 (361 & Up days)", width: 210, align: "right", formatter: fmtNum },
];

export default function PrincipalMatrixTable({
  rows,
  height = 420,
}: {
  rows: AgingRow[];
  height?: number | string;
}) {
  return (
    <SpreadsheetTable<AgingRow>
      columns={cols}
      rows={rows}
      height={height}
      rowKey={(r, i) => `${r.product}-${r.date}-${i}`}
      zebra
      // removed headerBg / headerText so this matches Step 5's neutral table header
      emptyText="No data"
    />
  );
}
