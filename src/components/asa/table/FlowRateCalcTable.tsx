// components/asa/table/FlowRateCalcTable.tsx
import React, { useMemo } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import { fmtDate, fmtPct } from "./aging.types";
import type { AgingRow } from "./aging.types";

/**
 * Static illustration (replace with real transitions later).
 */
type FlowRow = {
  product: string;
  date: string | Date;
  zero_to_1: number;
  one_to_30: number;
  thirty_to_60: number;
  sixty_to_90: number;
  ninety_to_120: number;
  one20_to_180: number;
  one80_to_240: number;
  two40_to_360: number;
  over_360: number;
};

function toFlowRow(r: AgingRow): FlowRow {
  return {
    product: r.product,
    date: r.date,
    zero_to_1: 0,
    one_to_30: 0,
    thirty_to_60: 0,
    sixty_to_90: 0,
    ninety_to_120: 0,
    one20_to_180: 0,
    one80_to_240: 0,
    two40_to_360: 0,
    over_360: 1, // 100%
  };
}

const cols: Column<FlowRow>[] = [
  // { key: "product", header: "Product", width: 140, sticky: true },
  { key: "date", header: "Date", width: 140, formatter: (v) => fmtDate(v as any) },
  { key: "zero_to_1", header: "0 Day to PAR 1", width: 150, align: "right", formatter: (v) => fmtPct(v as number) },
  { key: "one_to_30", header: "PAR 1 to PAR 30", width: 150, align: "right", formatter: (v) => fmtPct(v as number) },
  { key: "thirty_to_60", header: "PAR 30 to PAR 60", width: 150, align: "right", formatter: (v) => fmtPct(v as number) },
  { key: "sixty_to_90", header: "PAR 60 to PAR 90", width: 150, align: "right", formatter: (v) => fmtPct(v as number) },
  { key: "ninety_to_120", header: "PAR 90 to PAR 120", width: 160, align: "right", formatter: (v) => fmtPct(v as number) },
  { key: "one20_to_180", header: "PAR 120 to PAR 180", width: 170, align: "right", formatter: (v) => fmtPct(v as number) },
  { key: "one80_to_240", header: "PAR 180 to PAR 240", width: 170, align: "right", formatter: (v) => fmtPct(v as number) },
  { key: "two40_to_360", header: "PAR 240 to PAR 360", width: 170, align: "right", formatter: (v) => fmtPct(v as number) },
  { key: "over_360", header: "PAR 360 above", width: 140, align: "right", formatter: (v) => fmtPct(v as number) },
];

export default function FlowRateCalcTable({
  rows,
  height = 420,
}: {
  rows: AgingRow[];
  height?: number | string;
}) {
  const flow = useMemo(() => rows.map(toFlowRow), [rows]);
  return (
    <SpreadsheetTable<FlowRow>
      columns={cols}
      rows={flow}
      height={height}
      rowKey={(r, i) => `${r.product}-${r.date}-${i}`}
      zebra
      // removed headerBg / headerText so this matches Step 5's neutral table header
      emptyText="No data"
    />
  );
}
