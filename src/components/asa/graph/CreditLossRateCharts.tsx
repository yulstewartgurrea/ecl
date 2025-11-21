// src/components/asa/graph/CreditLossRateCharts.tsx
import { useMemo, useState, useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

// 👇 Allows compiling even if you don't install html2canvas.
declare module "html2canvas";

export type CreditLossRateRow = {
  date: string; // e.g. "2025-08-31" or "Average"
  par_0_1: number | null;
  par_1_30: number | null;
  par_30_60: number | null;
  par_60_90: number | null;
  par_90_120: number | null;
  par_120_180: number | null;
  par_180_240: number | null;
  par_240_360: number | null;
  par_360_plus: number | null;
  weighted_loss_rate?: number | null;
};

type Props = {
  data: CreditLossRateRow[];
  title?: string;
  rateSets?: string[];
  selectedRateSet?: string;
  onChangeRateSet?: (v: string) => void;
  loading?: boolean;
  className?: string;
  enableExport?: boolean;
};

const BUCKETS = [
  { key: "par_0_1", label: "0→1" },
  { key: "par_1_30", label: "1→30" },
  { key: "par_30_60", label: "30→60" },
  { key: "par_60_90", label: "60→90" },
  { key: "par_90_120", label: "90→120" },
  { key: "par_120_180", label: "120→180" },
  { key: "par_180_240", label: "180→240" },
  { key: "par_240_360", label: "240→360" },
  { key: "par_360_plus", label: "360+" },
] as const;

type BucketKey = typeof BUCKETS[number]["key"];

function toPct(v: number | null | undefined) {
  if (v == null) return null;
  return v * 100;
}
function fmtPct(v: number | null | undefined, digits = 4) {
  if (v == null) return "—";
  return `${v.toFixed(v >= 1 ? 2 : digits)}%`;
}




export default function CreditLossRateCharts({
  data,
  title = "Credit Loss Rate – Charts",
  rateSets = ["Historical (avg of months)"],
  selectedRateSet,
  onChangeRateSet,
  loading,
  className = "",
  enableExport = false,
}: Props) {
  const [tab, setTab] = useState<"weighted" | "bucket" >("weighted");
  const [bucketKey, setBucketKey] = useState<BucketKey>("par_90_120");
  const [visibleBuckets, setVisibleBuckets] = useState<string[]>([
    "par_30_60",
    "par_60_90",
    "par_90_120",
  ]);
  const shotRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => data ?? [], [data]);

  // ----- Series for charts (null stays null so the chart behaves the same)
  const weightedSeries = useMemo(
    () =>
      rows.map((r) => ({
        date: r.date,
        weighted: toPct(r.weighted_loss_rate ?? null),
      })),
    [rows]
  );

  const multiBucketSeries = useMemo(() => {
    return rows.map((r) => {
      const o: any = { date: r.date };
      for (const b of BUCKETS) {
        o[b.key] = toPct((r as any)[b.key]);
      }
      return o;
    });
  }, [rows]);

  async function exportPNG() {
    if (!enableExport) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      if (!shotRef.current) return;
      const canvas = await html2canvas(shotRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `credit-loss-${tab}.png`;
      a.click();
    } catch {
      alert("To enable export, install html2canvas: npm i html2canvas");
    }
  }

  // Choose explainer by active tab
  // const activeExplainer =
  //   tab === "weighted" ? weightedExplainer : tab === "bucket" ? bucketExplainer : null;

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between bg-yellow-400 rounded-t-lg px-4 py-3 shadow-sm">
        <div>
          <div className="text-base font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-800 opacity-80 -mt-0.5">
            Values are decimals → rendered as percentages.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* {tab !== "heatmap" && (
            <button
              type="button"
              onClick={() => setShowExplainer((s) => !s)}
              className="rounded-md border border-black/10 bg-white text-xs px-2.5 py-1 shadow-sm hover:bg-gray-50"
              title="Toggle explanation"
            >
              {showExplainer ? "Hide" : "Explain"}
            </button>
          )} */}

          <label className="text-sm ml-2">Rate set:</label>
          <select
            className="text-sm rounded-md border border-black/10 bg-white px-3 py-1 shadow-sm focus:outline-none"
            value={selectedRateSet ?? rateSets[0]}
            onChange={(e) => onChangeRateSet?.(e.target.value)}
          >
            {rateSets.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {enableExport && (
            <button
              onClick={exportPNG}
              className="ml-2 rounded-md bg-yellow-600 hover:bg-yellow-700 text-white text-sm px-3 py-1.5"
              type="button"
              title="Export PNG"
            >
              Export PNG
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="border border-gray-200 border-t-0 rounded-b-lg">
        {/* Tab-scoped explainer */}


        {/* Tabs */}
        <div className="px-3 pt-3">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
            {[
              { id: "weighted", label: "Weighted" },
              { id: "bucket", label: "Bucket trend" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  tab === (t.id as any) ? "bg-yellow-500 text-white" : "hover:bg-gray-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="h-64 rounded-md bg-gray-100 animate-pulse" />
          ) : (
            <div ref={shotRef} className="w-full">
              {tab === "weighted" && (
                <div className="w-full h-[380px]">
                  <ResponsiveContainer>
                    <LineChart data={weightedSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} height={38} />
                      <YAxis tickFormatter={(v) => `${v}%`} width={60} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v: any) => fmtPct(v as number)}
                        labelFormatter={(l) => `Date: ${l}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="weighted"
                        name="Weighted credit loss / month"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {tab === "bucket" && (
                <div className="space-y-3">
                  {/* Controls */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Bucket:</span>
                      <select
                        value={bucketKey}
                        onChange={(e) => setBucketKey(e.target.value as BucketKey)}
                        className="text-sm rounded-md border border-gray-200 px-3 py-1"
                      >
                        {BUCKETS.map((b) => (
                          <option key={b.key} value={b.key}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600">Compare:</span>
                      {BUCKETS.map((b) => (
                        <label key={b.key} className="text-xs flex items-center gap-1">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={visibleBuckets.includes(b.key)}
                            onChange={(e) =>
                              setVisibleBuckets((prev) =>
                                e.target.checked
                                  ? Array.from(new Set([...prev, b.key]))
                                  : prev.filter((k) => k !== b.key)
                              )
                            }
                          />
                          {b.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Main chart */}
                  <div className="w-full h-[420px]">
                    <ResponsiveContainer>
                      <LineChart data={multiBucketSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} height={38} />
                        <YAxis tickFormatter={(v) => `${v}%`} width={60} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(v: any, name: any) => [fmtPct(v as number), name]}
                          labelFormatter={(l) => `Date: ${l}`}
                        />
                        <Legend />
                        {/* Primary selected bucket in thicker stroke */}
                        <Line
                          type="monotone"
                          dataKey={bucketKey}
                          name={`Bucket ${BUCKETS.find((b) => b.key === bucketKey)?.label}`}
                          dot={false}
                          strokeWidth={3}
                        />
                        {/* Optional multi-lines */}
                        {visibleBuckets
                          .filter((k) => k !== bucketKey)
                          .map((k) => (
                            <Line
                              key={k}
                              type="monotone"
                              dataKey={k}
                              name={`Bucket ${BUCKETS.find((b) => b.key === k)?.label}`}
                              dot={false}
                              strokeWidth={1.75}
                              strokeOpacity={0.9}
                            />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

            
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
