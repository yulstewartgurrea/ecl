// pages/ecl/steps/Step2.tsx
import { useState } from "react";
import {
  InformationCircleIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { useAppSelector } from "../../../redux_toolkit/hooks";
import ClientLevelEclTable, {
  type EclClientRow,
} from "../../../components/asa/ecl/ClientLevelEclTable";
import AgingCategorySummaryTable, {
  type EclAgingSummaryRow,
} from "../../../components/asa/ecl/CreditLossConfigPanel";

// --- DEMO DATA ------------------------------------------------------
// In your real app, replace these with API results from your backend.

const demoClientRows: EclClientRow[] = [
  {
    date: "09/30/2025",
    clientRefNo: "CLT187803",
    loanRefNo: "8.07E+14",
    serviceCode: "2",
    principalLoanBalance: 94211,
    loanBalance: 104000,
    pastDueAmount: 81250,
    totalSavings: 41690,
    noPayment: 37,
    delinquent: 259,
    delinquentDays: 259,
    agingCategory: "PAR 270",
    creditLossUpside: 0.74,
    creditLossBaseline: 1.48,
    creditLossDownside: 6.68,
    eclUpside: 772.11,
    eclBaseline: 1544.22,
    eclDownside: 6948.98,
    weightedEcl: 2393.54,
  },
  {
    date: "09/30/2025",
    clientRefNo: "CLT187805",
    loanRefNo: "8.07E+14",
    serviceCode: "1",
    principalLoanBalance: 5961,
    loanBalance: 6600,
    pastDueAmount: 3000,
    totalSavings: 5680,
    noPayment: 27,
    delinquent: 189,
    delinquentDays: 189,
    agingCategory: "PAR 180",
    creditLossUpside: 0.68,
    creditLossBaseline: 1.35,
    creditLossDownside: 6.08,
    eclUpside: 44.57,
    eclBaseline: 89.15,
    eclDownside: 401.17,
    weightedEcl: 138.18,
  },
  // add a few more rows if you want, purely for visual fullness
];

const demoSummaryRows: EclAgingSummaryRow[] = [
  {
    agingCategory: "PAR 270",
    creditLossUpside: 0.74,
    creditLossBaseline: 1.48,
    creditLossDownside: 6.68,
    eclUpside: 772.11,
    eclBaseline: 1544.22,
    eclDownside: 6948.98,
    weightedEcl: 2393.54,
  },
  {
    agingCategory: "PAR 180",
    creditLossUpside: 0.68,
    creditLossBaseline: 1.35,
    creditLossDownside: 6.08,
    eclUpside: 96.24,
    eclBaseline: 192.48,
    eclDownside: 866.17,
    weightedEcl: 298.35,
  },
  {
    agingCategory: "PAR 150",
    creditLossUpside: 0.66,
    creditLossBaseline: 1.32,
    creditLossDownside: 5.96,
    eclUpside: 91.01,
    eclBaseline: 182.02,
    eclDownside: 836.09,
    weightedEcl: 282.13,
  },
];

export default function Step2() {
  const reduxToken = useAppSelector((s) => s.auth.token);
  const token = reduxToken ?? undefined; // currently unused but ready for API calls

  const [summaryRows, setSummaryRows] = useState<EclAgingSummaryRow[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const openConfig = () => setIsConfigOpen(true);
  const closeConfig = () => !isApplying && setIsConfigOpen(false);

  const handleApplyConfiguration = async () => {
    setIsApplying(true);
    try {
      // TODO: call your backend using `token` and get real summary rows
      // const resp = await fetch("/api/ecl/step2", { headers: { Authorization: `Bearer ${token}` }});
      // const data: EclAgingSummaryRow[] = await resp.json();
      // setSummaryRows(data);

      setSummaryRows(demoSummaryRows); // demo only
    } catch (e) {
        console.log(token)
      console.error(e);
      // you can surface an error toast here if you like
    } finally {
      setIsApplying(false);
      setIsConfigOpen(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Description block (Excel yellow bar but app-ified) */}
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm">
          <div className="flex gap-3">
            <div className="mt-0.5">
              <InformationCircleIcon className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-amber-900">
                Description
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                This step summarizes Expected Credit Loss (ECL) by aging
                category. Configure the client-level ECL sheet first, then apply
                it to generate the Credit Loss Rates and Expected Credit Loss
                per scenario.
              </p>
            </div>
          </div>
        </section>

        {/* Summary card (4th picture) */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Aging-Category ECL Summary
              </h2>
              <p className="text-xs text-slate-500">
                Output table derived from the configured loan-level ECL sheet.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-slate-500 sm:inline">
                {summaryRows.length === 0
                  ? "Not yet configured."
                  : `Generated rows: ${summaryRows.length.toLocaleString(
                      "en-PH",
                    )}`}
              </span>
              <button
                type="button"
                onClick={openConfig}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                <Cog6ToothIcon className="h-4 w-4" />
                Configure
              </button>
            </div>
          </div>

          <AgingCategorySummaryTable rows={summaryRows} />
        </section>
      </div>

      {/* CONFIG MODAL – shows 3rd picture (loan-level sheet) */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[90vh] w-full max-w-[1400px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Configure client-level ECL sheet
                </h3>
                <p className="text-xs text-slate-500">
                  Review or adjust the loan-level ECL input before generating
                  the aging-category summary.
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfig}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body – loan-level table (3rd picture) */}
            <div className="px-5 pb-4 pt-3">
             
              <ClientLevelEclTable
                rows={demoClientRows}
                reportingDate="30 September 2025"
              />
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={closeConfig}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                disabled={isApplying}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyConfiguration}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isApplying}
              >
                {isApplying ? "Applying…" : "Apply configuration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
