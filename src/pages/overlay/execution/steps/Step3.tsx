import { useMemo, useState } from "react";
import ExeTable from "../../../../components/overlay/data_transformation/table/ExeTable";
import type { Frequency, ViewMode } from "../../../../components/overlay/data_transformation/table/columns";

export default function OverlayExecutionPage3() {
  const [frequency] = useState<Frequency>("monthly");
  const [view, setView] = useState<ViewMode>("consolidated");

  // --- consolidated sample rows (keep your existing demo or real data) ---
  const consolidatedData = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => {
        const year = 2024;
        const monthNo = (i % 12) + 1;
        const monthName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i % 12];
        return {
          year,
          month_no: monthNo,
          month: monthName,
          period_id: `${year}-${String(monthNo).padStart(2, "0")}`,
          inflation: 3 + (i % 4) * 0.1,
          inf_food: 2.5 + (i % 5) * 0.1,
          inf_alc_bev_tob: 4 + (i % 5) * 0.2,
          inf_cloth_footw: 2 + (i % 5) * 0.1,
          inf_hous_water_elec: 4.5 + (i % 6) * 0.1,
          inf_furn_house_equip: 3 + (i % 5) * 0.1,
          inf_health: 3.4 + (i % 5) * 0.1,
          inf_transport: 5 + (i % 5) * 0.2,
          inf_info_comm: 0.6 + (i % 5) * 0.05,
          inf_rec_sports_cul: 3.5 + (i % 5) * 0.2,
          inf_educ: 5 + (i % 5) * 0.2,
          inf_rest_accoms: 4 + (i % 5) * 0.2,
          inf_pers_misc: 2.8 + (i % 5) * 0.1,
          core_inflation: 3.6 + (i % 5) * 0.1,
          exch_rate_index_real_yoy: 0.01 * (i % 10),
          exch_rate_index_nom_yoy: 0.01 * ((i + 2) % 10),
          usd_php_eop: 42 + i * 0.1,
          time_depo_rate: 2.5 + (i % 5) * 0.1,
          sav_depo_rate: 1.2 + (i % 5) * 0.1,
          bank_ave_lend_rate: 5.8 + (i % 5) * 0.1,
          lend_rates_hi: 7.6 + (i % 5) * 0.1,
          lend_rates_lo: 5.5 + (i % 5) * 0.1,
          t_bill_91: 1.6 + (i % 5) * 0.1,
          unemp_rate: (6.9 - i * 0.03).toFixed(2) + "%",
          gdp_gr: 0.25 + (i % 5) * 0.01,
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
      }),
    []
  );

  // --- transformations data: two datasets (LEFT + RIGHT tables) ---
  const { mevData, defaultData } = useMemo(() => {
    const N = 36;
    const startYear = 2012;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const infPct = Array.from({ length: N }, (_, i) => 3 + (i % 12) * 0.1); // %
    const defRate = Array.from({ length: N }, (_, i) => 0.012 + (i % 10) * 0.001); // fraction

    const mev = Array.from({ length: N }, (_, i) => {
      const y = startYear + Math.floor(i / 12);
      const m = (i % 12) + 1;
      const lag3 = i >= 3 ? infPct[i - 3] : null;
      const yoy = i >= 12 ? infPct[i] - infPct[i - 12] : null;
      const infLn = Math.log(Math.max(1e-9, infPct[i] / 100));
      return {
        date_label: `${y}-${months[m - 1]}`,
        period_id: `${y}-${String(m).padStart(2, "0")}`,
        inflation_lag3: lag3 == null ? "" : `${lag3.toFixed(2)}%`,
        inflation_ln: isFinite(infLn) ? infLn.toFixed(4) : "",
        inflation_diff: yoy == null ? "" : `${yoy.toFixed(2)}%`,
      };
    });

    // make 24 rows of default data (Jan 2021 .. Dec 2022)
    const def: Array<Record<string, any>> = [];
    for (let y = 2021; y <= 2022; y++) {
      for (let m = 1; m <= 12; m++) {
        const i = (y - 2021) * 12 + (m - 1);
        const ln = Math.log(Math.max(1e-9, defRate[i % defRate.length]));
        const mm = String(m).padStart(2, "0");
        const lastDay = new Date(y, m, 0).getDate(); // end-of-month
        def.push({
          date_eom: `${mm}/${lastDay}/${y}`, // 01/31/2021 style
          default_rate_ln: ln.toFixed(4),
        });
      }
    }
    return { mevData: mev, defaultData: def };
  }, []);

  const data = consolidatedData;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white border-b">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Consolidate all monthly MEVs
            </h1>
            <p className="text-sm text-gray-600">
              Apply appropriate data transformations—such as lagging, logarithmic scaling, differencing, and other transformations—to MEVs and apply logarithmic scaling to default rate data
            </p>
          </div>
        </div>
      </header>

      {/* view buttons */}
      <div className="mx-auto px-4 py-4">
        <div className="inline-flex rounded-2xl bg-gray-100 p-1 shadow-inner">
          <button
            onClick={() => setView("consolidated")}
            className={[
              "px-4 py-2 text-sm font-medium rounded-xl transition",
              view === "consolidated" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
            ].join(" ")}
          >
            Consolidated Monthly MEV
          </button>
          <button
            onClick={() => setView("transformations")}
            className={[
              "px-4 py-2 text-sm font-medium rounded-xl transition",
              view === "transformations" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
            ].join(" ")}
          >
            Transformations
          </button>
        </div>
      </div>

      {/* table(s) */}
      <main className="mx-auto px-4 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3">
          <ExeTable
            frequency={frequency}
            view={view}
            data={data}
            mevData={mevData}
            defaultData={defaultData}
            caption={view === "consolidated" ? "Consolidated monthly MEVs" : undefined}
            growthSuffix="_gr"
          />
        </div>
      </main>
    </div>
  );
}
