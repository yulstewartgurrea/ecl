import type { ScenarioRow } from "./ConfigModal";

type Props = {
  rows: ScenarioRow[];
  variables: string[];
};

export default function ForecastedMEVDynamicTable({ rows, variables }: Props) {
  // Format numeric values to 2 decimal places
  const formatValue = (val: string | number | undefined | null): string => {
    if (val === null || val === undefined || val === "") return "—";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    return num.toFixed(2);
  };

  return (
    <div className="overflow-x-auto rounded-2xl border-[#f8c300] bg-white">
      <table className="min-w-[960px] w-full text-sm">
        <thead>
          <tr className="bg-[#f8c300] text-black">
            <th className="px-3 py-2 text-left w-52">Period</th>
            <th colSpan={variables.length} className="px-3 py-2 text-center">Upside</th>
            <th colSpan={variables.length} className="px-3 py-2 text-center">Base</th>
            <th colSpan={variables.length} className="px-3 py-2 text-center">Downside</th>
          </tr>
          <tr className="bg-gray-700 text-white text-black/90 text-xs">
            <th className="px-3 py-1 text-left"> </th>
            {[...Array(3)].flatMap((_, i) =>
              variables.map((v) => (
                <th key={`${i}-${v}`} className="px-3 py-1 text-center">
                  {v}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.period} className={idx % 2 ? "bg-white" : "bg-gray-50/60"}>
              <td className="px-3 py-2 font-medium">{r.period}</td>

              {variables.map((v) => (
                <td key={`upside-${v}-${idx}`} className="px-3 py-2 text-center bg-emerald-50">
                  {formatValue(r.upside[v])}
                </td>
              ))}
              {variables.map((v) => (
                <td key={`base-${v}-${idx}`} className="px-3 py-2 text-center bg-amber-50">
                  {formatValue(r.base[v])}
                </td>
              ))}
              {variables.map((v) => (
                <td key={`worst-${v}-${idx}`} className="px-3 py-2 text-center bg-rose-50">
                  {formatValue(r.downside[v])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}