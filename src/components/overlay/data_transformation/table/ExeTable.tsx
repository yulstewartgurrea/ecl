import { useMemo } from "react";
import MacroTable from "./MacroTable";
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
};

export default function ExeTable({
  // frequency,   // eslint-disable-line @typescript-eslint/no-unused-vars
  view,
  data,
  mevData,
  defaultData,
  caption,
  growthSuffix,
}: ExeTableProps) {
  // ❗ ALWAYS call hooks in the same order, regardless of `view`
  const consCols = useMemo(
    () => buildConsolidatedMonthlyColumns({ growthSuffix }),
    [growthSuffix]
  );
  const mevCols = useMemo(() => buildTransformMEVColumns(), []);
  const defCols = useMemo(() => buildTransformDefaultColumns(), []);

  if (view === "transformations") {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(600px,1fr)_minmax(380px,440px)]">
        <MacroTable
          caption="MEVS – Lag / Log / YoY Differencing"
          columns={mevCols}
          rows={mevData ?? []}
          getRowId={(r, i) => (r as any).period_id ?? (r as any).date_label ?? i}
        />
        <MacroTable
          caption="Observed Default Rate – Log Transformation"
          columns={defCols}
          rows={defaultData ?? []}
          getRowId={(r, i) => (r as any).date_eom ?? i}
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
      getRowId={(r, i) => (r as any).period_id ?? i}
      numberFormat={(v) =>
        typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : v ?? ""
      }
    />
  );
}
