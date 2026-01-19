import type { ColumnNode } from "./MacroTable";

export type Frequency = "quarterly" | "monthly";

export type BuildOptions = {
  includeQuarterInMonthly?: boolean; // default: false
  growthSuffix?: string;             // default: "_gr"
  data?: Array<Record<string, any>>; // Optional: data to build columns from
};

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

  // 🔧 Keep only keys that actually exist in your API response:
  { top: "Gross National income and Gross Domestic Product : industry (manufacturing)", key: "gni_gdp_manufacturing" },
  { top: "Gross National income and Gross Domestic Product : (construction)", key: "gni_gdp_constr" },            // <- was const
  { top: "Gross National income and Gross Domestic Product : services (Wholesale and retail trade; repair of motor vehicles and motorcycles)", key: "gni_gdp_wholesale_ret" }, // <- was wholesale_retl
  { top: "Gross National income and Gross Domestic Product : services (Real estate and ownership of dwellings)", key: "gni_gdp_real_est" },
];

/** Build dynamic multi-row header columns for either quarterly or monthly */
export function buildMacroColumns(
  frequency: Frequency,
  opts: BuildOptions = {}
): ColumnNode[] {
  const includeQuarter =
    frequency === "quarterly" ? true : !!opts.includeQuarterInMonthly;
  // const growthSuffix = opts.growthSuffix ?? "_gr"; // you pass " growth_rate"

  // If data is provided, build columns dynamically from all keys
  if (opts.data && opts.data.length > 0) {
    const firstRow = opts.data[0];
    const allKeys = Object.keys(firstRow);
    
    // Exclude date/metadata columns that will be in the Date group
    const excludeKeys = new Set([
      "Date", "year", "month (int)", "month", "quarter", "id", "period_id", "x"
    ]);
    
    const dataKeys = allKeys.filter(key => !excludeKeys.has(key));
    
    const dateChildren: ColumnNode[] = [
      { key: "Date", header: "Date", width: "100px" },
      { key: "year", header: "Year", width: "64px" },
      ...(includeQuarter ? [{ key: "quarter", header: "Quarter", width: "72px" }] : []),
      { key: "month (int)", header: "Month (int)", width: "80px" },
      { key: "month", header: "Month", width: "72px" },
      { key: "id", header: "ID", width: "96px" },
      { key: "period_id", header: "Period ID", width: "96px" },
      { key: "x", header: "x", width: "48px" },
    ].filter(col => {
      // Only include if the key exists in the data
      return firstRow.hasOwnProperty(col.key!);
    });

    // Build columns for all data keys
    const dataColumns: ColumnNode[] = dataKeys.map(key => 
      leaf(key, key, "right", "120px")
    );

    return [
      { header: "Date", children: dateChildren },
      ...dataColumns
    ];
  }

  // Fallback to original logic if no data provided
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
      // Use "<metric>.Point Forecast" to match API response
      ...BASE_METRICS.map(m =>
        metricGroup(
          m.top,
          `${m.key}.Point Forecast`,                   // 🔑 matches "gdp.Point Forecast", "gni.Point Forecast", ...
          "In levels (million PHP)",
          m.key
        )
      ),
      {
        header: "Unemployment rate",
        children: [
          {
            header: "In levels (rates)",
            className: "text-[11px]",
            children: [leaf("unemp_rate.Point Forecast", "unemp_rate", "right")], // 🔑 matches "unemp_rate.Point Forecast"
          },
        ],
      },
    ];
  }

  // ----- MONTHLY: Levels + Growth Rates (extra columns) -----
  const monthlyColumns: ColumnNode[] = [{ header: "Date", children: dateChildren }];

  // Levels (Point Forecast)
  for (const m of BASE_METRICS) {
    monthlyColumns.push(
      metricGroup(
        m.top,
        `${m.key}.Point Forecast`,                     // 🔑 "gdp.Point Forecast", etc.
        "In levels (million PHP)",
        m.key
      )
    );
  }
  monthlyColumns.push({
    header: "Unemployment rate",
    children: [
      {
        header: "In levels (rates)",
        className: "text-[11px]",
        children: [leaf("unemp_rate.Point Forecast", "unemp_rate", "right")],
      },
    ],
  });

  // Growth rates – use "<metric>_growth_12m.Point Forecast"
  for (const m of BASE_METRICS) {
    monthlyColumns.push(
      metricGroup(
        m.top,
        `${m.key}_growth_12m.Point Forecast`,      // 🔑 "gdp_growth_12m.Point Forecast"
        "in growth rates",
        m.key
      )
    );
  }

  // Unemployment growth_rate
  monthlyColumns.push({
    header: "Unemployment rate (growth)",
    children: [
      {
        header: "in growth rates",
        className: "text-[11px]",
        children: [leaf("unemp_rate_growth_12m.Point Forecast", "unemp_rate", "right")],
      },
    ],
  });

  return monthlyColumns;
}
