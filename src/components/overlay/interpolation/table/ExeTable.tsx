import { useMemo } from "react";
import MacroTable from "./MacroTable";
import { buildMacroColumns } from "./Columns";
import type { Frequency } from "./Columns";

export type ExeTableProps = {
  frequency: Frequency;
  data: Array<Record<string, any>>;
  caption?: string;
  /** If you want to show a Quarter column in Monthly view (default false) */
  includeQuarterInMonthly?: boolean;
  /** If your growth keys aren't *_gr, override it (e.g., \"_growth_rate\") */
  growthSuffix?: string;
};

export function ExeTable({
  frequency,
  data,
  caption,
  includeQuarterInMonthly,
  growthSuffix,
}: ExeTableProps) {
  const columns = useMemo(
    () =>
      buildMacroColumns(frequency, {
        includeQuarterInMonthly,
        growthSuffix,
      }),
    [frequency, includeQuarterInMonthly, growthSuffix]
  );

  return (
    <MacroTable
      caption={caption}
      columns={columns}
      rows={data}
      getRowId={(r) => (r as any).period_id ?? Math.random().toString(36)}
      numberFormat={(v) =>
        typeof v === "number"
          ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
          : v
      }
    />
  );
}

export default ExeTable;
