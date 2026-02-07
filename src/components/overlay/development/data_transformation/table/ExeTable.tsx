import { useMemo } from "react";
import MacroTable from "./MacroTable";
import type { ColumnNode } from "./MacroTable";
import {
  buildConsolidatedMonthlyColumns,
  buildTransformMEVColumns,
  buildTransformDefaultColumns,
} from "./columns";
import type { Frequency, ViewMode } from "./columns";

export type ExeTableProps = {
  frequency: Frequency; // not used, kept for compatibility
  view: ViewMode;       // "consolidated" | "transformations"
  data: Array<Record<string, any>>;
  mevData?: Array<Record<string, any>>;
  defaultData?: Array<Record<string, any>>;
  caption?: string;
  growthSuffix?: string;

  /** NEW: allow dynamic columns from the API-normalized shape */
  mevColumns?: ColumnNode[];
  defaultColumns?: ColumnNode[];
  consolidatedColumns?: ColumnNode[];
};

export default function ExeTable({
  // frequency,   // eslint-disable-line @typescript-eslint/no-unused-vars
  view,
  data,
  mevData,
  defaultData,
  caption,
  growthSuffix,

  // NEW optional dynamic columns
  mevColumns,
  defaultColumns,
  consolidatedColumns,
}: ExeTableProps) {
  // keep builder fallbacks
  const consColsBuilt = useMemo(
    () => buildConsolidatedMonthlyColumns({ growthSuffix }),
    [growthSuffix]
  );
  const mevColsBuilt = useMemo(() => buildTransformMEVColumns(), []);
  const defColsBuilt = useMemo(() => buildTransformDefaultColumns(), []);

  // prefer dynamic (from API) if provided
  const consCols = consolidatedColumns ?? consColsBuilt;
  const mevCols  = mevColumns ?? mevColsBuilt;
  const defCols  = defaultColumns ?? defColsBuilt;

  // unified row id getter that works with the new payload
  const getMEVRowId = (r: Record<string, any>, i: number) =>
    r.time ?? r.period_id ?? r.id ?? r.date_label ?? i;

  const getDefRowId = (r: Record<string, any>, i: number) =>
    r.time ?? r.date_eom ?? i;

  if (view === "transformations") {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(600px,1fr)_minmax(380px,440px)]">
        <MacroTable
          caption="MEVS - LAG / LN / ASINH / YOY DIFFERENCING"
          columns={mevCols}
          rows={mevData ?? []}
          getRowId={getMEVRowId}
        />
        <MacroTable
          caption="CREDIT LOSS RATE - LOGIT TRANSFORMATION"
          columns={defCols}
          rows={defaultData ?? []}
          getRowId={getDefRowId}
        />
      </div>
    );
  }

  // consolidated view
  return (
    <MacroTable
      caption={caption}
      columns={consCols}
      rows={data}
      getRowId={(r, i) => (r as any).time ?? (r as any).period_id ?? (r as any).id ?? i}
      numberFormat={(v) =>
        typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : v ?? ""
      }
    />
  );
}