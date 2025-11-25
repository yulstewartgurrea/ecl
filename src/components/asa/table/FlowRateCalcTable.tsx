// components/asa/table/FlowRateCalcTable.tsx
import { useMemo } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import { fmtDate } from "./aging.types";

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

// small util: normalize key
const cleanKey = (s: string) => s.toLowerCase().replace(/\s+/g, "");

// robust numeric parser for flow rates
function parseFlowValue(v: any): number {
  if (v === "" || v == null) return 0;
  const raw = String(v).replace(/,/g, "").trim();
  if (raw === "-" || raw.toUpperCase() === "#N/A" || raw.toUpperCase() === "#DIV/0!") {
    return 0;
  }

  const hasPercent = raw.includes("%");
  const numericStr = raw.replace("%", "");
  const n = Number(numericStr);
  if (!Number.isFinite(n)) return 0;

  // if explicit %, treat as already percent
  if (hasPercent) {
    return n / 100;
  }

  const abs = Math.abs(n);
  // heuristic:
  // - if <= 1.5 → treat as fraction (0..1)
  // - if > 1.5 → treat as already 0..100 percentage
  if (abs <= 1.5) return n; // fraction
  return n / 100; // already percent
}

function pickVal(row: any, candidates: string[]): number {
  for (const key of Object.keys(row || {})) {
    const ck = cleanKey(key);
    const match = candidates.find((c) => ck === cleanKey(c));
    if (match) {
      return parseFlowValue(row[key]);
    }
  }
  return 0;
}

// local formatter so small values don't all show as 0.00%
function fmtFlowPct(v: number): string {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  // show more precision for tiny rates
  const fraction = v * 100;
  if (abs < 0.0001) {
    // < 0.01% → 6 decimals
    return `${fraction.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    })}%`;
  }
  if (abs < 0.01) {
    // < 1% → 4 decimals
    return `${fraction.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })}%`;
  }
  // normal → 2 decimals
  return `${fraction.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function toFlowRow(r: any): FlowRow {
  const product = (r.product ?? r.Product ?? "").toString();
  const date = r.date ?? r.Date ?? "";

  return {
    product,
    date,
    zero_to_1: pickVal(r, ["0 Day to PAR 1", "0 day to par 1", "0daytopar1"]),
    one_to_30: pickVal(r, ["PAR 1 to PAR 30", "par 1 to par 30", "par1topar30"]),
    thirty_to_60: pickVal(r, [
      "PAR 30 to PAR 60",
      "par 30 to par 60",
      "par30topar60",
    ]),
    sixty_to_90: pickVal(r, ["PAR 60 to PAR 90", "par 60 to par 90", "par60topar90"]),
    ninety_to_120: pickVal(r, [
      "PAR 90 to PAR 120",
      "par 90 to par 120",
      "par90topar120",
    ]),
    one20_to_180: pickVal(r, [
      "PAR 120 to PAR 180",
      "par 120 to par 180",
      "par120topar180",
    ]),
    one80_to_240: pickVal(r, [
      "PAR 180 to PAR 240",
      "par 180 to par 240",
      "par180topar240",
    ]),
    two40_to_360: pickVal(r, [
      "PAR 240 to PAR 360",
      "par 240 to par 360",
      "par240topar360",
    ]),
    over_360: pickVal(r, [
      "PAR 360 above",
      "PAR 360 Above",
      "par 360 above",
      "par360above",
    ]),
  };
}

const cols: Column<FlowRow>[] = [
  // Uncomment if you want Product column shown as first col:
  // { key: "product", header: "Product", width: 140, sticky: true },
  { key: "date", header: "Date", width: 140, formatter: (v) => fmtDate(v as any) },
  {
    key: "zero_to_1",
    header: "0 Day to PAR 1",
    width: 150,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
  {
    key: "one_to_30",
    header: "PAR 1 to PAR 30",
    width: 150,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
  {
    key: "thirty_to_60",
    header: "PAR 30 to PAR 60",
    width: 150,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
  {
    key: "sixty_to_90",
    header: "PAR 60 to PAR 90",
    width: 150,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
  {
    key: "ninety_to_120",
    header: "PAR 90 to PAR 120",
    width: 160,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
  {
    key: "one20_to_180",
    header: "PAR 120 to PAR 180",
    width: 170,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
  {
    key: "one80_to_240",
    header: "PAR 180 to PAR 240",
    width: 170,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
  {
    key: "two40_to_360",
    header: "PAR 240 to PAR 360",
    width: 170,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
  {
    key: "over_360",
    header: "PAR 360 above",
    width: 140,
    align: "right",
    formatter: (v) => fmtFlowPct(v as number),
  },
];

export default function FlowRateCalcTable({
  rows,
  height = 420,
}: {
  rows: any[]; // raw rows from "Flow Rate Calculation"
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
      emptyText="No data"
    />
  );
}
