// components/asa/table/PrincipalMatrixTable.tsx
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import type { AgingRow } from "./aging.types";
import { BUCKET_KEYS, fmtDate, fmtNum } from "./aging.types";

const cols: Column<AgingRow>[] = [
  { key: "date", header: "date", width: 140, formatter: (v) => fmtDate(v as any) },
  {
    key: "total loan balance with c/p",
    header: "total loan balance with c/p",
    width: 240,
    align: "right",
    formatter: fmtNum,
  },
  ...BUCKET_KEYS.map<Column<AgingRow>>((k) => ({
    key: k,
    header: k,
    width: 140,
    align: "right",
    formatter: fmtNum,
  })),
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
      rowKey={(r, i) => `${r.product ?? ""}-${String(r.date)}-${i}`}
      zebra
      emptyText="No data"
    />
  );
}
