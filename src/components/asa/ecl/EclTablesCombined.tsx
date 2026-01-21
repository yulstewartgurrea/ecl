import type { FC } from "react"

export interface EclClientRow {
  date: string;
  clientRefNo: string;
  loanRefNo: string;
  serviceCode: string;
  principalLoanBalance: number;
  loanBalance: number;
  pastDueAmount: number;
  totalSavings: number;
  noPayment: number;
  delinquentDays: number;
  agingCategory: string;

  // Credit Loss Rates in percent points (e.g. 0.74 means 0.74%)
  creditLossUpside: number;
  creditLossBaseline: number;
  creditLossDownside: number;

  // Expected Credit Loss amounts
  eclUpside: number;
  eclBaseline: number;
  eclDownside: number;
  weightedEcl: number;
}

type Props = {
  rows: EclClientRow[];
  reportingDate?: string;
  totalLoanBalance?: number;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
};

const formatNumber = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toLocaleString("en-PH");
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return `${Number(value).toFixed(2)}%`;
};

const EclCombinedExcelTable: FC<Props> = ({ rows, reportingDate, totalLoanBalance }) => {
  // const totalLoanBalance = useMemo(() => {
  //   return (rows ?? []).reduce((sum, r) => sum + Number(r.loanBalance || 0), 0);
  // }, [rows]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Top "TOTAL LOAN BALANCE" box like Excel */}
      <div className=" border-slate-200 bg-white px-4 py-3">
        <div className="inline-block">
          <div className="bg-[#FFC000] px-3 py-1 text-[11px] font-bold text-slate-900 border border-slate-300 text-center">
            TOTAL LOAN BALANCE
          </div>
          <div className="px-3 py-1 text-[12px] font-semibold text-slate-900 border border-slate-300 border-t-0 text-center">
            {formatCurrency(totalLoanBalance)}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {reportingDate ? (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Reporting date: <b className="text-slate-800">{reportingDate}</b>
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Records: <b className="text-slate-800">{formatNumber(rows.length)}</b>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="relative max-h-[70vh] overflow-auto">
        <table className="min-w-[1400px] w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            {/* Group header row */}
            <tr className="text-[10px] font-bold uppercase tracking-wide">
              {/* Left columns (rowSpan=2) */}
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-left">
                date
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-left">
                client_ref_no
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-left">
                loan_ref_no
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-left">
                ServiceCode
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-right">
                principal_loan_balance
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-right">
                loan_balance
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-right">
                past_due_amount
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-right">
                TotalSavings
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-right">
                no_payment
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-right">
                delinquent_days
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-left">
                Aging Category
              </th>

              {/* Grouped blocks */}
              <th
                colSpan={3}
                className="border border-slate-300 bg-[#B7DEE8] px-2 py-2 text-center"
              >
                Credit Loss Rates
              </th>
              <th
                colSpan={3}
                className="border border-slate-300 bg-[#FFD966] px-2 py-2 text-center"
              >
                Expected Credit Loss
              </th>
              <th
                rowSpan={2}
                className="border border-slate-300 bg-[#FFC000] px-2 py-2 text-right"
              >
                Weighted ECL
              </th>
            </tr>

            {/* Sub headers for grouped blocks */}
            <tr className="text-[10px] font-bold uppercase tracking-wide">
              <th className="border border-slate-300 bg-[#D9EAF7] px-2 py-2 text-right">
                Upside
              </th>
              <th className="border border-slate-300 bg-[#D9EAF7] px-2 py-2 text-right">
                Baseline
              </th>
              <th className="border border-slate-300 bg-[#D9EAF7] px-2 py-2 text-right">
                Downside
              </th>

              <th className="border border-slate-300 bg-[#FFF2CC] px-2 py-2 text-right">
                Upside
              </th>
              <th className="border border-slate-300 bg-[#FFF2CC] px-2 py-2 text-right">
                Baseline
              </th>
              <th className="border border-slate-300 bg-[#FFF2CC] px-2 py-2 text-right">
                Downside
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={18} className="px-4 py-8 text-center text-xs text-slate-500">
                  No data available.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr
                  key={`${r.clientRefNo}-${r.loanRefNo}-${idx}`}
                  className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                >
                  <td className="border border-slate-200 px-2 py-1.5 text-left">{r.date}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-left">{r.clientRefNo}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-left">{r.loanRefNo}</td>
                  <td className="border border-slate-200 px-2 py-1.5 text-left">{r.serviceCode}</td>

                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(r.principalLoanBalance)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(r.loanBalance)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(r.pastDueAmount)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(r.totalSavings)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatNumber(r.noPayment)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatNumber(r.delinquentDays)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-left">{r.agingCategory}</td>

                  {/* Credit Loss Rates */}
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatPercent(r.creditLossUpside)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatPercent(r.creditLossBaseline)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatPercent(r.creditLossDownside)}
                  </td>

                  {/* Expected Credit Loss */}
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(r.eclUpside)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(r.eclBaseline)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(r.eclDownside)}
                  </td>

                  {/* Weighted ECL */}
                  <td className="border border-slate-200 px-2 py-1.5 text-right tabular-nums font-semibold">
                    {formatCurrency(r.weightedEcl)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default EclCombinedExcelTable;

