// components/asa/table/PrincipalMatrixTable.tsx
import { useMemo } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import type { AnyRow } from "./aging.types";
import { deriveKeys, sortKeysSmart, fmtDate, fmtNum, isProbablyDateKey, isProbablyNumericColumn } from "./aging.types";

export default function PrincipalMatrixTable({
  rows,
  height = 420,
}: {
  rows: AnyRow[];
  height?: number | string;
}) {
  const columns = useMemo(() => {
    const keys = sortKeysSmart(deriveKeys(rows));

    const cols: Column<AnyRow>[] = keys.map((k) => {
      const isDate = isProbablyDateKey(k);
      const isNum = !isDate && isProbablyNumericColumn(rows, k);

      return {
        key: k,
        header: k, // exactly what backend returns
        width: isDate ? 140 : isNum ? 180 : 220,
        align: isNum ? "right" : "left",
        formatter: (v) => (isDate ? fmtDate(v) : isNum ? fmtNum(v) : (v ?? "")),
      };
    });

    return cols;
  }, [rows]);

  return (
    <SpreadsheetTable<AnyRow>
      columns={columns}
      rows={rows}
      height={height}
      zebra
      rowKey={(r, i) => `${JSON.stringify(r)}-${i}`}
      emptyText="No data"
    />
  );
}
