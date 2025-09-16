import type { ColumnNode } from "./MacroTable";

export type Frequency = "monthly";               // kept for your imports
export type ViewMode = "consolidated" | "transformations";

// ---------- helpers ----------
const leaf = (key: string, label?: string, align: ColumnNode["align"] = "right"): ColumnNode =>
  ({ key, header: label ?? key, align });

const unitRow = (label: string, children: ColumnNode[]): ColumnNode => ({
  header: label,
  className: "text-[11px]",
  children,
});

// ---------- DO NOT REMOVE: your constants ----------
export const BASE_METRICS: Array<{ top: string; key: string }> = [
  { top: "Gross domestic product - at constant 2018 prices", key: "gdp" },
  { top: "Gross national income - at constant 2018 prices", key: "gni" },
  { top: "Household final consumption expenditure - at constant 2018 prices", key: "household_cons" },
  { top: "Government final consumption expenditure - at constant 2018 prices", key: "government_cons" },
  { top: "Gross capital formation - at constant 2018 prices", key: "gross_cap_form" },
  { top: "Gross fixed capital formation - at constant 2018 prices", key: "fix_cap_form" },
  { top: "Exports of goods and services - at constant 2018 prices", key: "exports" },
  { top: "Imports of goods and services - at constant 2018 prices", key: "imports" },
  { top: "Gross National income and Gross Domestic Product : industry", key: "gni_gdp_industry" },
  { top: "Gross National income and Gross Domestic Product : industry (mining and quarrying)", key: "gni_gdp_mining" },
  { top: "Gross National income and Gross Domestic Product : industry (manufacturing)", key: "gni_gdp_manufacturing" },
  { top: "Gross National income and Gross Domestic Product : industry (Electricity, steam, water and waste management)", key: "gni_gdp_elec_steam_g" },
  { top: "Gross National income and Gross Domestic Product : (construction)", key: "gni_gdp_const" },
  { top: "Gross National income and Gross Domestic Product : (services)", key: "gni_gdp_services" },
  { top: "Gross National income and Gross Domestic Product : services (Wholesale and retail trade; repair of motor vehicles and motorcycles)", key: "gni_gdp_wholesale_retl" },
  { top: "Gross National income and Gross Domestic Product : services (transportation and storage)", key: "gni_gdp_transpo_stor" },
  { top: "Gross National income and Gross Domestic Product : services (Real estate and ownership of dwellings)", key: "gni_gdp_real_est" },
];

/** Inflation sub-indices (rates; monthly only) */
export const INFLATION_GROUPS: Array<{ top: string; key: string }> = [
  { top: "Inflation - All Items (2018 = 100)", key: "inflation" },
  { top: "Inflation - Food and Non-Alcoholic Beverages (2018 = 100)", key: "inf_food" },
  { top: "Inflation - Alcoholic Beverages and Tobacco (2018 = 100)", key: "inf_alc_bev_tob" },
  { top: "Inflation - Clothing and Footwear (2018 = 100)", key: "inf_cloth_footw" },
  { top: "Inflation - Housing, Water, Electricity, Gas, and other Fuels (2018 = 100)", key: "inf_hous_water_elec" },
  { top: "Inflation - Furnishing, Household Equipment and Routine Household Maintenance (2018 = 100)", key: "inf_furn_house_equip" },
  { top: "Inflation - Health (2018 = 100)", key: "inf_health" },
  { top: "Inflation - Transport (2018 = 100)", key: "inf_transport" },
  { top: "Inflation - Information and Communication (2018 = 100)", key: "inf_info_comm" },
  { top: "Inflation - Recreation, Sport and Culture (2018 = 100)", key: "inf_rec_sports_cul" },
  { top: "Inflation - Education Services (2018 = 100)", key: "inf_educ" },
  { top: "Inflation - Restaurants and Accommodation Services (2018 = 100)", key: "inf_rest_accoms" },
  { top: "Inflation - Personal Care, and Miscellaneous Goods and Services (2018 = 100)", key: "inf_pers_misc" },
  { top: "Core inflation", key: "core_inflation" },
];

/** FX & Interest rates block (monthly only) */
export const FX_RATE_GROUPS: Array<{ top: string; key: string; unit?: string }> = [
  { top: "Effective Exchange Rate Indices of the Philippine Peso - real (% growth rate (y-o-y))", key: "exch_rate_index_real_yoy", unit: "in levels (rates)" },
  { top: "Effective Exchange Rate Indices of the Philippine Peso - nominal (% growth rate (y-o-y))", key: "exch_rate_index_nom_yoy", unit: "in levels (rates)" },
  { top: "Philippine Peso per US Dollar Rate - End-of-Period", key: "usd_php_eop", unit: "in levels (index)" },
  { top: "Time deposit rate - all maturities", key: "time_depo_rate", unit: "in levels (rates)" },
  { top: "Savings Deposit Rate", key: "sav_depo_rate", unit: "in levels (rates)" },
  { top: "Bank Average Lending Rate", key: "bank_ave_lend_rate", unit: "in levels (rates)" },
  { top: "Lending Rate - High", key: "lend_rates_hi", unit: "in levels (rates)" },
  { top: "Lending Rate - Low", key: "lend_rates_lo", unit: "in levels (rates)" },
  { top: "Treasury bill rates - 91 days", key: "t_bill_91", unit: "in levels (rates)" },
];

// ---------- builders ----------

// Consolidated monthly MEV
export function buildConsolidatedMonthlyColumns(opts?: { growthSuffix?: string }): ColumnNode[] {
  const growthSuffix = opts?.growthSuffix ?? "_gr";

  const dateCols: ColumnNode[] = [
    { key: "year", header: "Year", width: "64px" },
    { key: "month_no", header: "Month", width: "64px" },
    { key: "month", header: "Month", width: "72px" },
    { key: "period_id", header: "ID", width: "96px" },
  ];

  const cols: ColumnNode[] = [{ header: "Date", children: dateCols }];

  for (const g of INFLATION_GROUPS) {
    cols.push({ header: g.top, children: [unitRow("in levels (rates)", [leaf(g.key, g.key, "right")])] });
  }

  for (const g of FX_RATE_GROUPS) {
    cols.push({ header: g.top, children: [unitRow(g.unit ?? "in levels", [leaf(g.key, g.key, "right")])] });
  }

  cols.push({
    header: "Unemployment rate",
    children: [unitRow("in levels (rates)", [leaf("unemp_rate", "unemp_rate", "right")])],
  });

  for (const m of BASE_METRICS) {
    cols.push({ header: m.top, children: [unitRow("in growth rates", [leaf(`${m.key}${growthSuffix}`, m.key, "right")])] });
  }

  return cols;
}

// Transformations — LEFT TABLE (MEVS)
export function buildTransformMEVColumns(): ColumnNode[] {
  return [
    { header: "MEVS", children: [{ header: "Date", children: [leaf("date_label", "Date", "left")] }] },
    {
      header: "Lag Transformation (e.g., 3 months)",
      children: [
        {
          header: "Inflation - All Items (2018 = 100)",
          children: [unitRow("in levels (rates)", [leaf("inflation_lag3", "inflation_lag3")])],
        },
      ],
    },
    {
      header: "Log Transformation",
      children: [
        {
          header: "Inflation - All Items (2018 = 100)",
          children: [unitRow("in levels (rates)", [leaf("inflation_ln", "inflation_ln")])],
        },
      ],
    },
    {
      header: "Year-on-Year Differencing Transformation",
      children: [
        {
          header: "Inflation - All Items (2018 = 100)",
          children: [unitRow("in levels (rates)", [leaf("inflation_diff", "inflation_diff")])],
        },
      ],
    },
  ];
}

// Transformations — RIGHT TABLE (Observed Default Rate)
export function buildTransformDefaultColumns(): ColumnNode[] {
  return [
    { header: "Observed Default Rate", children: [{ header: "Date", children: [leaf("date_eom", "Date", "left")] }] },
    { header: "Log Transformation", children: [leaf("default_rate_ln", "default_rate_ln")] },
  ];
}
