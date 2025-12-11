import type { FC } from "react";

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
  delinquent: number;
  delinquentDays: number;
  agingCategory: string;
  // credit loss rates (already in % units, e.g. 0.74 for 0.74%)
  creditLossUpside: number;
  creditLossBaseline: number;
  creditLossDownside: number;
  // expected credit loss amounts
  eclUpside: number;
  eclBaseline: number;
  eclDownside: number;
  weightedEcl: number;
}

interface ClientLevelEclTableProps {
  rows: EclClientRow[];
  reportingDate?: string;
}

const formatCurrency = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  });
};

// const formatPercent = (value: number | null | undefined) => {
//   if (value == null || Number.isNaN(value)) return "-";
//   return `${value.toFixed(2)}%`;
// };

const ClientLevelEclTable: FC<ClientLevelEclTableProps> = ({
  rows,
  reportingDate,
}) => {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header / toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            Loan-Level Expected Credit Loss
          </h2>
          <p className="text-xs text-slate-500">
            This table shows the ECL calculation per client loan, including
            credit loss rates and scenario-based ECL.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          {reportingDate && (
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              Reporting date: {reportingDate}
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Total records:{" "}
            <span className="font-semibold text-slate-800">
              {rows.length.toLocaleString("en-PH")}
            </span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="relative max-h-[70vh] overflow-auto">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10">
            {/* Grouped header row – backgrounds per cell to align colors */}
            <tr className="text-[10px] font-semibold uppercase tracking-wide">
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left align-bottom text-slate-700"
              >
                Date
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left align-bottom text-slate-700"
              >
                Client Ref No
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left align-bottom text-slate-700"
              >
                Loan Ref No
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left align-bottom text-slate-700"
              >
                Service Code
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right align-bottom text-slate-700"
              >
                Principal Loan Balance
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right align-bottom text-slate-700"
              >
                Loan Balance
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right align-bottom text-slate-700"
              >
                Past Due Amount
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right align-bottom text-slate-700"
              >
                Total Savings
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right align-bottom text-slate-700"
              >
                No. of Payments
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right align-bottom text-slate-700"
              >
                Delinquent
              </th>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-right align-bottom text-slate-700"
              >
                Delinquent Days
              </th>
              
            </tr>

     
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={`${row.clientRefNo}-${row.loanRefNo}-${idx}`}
                className={
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/40 hover:bg-slate-100"
                }
              >
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-left text-slate-700">
                  {row.date}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-left text-slate-700">
                  {row.clientRefNo}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-left text-slate-700">
                  {row.loanRefNo}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-left text-slate-700">
                  {row.serviceCode}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(row.principalLoanBalance)}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(row.loanBalance)}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(row.pastDueAmount)}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {formatCurrency(row.totalSavings)}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {row.noPayment.toLocaleString("en-PH")}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {row.delinquent.toLocaleString("en-PH")}
                </td>
                <td className="border-b border-r border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                  {row.delinquentDays.toLocaleString("en-PH")}
                </td>
                
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={18}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ClientLevelEclTable;
