// components/asa/table/PrincipalMatrixDistributionTable.tsx
import { useMemo } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import type { AnyRow } from "./aging.types";
import {
  deriveKeys,
  sortKeysSmart,
  fmtDate,
  fmtPctFraction,
  isProbablyDateKey,
  isProbablyNumericColumn,
  toNum,
  isNA,
} from "./aging.types";

export default function PrincipalMatrixDistributionTable({
  rows,
  height = 420,
}: {
  rows: AnyRow[];
  height?: number | string;
}) {
  const keys = useMemo(() => sortKeysSmart(deriveKeys(rows)), [rows]);

  // Build distribution rows dynamically:
  // - for each row, find numeric columns
  // - denominator = sum of numeric columns (excluding date/product-ish)
  const distRows = useMemo(() => {
    if (!rows?.length) return [];

    const numericKeys = keys.filter(
      (k) =>
        !isProbablyDateKey(k) &&
        !k.toLowerCase().includes("product") &&
        isProbablyNumericColumn(rows, k)
    );

    return rows.map((r) => {
      const out: AnyRow = { ...r };

      const denom =
        numericKeys.reduce((sum, k) => sum + (isNA(r[k]) ? 0 : toNum(r[k])), 0) || 1;

      numericKeys.forEach((k) => {
        const raw = r[k];
        out[k] = isNA(raw) ? 0 : toNum(raw) / denom; // fraction
      });

      return out;
    });
  }, [rows, keys]);

  const columns = useMemo(() => {
    const cols: Column<AnyRow>[] = keys.map((k) => {
      const isDate = isProbablyDateKey(k);
      const isNum = !isDate && isProbablyNumericColumn(rows, k);

      return {
        key: k,
        header: k,
        width: isDate ? 140 : isNum ? 180 : 220,
        align: isNum ? "right" : "left",
        formatter: (v) => (isDate ? fmtDate(v) : isNum ? fmtPctFraction(v) : (v ?? "")),
      };
    });

    return cols;
  }, [rows, keys]);

  return (
    <SpreadsheetTable<AnyRow>
      columns={columns}
      rows={distRows}
      height={height}
      zebra
      rowKey={(r, i) => `${JSON.stringify(r)}-${i}`}
      emptyText="No data"
    />
  );
}
