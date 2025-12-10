import type { FC } from "react";

export interface EclAgingSummaryRow {
  agingCategory: string;
  creditLossUpside: number;
  creditLossBaseline: number;
  creditLossDownside: number;
  eclUpside: number;
  eclBaseline: number;
  eclDownside: number;
  weightedEcl: number;
}

interface AgingCategorySummaryTableProps {
  rows: EclAgingSummaryRow[];
}

const formatCurrency = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)}%`;
};

const AgingCategorySummaryTable: FC<AgingCategorySummaryTableProps> = ({
  rows,
}) => {
  return (
    <div className="relative max-h-[70vh] overflow-auto">
      <table className="min-w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10">
          <tr className="text-[10px] font-semibold uppercase tracking-wide">
            <th
              rowSpan={2}
              className="border-b border-r border-slate-200 bg-amber-100 px-3 py-2 text-left align-bottom text-slate-800"
            >
              Aging Category
            </th>
            <th
              colSpan={3}
              className="border-b border-r border-slate-200 bg-sky-100 px-3 py-2 text-center align-bottom text-sky-900"
            >
              Credit Loss Rates
            </th>
            <th
              colSpan={4}
              className="border-b border-slate-200 bg-amber-100 px-3 py-2 text-center align-bottom text-amber-900"
            >
              Expected Credit Loss
            </th>
          </tr>
          <tr className="text-[10px] font-semibold uppercase tracking-wide">
            <th className="border-b border-r border-slate-200 bg-sky-100 px-3 py-2 text-right text-slate-700">
              Upside
            </th>
            <th className="border-b border-r border-slate-200 bg-sky-100 px-3 py-2 text-right text-slate-700">
              Baseline
            </th>
            <th className="border-b border-r border-slate-200 bg-sky-100 px-3 py-2 text-right text-slate-700">
              Downside
            </th>
            <th className="border-b border-r border-slate-200 bg-amber-100 px-3 py-2 text-right text-slate-800">
              Upside
            </th>
            <th className="border-b border-r border-slate-200 bg-amber-100 px-3 py-2 text-right text-slate-800">
              Baseline
            </th>
            <th className="border-b border-r border-slate-200 bg-amber-100 px-3 py-2 text-right text-slate-800">
              Downside
            </th>
            <th className="border-b border-slate-200 bg-amber-200 px-3 py-2 text-right text-amber-900">
              Weighted ECL
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-6 text-center text-xs text-slate-500"
              >
                No output yet. Click <span className="font-semibold">Configure</span>{" "}
                and apply the client-level sheet to generate this summary.
              </td>
            </tr>
          )}

          {rows.map((row, idx) => (
            <tr
              key={`${row.agingCategory}-${idx}`}
              className={
                idx % 2 === 0 ? "bg-white" : "bg-slate-50/60 hover:bg-slate-100"
              }
            >
              <td className="border-b border-r border-slate-100 px-3 py-1.5 text-left text-slate-800">
                {row.agingCategory}
              </td>
              <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                {formatPercent(row.creditLossUpside)}
              </td>
              <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                {formatPercent(row.creditLossBaseline)}
              </td>
              <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                {formatPercent(row.creditLossDownside)}
              </td>
              <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                {formatCurrency(row.eclUpside)}
              </td>
              <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                {formatCurrency(row.eclBaseline)}
              </td>
              <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                {formatCurrency(row.eclDownside)}
              </td>
              <td className="border-b border-slate-100 px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900">
                {formatCurrency(row.weightedEcl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AgingCategorySummaryTable;
