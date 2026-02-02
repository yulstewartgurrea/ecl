import type { ColumnNode } from "./MacroTable";

export type Frequency = "quarterly" | "monthly";

export type BuildOptions = {
  includeQuarterInMonthly?: boolean; // default: false
  growthSuffix?: string;             // default: "_gr"
};

const isNumericValue = (v: any) => {
  if (v == null || v === "") return false;
  if (typeof v === "number") return Number.isFinite(v);
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n);
};

function pickSampleValue(rows: Array<Record<string, any>>, key: string) {
  for (const r of rows) {
    if (!r || !(key in r)) continue;
    const v = (r as any)[key];
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return undefined;
}

/** Build simple columns directly from backend data (no extra headers). */
export function buildColumnsFromRows(
  rows: Array<Record<string, any>>
): ColumnNode[] {
  if (!rows || rows.length === 0) return [];
  const keys = new Set<string>();
  for (const r of rows) {
    Object.keys(r || {}).forEach((k) => keys.add(k));
  }

  const preferred = ["year", "quarter", "month", "period_id", "x"];
  const preferredKeys = preferred.filter((k) => keys.has(k));
  const rest = Array.from(keys)
    .filter((k) => !preferred.includes(k))
    .sort((a, b) => a.localeCompare(b));

  const ordered = [...preferredKeys, ...rest];

  return ordered.map((key) => {
    const sample = pickSampleValue(rows, key);
    return {
      key,
      header: key,
      align: isNumericValue(sample) ? "right" : "left",
    };
  });
}

const leaf = (
  key: string,
  label?: string,
  align: ColumnNode["align"] = "right",
  width?: string
): ColumnNode => ({ key, header: label ?? key, align, width });

/** Single header group with one unit row and one leaf */
const metricGroup = (
  top: string,
  leafKey: string,
  unit = "In levels (million PHP)",
  label?: string
): ColumnNode => ({
  header: top,
  children: [
    {
      header: unit,
      className: "text-[11px]",
      children: [leaf(leafKey, label ?? leafKey, "right")],
    },
  ],
});

/** Base metrics shared by quarterly & monthly (levels) */
const BASE_METRICS: Array<{ top: string; key: string }> = [
  { top: "Gross domestic product - at constant 2018 prices", key: "gdp" },
  { top: "Gross national income - at constant 2018 prices", key: "gni" },
  {
    top: "Household final consumption expenditure - at constant 2018 prices",
    key: "household_cons",
  },
  {
    top: "Government final consumption expenditure - at constant 2018 prices",
    key: "government_cons",
  },
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

/** Build dynamic multi-row header columns for either quarterly or monthly */
export function buildMacroColumns(
  frequency: Frequency,
  opts: BuildOptions = {}
): ColumnNode[] {
  const includeQuarter =
    frequency === "quarterly" ? true : !!opts.includeQuarterInMonthly;
  const growthSuffix = opts.growthSuffix ?? "_gr";

  const dateChildren: ColumnNode[] = [
    { key: "year", header: "Year", width: "64px" },
    ...(includeQuarter ? [{ key: "quarter", header: "Quarter", width: "72px" }] : []),
    { key: "month", header: "Month", width: "72px" },
    { key: "period_id", header: "ID", width: "96px" },
    { key: "x", header: "x", width: "48px" },
  ];

  // ----- QUARTERLY: Levels only -----
  if (frequency === "quarterly") {
    return [
      { header: "Date", children: dateChildren },
      ...BASE_METRICS.map(m => metricGroup(m.top, m.key, "In levels (million PHP)")),
      {
        header: "Unemployment rate",
        children: [
          {
            header: "In levels (rates)",
            className: "text-[11px]",
            children: [leaf("unemp_rate", "unemp_rate", "right")],
          },
        ],
      },
    ];
  }

  // ----- MONTHLY: Levels + Growth Rates (extra columns) -----
  const monthlyColumns: ColumnNode[] = [{ header: "Date", children: dateChildren }];

  // Levels (same as quarterly)
  for (const m of BASE_METRICS) {
    monthlyColumns.push(metricGroup(m.top, m.key, "In levels (million PHP)"));
  }
  monthlyColumns.push({
    header: "Unemployment rate",
    children: [
      { header: "In levels (rates)", className: "text-[11px]", children: [leaf("unemp_rate", "unemp_rate", "right")] },
    ],
  });

  // EXTRA: Growth rates copy of each base metric
  for (const m of BASE_METRICS) {
    monthlyColumns.push(
      metricGroup(m.top, `${m.key}${growthSuffix}`, "in growth rates", m.key)
    );
  }
  // (Add a growth-rate unemployment column here if you actually have it)

  return monthlyColumns;
}