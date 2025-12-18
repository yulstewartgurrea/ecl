// components/asa/table/FlowRateCalcTable.tsx
import { useMemo } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import { BUCKET_KEYS, fmtDate, fmtPct, toNum, isNA } from "./aging.types";

type FlowRow = {
  product?: string;
  date: string | Date;
} & Record<string, any>;

// parse flowrate safely (backend may send number or string)
function parseFlow(v: any): number | "#N/A" {
  if (v == null || v === "" || v === "-") return 0;
  if (typeof v === "string" && v.trim().toUpperCase() === "#N/A") return "#N/A";

  // backend sample sends plain decimals like 0.0012
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  const raw = String(v).replace(/,/g, "").trim();

  if (raw.toUpperCase() === "#DIV/0!") return 0;

  // if percent string "12.3%"
  const isPercent = raw.endsWith("%");
  const n = Number(isPercent ? raw.slice(0, -1) : raw);
  if (!Number.isFinite(n)) return 0;
  return isPercent ? n / 100 : n; // if already fraction, keep it
}

const cols: Column<FlowRow>[] = [
  { key: "date", header: "date", width: 140, formatter: (v) => fmtDate(v as any) },
  ...BUCKET_KEYS.map<Column<FlowRow>>((k) => ({
    key: k,
    header: k,
    width: 140,
    align: "right",
    formatter: (v) => {
      if (isNA(v)) return "#N/A";
      return fmtPct(toNum(v), 6);
    },
  })),
];

export default function FlowRateCalcTable({
  rows,
  height = 420,
}: {
  rows: any[]; // raw rows from backend "Flow Rate Calculation"
  height?: number | string;
}) {
  const flow = useMemo(() => {
    const arr = Array.isArray(rows) ? rows : [];
    return arr.map((r) => {
      const out: FlowRow = {
        product: r.product ?? r.Product ?? undefined,
        date: r.date ?? r.Date ?? "",
      };

      BUCKET_KEYS.forEach((k) => {
        out[k] = parseFlow(r?.[k]);
      });

      return out;
    });
  }, [rows]);

  return (
    <SpreadsheetTable<FlowRow>
      columns={cols}
      rows={flow}
      height={height}
      rowKey={(r, i) => `${r.product ?? ""}-${String(r.date)}-${i}`}
      zebra
      emptyText="No data"
    />
  );
}
