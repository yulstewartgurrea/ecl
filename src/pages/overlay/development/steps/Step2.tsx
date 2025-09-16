import { useMemo, useState } from "react";
import ExeTable from "../../../../components/overlay/interpolation/table/ExeTable";
import type { Frequency } from "../../../../components/overlay/interpolation/table/Columns";
import { ProcessModal } from "../../../../components/ProcessModal";

export default function OverlayDevelopmentPage2() {
  const [open, setOpen] = useState(true);
  const [frequency, setFrequency] = useState<Frequency>("monthly");

  // === SAMPLE DATA (replace with API data) ===

  const monthlyData = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => {
        const year = 2024 + Math.floor(i / 12);
        const monthName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i % 12];
        const base = 3_100_000 + i * 2_500;

        const row: Record<string, any> = {
          year,
          month: monthName,
          period_id: `${year}-${String((i % 12) + 1).padStart(2, "0")}`,
          x: (i + 1) / 12,

          // levels
          gdp: base,
          gni: base + 300_000,
          household_cons: base - 800_000,
          government_cons: 360_000 + i * 300,
          gross_cap_form: 480_000 + i * 280,
          fix_cap_form: 545_000 + i * 250,
          exports: 780_000 + i * 600,
          imports: 990_000 + i * 650,
          gni_gdp_industry: 890_000 + i * 700,
          gni_gdp_mining: 34_000 + i * 20,
          gni_gdp_manufacturing: 620_000 + i * 500,
          gni_gdp_elec_steam_g: 93_000 + i * 40,
          gni_gdp_const: 138_000 + i * 55,
          gni_gdp_services: 1_640_000 + i * 900,
          gni_gdp_wholesale_retl: 472_000 + i * 300,
          gni_gdp_transpo_stor: 103_000 + i * 200,
          gni_gdp_real_est: 196_000 + i * 150,
          unemp_rate: (6.9 - i * 0.03).toFixed(2) + "%",

          // growth (monthly extras) — MoM placeholders
          gdp_gr: 0.2 + (i % 5) * 0.01,
          gni_gr: 0.18 + (i % 5) * 0.01,
          household_cons_gr: 0.12 + (i % 5) * 0.01,
          government_cons_gr: 0.05 + (i % 5) * 0.005,
          gross_cap_form_gr: 0.09 + (i % 5) * 0.005,
          fix_cap_form_gr: 0.07 + (i % 5) * 0.005,
          exports_gr: 0.14 + (i % 5) * 0.01,
          imports_gr: 0.11 + (i % 5) * 0.01,
          gni_gdp_industry_gr: 0.13 + (i % 5) * 0.01,
          gni_gdp_mining_gr: 0.02 + (i % 5) * 0.005,
          gni_gdp_manufacturing_gr: 0.10 + (i % 5) * 0.01,
          gni_gdp_elec_steam_g_gr: 0.03 + (i % 5) * 0.005,
          gni_gdp_const_gr: 0.04 + (i % 5) * 0.005,
          gni_gdp_services_gr: 0.12 + (i % 5) * 0.01,
          gni_gdp_wholesale_retl_gr: 0.08 + (i % 5) * 0.01,
          gni_gdp_transpo_stor_gr: 0.06 + (i % 5) * 0.01,
          gni_gdp_real_est_gr: 0.05 + (i % 5) * 0.01,
        };

        return row;
      }),
    []
  );

  const quarterlyData = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        year: 2022 + Math.floor(i / 4),
        quarter: (i % 4) + 1,
        month: ["Mar", "Jun", "Sep", "Dec"][i % 4],
        period_id: `${2022 + Math.floor(i / 4)}-${["Mar","Jun","Sep","Dec"][i % 4]}`,
        x: (i + 1) / 10,

        // levels (same fields as monthly levels)
        gdp: 2_908_989.08 + i * 10_000,
        gni: 3_220_989.43 + i * 9_500,
        household_cons: 2_168_389.99 + i * 7_300,
        government_cons: 352_314.62 + i * 1_200,
        gross_cap_form: 471_104.52 + i * 1_100,
        fix_cap_form: 536_233.39 + i * 1_050,
        exports: 773_802.18 + i * 2_000,
        imports: 995_463.98 + i * 2_200,
        gni_gdp_industry: 879_304.91 + i * 3_100,
        gni_gdp_mining: 33_678.77 + i * 200,
        gni_gdp_manufacturing: 610_336.02 + i * 2_000,
        gni_gdp_elec_steam_g: 92_765.41 + i * 150,
        gni_gdp_const: 135_960.73 + i * 300,
        gni_gdp_services: 1_636_802.9 + i * 4_500,
        gni_gdp_wholesale_retl: 469_777.18 + i * 1_200,
        gni_gdp_transpo_stor: 102_129.41 + i * 900,
        gni_gdp_real_est: 194_821.93 + i * 700,
        unemp_rate: (7.2 - i * 0.1).toFixed(2) + "%",
      })),
    []
  );


  const data: Array<Record<string, any>> =
    frequency === "monthly" ? monthlyData : quarterlyData;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className=" backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white border-b">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Expected Credit Loss Automation
            </h1>
            <p className="text-sm text-gray-600">
              Interpolate quarterly MEVs (Quarterly Historical Mevs) into monthly data to match default rate frequency
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              View Process
            </button>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="rounded-xl bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-black"
            >
              Export CSV
            </a>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Segmented control */}
          <div className="inline-flex rounded-2xl bg-gray-100 p-1 shadow-inner w-fit">
            {(["monthly", "quarterly"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={[
                  "px-4 py-2 text-sm font-medium rounded-xl transition",
                  frequency === f
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                ].join(" ")}
                aria-pressed={frequency === f}
              >
                {f === "monthly" ? "Monthly" : "Quarterly"}
              </button>
            ))}
          </div>

          {/* <div className="md:ml-auto flex items-center gap-2">
            <input
              type="search"
              placeholder="Quick filter…"
              className="h-10 w-56 rounded-xl border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              //onChange={() => { }
            />
          </div> */}
        </div>
      </div>

      {/* Data card */}
      <main className="mx-auto px-4 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{frequency}</span> dataset • {data.length.toLocaleString()} rows
            </div>
            <div className="text-xs text-gray-500">Sticky header • Scroll horizontally</div>
          </div>
          <div className="p-3">
            <ExeTable
              frequency={frequency}
              data={data}
              caption={frequency === "monthly" ? "Monthly Data" : "Quarterly Data"}
              includeQuarterInMonthly={false}
              // growthSuffix="_growth_rate" // uncomment if your keys use a different suffix
            />
          </div>
        </div>
      </main>

      <ProcessModal
        open={open}
        onClose={() => setOpen(false)}
        heading="OVERLAY MODEL DEVELOPMENT"
        steps={[
          "Interpolate quarterly MEVs into monthly data to match default rate frequency",
          "Apply statistical transformations: lagging, logarithmic scaling, differencing, etc.",
          "Generate forecasts of economic variables using ARIMA or other time series models.",
          "Narrow down models based on statistical performance, business relevance, and logical relationship with default.",
          "Select a model for validation and endorsement to committee and management.",
        ]}
      />
    </div>
  );
}
