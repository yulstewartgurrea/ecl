// components/asa/table/FlowRateCalcTable.tsx
import { useMemo } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import type { AnyRow } from "./aging.types";
import {
  deriveKeys,
  sortKeysSmart,
  isProbablyDateKey,
  isProbablyNumericColumn,
  fmtDate,
  fmtPctFraction,
  toFraction,
  isNA,
} from "./aging.types";

export default function FlowRateCalcTable({
  rows,
  height = 420,
}: {
  rows: AnyRow[];
  height?: number | string;
}) {
  const keys = useMemo(() => sortKeysSmart(deriveKeys(rows)), [rows]);

  // Convert numeric-ish fields to fraction 0..1 (for correct % display)
  const flowRows = useMemo(() => {
    if (!rows?.length) return [];

    return rows.map((r) => {
      const out: AnyRow = { ...r };

      for (const k of keys) {
        if (isProbablyDateKey(k)) continue;
        if (k.toLowerCase().includes("product")) continue;

        // only coerce numeric-looking columns
        if (isProbablyNumericColumn(rows, k)) {
          const frac = toFraction(r[k]);
          out[k] = frac;
        }
      }

      return out;
    });
  }, [rows, keys]);

  const columns = useMemo(() => {
    return keys.map<Column<AnyRow>>((k) => {
      const isDate = isProbablyDateKey(k);
      const isNum = !isDate && isProbablyNumericColumn(rows, k);

      return {
        key: k,
        header: k,
        width: isDate ? 140 : isNum ? 180 : 220,
        align: isNum ? "right" : "left",
        formatter: (v) => {
          if (isDate) return fmtDate(v);
          if (!isNum) return v ?? "";

          if (isNA(v)) return "#N/A";
          // v is expected fraction after coercion
          return fmtPctFraction(v);
        },
      };
    });
  }, [rows, keys]);

  return (
    <SpreadsheetTable<AnyRow>
      columns={columns}
      rows={flowRows}
      height={height}
      zebra
      rowKey={(r, i) => `${JSON.stringify(r)}-${i}`}
      emptyText="No data"
    />
  );
}
