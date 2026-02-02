import { useMemo } from "react";
import MacroTable from "./MacroTable";
import { buildMacroColumns, buildColumnsFromRows } from "./Columns";
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
  includeQuarterInMonthly,
  growthSuffix,
}: ExeTableProps) {
  const columns = useMemo(() => {
    if (data && data.length > 0) return buildColumnsFromRows(data);
    return buildMacroColumns(frequency, {
      includeQuarterInMonthly,
      growthSuffix,
    });
  }, [data, frequency, includeQuarterInMonthly, growthSuffix]);

  if (!data || data.length === 0) return null;

  const formatNoRound = (v: any, decimals = 4) => {
    if (v == null || v === "") return "";
    const n =
      typeof v === "number"
        ? v
        : Number(String(v).replace(/,/g, ""));
    if (!Number.isFinite(n)) return String(v);
    const factor = 10 ** decimals;
    const truncated = Math.trunc(n * factor) / factor;
    return truncated.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <MacroTable
      columns={columns}
      rows={data}
      getRowId={(r) => (r as any).period_id ?? Math.random().toString(36)}
      numberFormat={(v) => formatNoRound(v, 4)}
    />
  );
}

export default ExeTable;