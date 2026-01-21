import type { FC } from "react";

export interface AgingPortfolioRow {
  agingCategory: string;
  count: number;
  loanBalance: number;
  distribution: number; // in %, e.g. 0.53 => 0.53%
  eclUpside: number;
  eclBaseline: number;
  eclDownside: number;
  weightedEcl: number;
}

interface AgingCategoryPortfolioEclTableProps {
  rows: AgingPortfolioRow[];
  /** Optional override. If not provided we compute: sum(weightedEcl)/sum(loanBalance). */
  overallEclRatePercent?: number;
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

const AgingCategoryPortfolioEclTable: FC<
  AgingCategoryPortfolioEclTableProps
> = ({ rows, overallEclRatePercent }) => {
  const totalCount = rows.reduce((acc, r) => acc + r.count, 0);
  const totalLoanBalance = rows.reduce((acc, r) => acc + r.loanBalance, 0);
  const totalWeightedEcl = rows.reduce((acc, r) => acc + r.weightedEcl, 0);

  const eclRate =
    typeof overallEclRatePercent === "number"
      ? overallEclRatePercent
      : totalLoanBalance > 0
      ? (totalWeightedEcl / totalLoanBalance) * 100
      : 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative max-h-[70vh] overflow-auto">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            {/* Row 1 “ group headers */}
            <tr className="text-[10px] font-semibold uppercase tracking-wide">
              <th
                rowSpan={2}
                className="  border-slate-200 bg-sky-100 px-3 py-2 text-left align-bottom text-slate-800"
              >
                Aging Category
              </th>
              <th
                rowSpan={2}
                className="  border-slate-200 bg-sky-50 px-3 py-2 text-right align-bottom text-slate-700"
              >
                Count
              </th>
              <th
                rowSpan={2}
                className="  border-slate-200 bg-amber-50 px-3 py-2 text-right align-bottom text-slate-800"
              >
                Loan Balance
              </th>
              <th
                rowSpan={2}
                className="  border-slate-200 bg-amber-50 px-3 py-2 text-right align-bottom text-slate-800"
              >
                Distribution
              </th>

              <th
                colSpan={3}
                className="  border-slate-200 bg-amber-200 px-3 py-2 text-center align-bottom text-[10px] font-semibold text-amber-900"
              >
                Expected Credit Loss
              </th>

              <th
                rowSpan={2}
                className=" border-slate-200 bg-amber-300 px-3 py-2 text-right align-bottom text-amber-900"
              >
                Weighted ECL
              </th>
            </tr>

            {/* Row 2 “ ECL scenarios (keep this bg as your current design) */}
            <tr className="text-[10px] font-semibold uppercase tracking-wide">
              <th className="  border-slate-200 bg-emerald-100 px-3 py-2 text-right text-slate-800">
                Upside
              </th>
              <th className="  border-slate-200 bg-yellow-100 px-3 py-2 text-right text-slate-800">
                Baseline
              </th>
              <th className="  border-slate-200 bg-amber-100 px-3 py-2 text-right text-slate-800">
                Downside
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={`${row.agingCategory}-${idx}`}
                className={
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/60 hover:bg-slate-100"
                }
              >
                <td className="  border-slate-100 px-3 py-1.5 text-left text-slate-800">
                  {row.agingCategory}
                </td>
                <td className="  border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {row.count.toLocaleString("en-PH")}
                </td>
                <td className="  border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(row.loanBalance)}
                </td>
                <td className="  border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatPercent(row.distribution)}
                </td>

                {/* body cells for ECL scenarios: plain, like Excel */}
                <td className="  border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(row.eclUpside)}
                </td>
                <td className="  border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(row.eclBaseline)}
                </td>
                <td className="  border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(row.eclDownside)}
                </td>

                <td className=" border-slate-100 bg-amber-100 px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900">
                  {formatCurrency(row.weightedEcl)}
                </td>
              </tr>
            ))}

            {/* TOTAL row */}
            {rows.length > 0 && (
              <tr className="bg-sky-50 font-semibold text-slate-900">
                <td className="   border-slate-200 px-3 py-1.5 text-left uppercase">
                  Total
                </td>
                <td className="   border-slate-200 px-3 py-1.5 text-right tabular-nums">
                  {totalCount.toLocaleString("en-PH")}
                </td>
                <td className="   border-slate-200 px-3 py-1.5 text-right tabular-nums">
                  {formatCurrency(totalLoanBalance)}
                </td>
                <td className="   border-slate-200 px-3 py-1.5 text-right tabular-nums">
                  100.00%
                </td>
                <td className="   border-slate-200 px-3 py-1.5 text-right tabular-nums">
                  -
                </td>
                <td className="   border-slate-200 px-3 py-1.5 text-right tabular-nums">
                  -
                </td>
                <td className="   border-slate-200 px-3 py-1.5 text-right tabular-nums">
                  -
                </td>
                <td className="  border-slate-200 bg-amber-200 px-3 py-1.5 text-right tabular-nums">
                  {formatCurrency(totalWeightedEcl)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ECL Rate strip “ aligned to right like Excel footer */}
      {rows.length > 0 && (
        <div className="flex justify-end  border-slate-200 bg-amber-50 px-6 py-3">
          <div className="inline-grid grid-cols-[auto,auto] overflow-hidden rounded-md border border-amber-200 bg-amber-100 text-[11px]">
            <div className="px-3 py-1.5 font-semibold uppercase tracking-wide text-amber-900">
              ECL Rate
            </div>
            <div className="px-3 py-1.5 bg-white text-right font-semibold tabular-nums text-slate-900">
              {formatPercent(eclRate)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AgingCategoryPortfolioEclTable;

