// pages/ecl/steps/Step3.tsx
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import AgingCategoryPortfolioEclTable, {
  type AgingPortfolioRow,
} from "../../../components/asa/ecl/AgingCategoryPortfolioEclTable";

const demoRows: AgingPortfolioRow[] = [
  {
    agingCategory: "0 day",
    count: 1151,
    loanBalance: 9604900,
    distribution: 0.53,
    eclUpside: 93.18,
    eclBaseline: 186.37,
    eclDownside: 838.66,
    weightedEcl: 288.87,
  },
  {
    agingCategory: "PAR 1",
    count: 2671,
    loanBalance: 38626330,
    distribution: 2.14,
    eclUpside: 204371.78,
    eclBaseline: 408743.56,
    eclDownside: 1839346.02,
    weightedEcl: 633552.52,
  },
  {
    agingCategory: "PAR 30",
    count: 6852,
    loanBalance: 118371972,
    distribution: 6.55,
    eclUpside: 675555.28,
    eclBaseline: 1351110.56,
    eclDownside: 6079991.37,
    weightedEcl: 2094221.37,
  },
  {
    agingCategory: "PAR 60",
    count: 7934,
    loanBalance: 121050250,
    distribution: 6.70,
    eclUpside: 733606.78,
    eclBaseline: 1467213.55,
    eclDownside: 6602460.99,
    weightedEcl: 2274181.01,
  },
  {
    agingCategory: "PAR 90",
    count: 3662,
    loanBalance: 50329365,
    distribution: 2.79,
    eclUpside: 316810.8,
    eclBaseline: 633602.01,
    eclDownside: 2851924.02,
    weightedEcl: 982083.12,
  },
  {
    agingCategory: "PAR 120",
    count: 8979,
    loanBalance: 155828600,
    distribution: 8.63,
    eclUpside: 1007502.91,
    eclBaseline: 2015005.82,
    eclDownside: 9067526.2,
    weightedEcl: 3123259.03,
  },
  {
    agingCategory: "PAR 150",
    count: 9763,
    loanBalance: 172913010,
    distribution: 9.58,
    eclUpside: 1144483.06,
    eclBaseline: 2288966.12,
    eclDownside: 10300347.53,
    weightedEcl: 3547897.48,
  },
  {
    agingCategory: "PAR 180",
    count: 10653,
    loanBalance: 187064360,
    distribution: 10.35,
    eclUpside: 1263392.68,
    eclBaseline: 2526785.36,
    eclDownside: 11730534.14,
    weightedEcl: 3916571.31,
  },
  {
    agingCategory: "PAR 210",
    count: 11302,
    loanBalance: 201080900,
    distribution: 11.13,
    eclUpside: 1356165.78,
    eclBaseline: 2712331.57,
    eclDownside: 12594926.42,
    weightedEcl: 4294013.92,
  },
  {
    agingCategory: "PAR 240",
    count: 12700,
    loanBalance: 221941100,
    distribution: 12.27,
    eclUpside: 1560819.75,
    eclBaseline: 3121639.5,
    eclDownside: 14407377.74,
    weightedEcl: 4838541.22,
  },
  {
    agingCategory: "PAR 270",
    count: 13048,
    loanBalance: 223290500,
    distribution: 12.36,
    eclUpside: 1577387.38,
    eclBaseline: 3154774.75,
    eclDownside: 14519636.44,
    weightedEcl: 5138985.29,
  },
  {
    agingCategory: "PAR 300",
    count: 12365,
    loanBalance: 210866200,
    distribution: 11.68,
    eclUpside: 1656619.8,
    eclBaseline: 3313239.6,
    eclDownside: 15104578.18,
    weightedEcl: 5135251.37,
  },
  {
    agingCategory: "PAR 330",
    count: 5765,
    loanBalance: 93854600,
    distribution: 5.19,
    eclUpside: 791457.56,
    eclBaseline: 1582915.11,
    eclDownside: 7221180.08,
    weightedEcl: 2531543.42,
  },
  {
    agingCategory: "PAR 360",
    count: 76,
    loanBalance: 931700,
    distribution: 0.05,
    eclUpside: 9317,
    eclBaseline: 18634,
    eclDownside: 83853,
    weightedEcl: 28882.7,
  },
];

export default function Step3() {
  const reduxToken = useAppSelector((s) => s.auth.token);
  const token = reduxToken ?? undefined; // reserved for real API calls later
console.log(token)
  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Description */}
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm">
          <div className="flex gap-3">
            <div className="mt-0.5">
              <InformationCircleIcon className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-amber-900">
                Step 3 – Portfolio-Level ECL
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                This table summarizes the Expected Credit Loss by aging category
                at the portfolio level, including loan balance, distribution,
                scenario ECL, and the overall ECL rate.
              </p>
            </div>
          </div>
        </section>

        {/* Main table */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Portfolio ECL by Aging Category
              </h2>
              <p className="text-xs text-slate-500">
                Derived from the loan-level ECL computation in previous steps.
              </p>
            </div>
          </div>

          <AgingCategoryPortfolioEclTable rows={demoRows} overallEclRatePercent={2.13} />
        </section>
      </div>
    </div>
  );
}
