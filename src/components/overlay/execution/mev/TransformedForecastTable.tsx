// src/components/overlay/execution/mev/TransformedForecastTable.tsx
import { useMemo } from "react";
import type { ScenarioRow } from "./ConfigModal";

type Props = {
  rows: ScenarioRow[];      // last-saved (already posted)
  variables: string[];      // from override GET
};

const SCENARIOS = [
  { key: "best" as const,  label: "Best",  bg: "bg-emerald-50" },
  { key: "base" as const,  label: "Base",  bg: "bg-amber-50"  },
  { key: "worst" as const, label: "Worst", bg: "bg-rose-50"   },
];

// Decide display name per variable (match screenshot style)
const colName = (v: string) => {
  const vn = v.toLowerCase();
  if (vn.includes("unemp")) return `${v}.ln.lag_6`;
  return `${v}.lag_6`;
};

// Convert "56%" -> 0.56 and apply simple transform rules to match sample:
// - unemp* => ln(value_as_decimal)
// - others => decimal fraction
const parsePct = (s: string) => {
  const n = parseFloat(String(s).replace(/[^\d.-]/g, ""));
  if (isNaN(n)) return null;
  return n / 100;
};
const transformVal = (v: string, raw: string) => {
  const dec = parsePct(raw);
  if (dec == null) return null;
  if (v.toLowerCase().includes("unemp")) return Math.log(dec); // ln
  return dec;                                                  // plain fraction
};

export default function TransformedForecastTable({ rows, variables }: Props) {
  const headers = useMemo(() => variables.map(colName), [variables]);

  return (
    <section className="mt-8">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">
        Transformed macroeconomic variables and forecasts
      </h3>

      <div className="overflow-x-auto rounded-2xl bg-white">
        <table className="min-w-[960px] w-full text-sm">
          <thead>
            {/* Row 1: Scenario group labels */}
            <tr className="bg-[#f8c300] text-black">
              <th className="px-3 py-2 text-left w-40"></th>
              {SCENARIOS.map((s) => (
                <th key={s.key} className={`px-3 py-1 text-center text-xs`} colSpan={variables.length}>
                  {s.label}
                </th>
              ))}
            </tr>
            {/* Row 2: Variable names under each scenario */}
            <tr className="bg-[#f8c300] text-black/95">
              <th className="px-3 py-1 text-left text-xs"> </th>
              {SCENARIOS.flatMap((s) =>
                headers.map((h) => (
                  <th key={`${s.key}-${h}`} className={` px-3 py-1 text-center text-xs`}>
                    {h}
                  </th>
                ))
              )}
            </tr>
            {/* Row 3: “Point” band (yellow) */}
            <tr className="bg-[#f8cc10] text-black/90">
              <th className="px-3 py-1 text-center text-xs">Point</th>
              {SCENARIOS.flatMap((s) =>
                variables.map((v) => (
                  <th key={`pt-${s.key}-${v}`} className={` px-3 py-1 text-center text-xs`}>
                    Point
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, i) => (
              <tr key={r.period} className={i % 2 ? "bg-white" : "bg-gray-50/60"}>
                <td className="px-3 py-2 font-medium">{r.period}</td>

                {SCENARIOS.flatMap((s) =>
                  variables.map((v) => {
                    const raw = (r as any)[s.key][v] ?? "";
                    const tv = transformVal(v, raw);
                    const isLn = colName(v).includes(".ln.");
                    return (
                      <td
                        key={`${r.period}-${s.key}-${v}`}
                        className={`px-3 py-2 text-right tabular-nums ${s.bg}`}
                      >
                        {tv == null ? "—" : isLn ? tv.toFixed(2) : tv.toFixed(4)}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}