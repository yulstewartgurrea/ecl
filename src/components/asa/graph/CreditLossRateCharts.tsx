// src/components/asa/graph/CreditLossRateCharts.tsx
import React, { useMemo, useState, useRef } from "react";
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
function isMonotoneNonDecreasing(row: CreditLossRateRow) {
  let prev: number | null = null;
  for (const b of BUCKETS) {
    const raw = row[b.key as keyof CreditLossRateRow] as number | null | undefined;
    if (raw == null) continue;
    if (prev == null) {
      prev = raw;
      continue;
    }
    if (raw < prev) return false;
    prev = raw;
  }
  return true;
}

// ---------- Helpers ----------
const isRealMonth = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const safe = (n: number | null | undefined) => (isNum(n) ? n : 0);

function sortByDateAsc<T extends { date: string }>(arr: T[]) {
  return arr.slice().sort((a, b) => a.date.localeCompare(b.date));
}
function getBucketSeries(rows: CreditLossRateRow[], key: BucketKey) {
  // decimals domain (0..1), aligned with chart (nulls skipped)
  return sortByDateAsc(
    rows
      .filter((r) => isRealMonth(r.date))
      .map((r) => ({ date: r.date, val: (r as any)[key] as number | null }))
      .filter((x) => isNum(x.val))
  ) as { date: string; val: number }[];
}

// ---------- Weighted explainer (tab: "weighted") ----------
function buildWeightedSummary(rows: CreditLossRateRow[]) {
  const months = rows.filter((r) => isRealMonth(r.date));
  const monthsWithWeighted = months.filter((r) => isNum(r.weighted_loss_rate));

  if (!months.length) {
    return {
      title: "Quick take — Weighted",
      summary:
        "No monthly rows to summarize yet. Run Step 5 or select a workflow that has results.",
      details: [] as string[],
      actions: [] as string[],
    };
  }
  if (!monthsWithWeighted.length) {
    return {
      title: "Quick take — Weighted",
      summary:
        "There are monthly rows but none have a weighted credit-loss value. The weighted chart will look empty, so no average/peak can be computed.",
      details: [],
      actions: [
        "Check Step 5 output to ensure 'Weighted Credit Loss Rate per Month' is present.",
        "Verify the coercer maps the weighted value correctly.",
      ],
    };
  }

  const weights = monthsWithWeighted.map((r) => r.weighted_loss_rate as number); // decimals
  const avg = weights.reduce((a, b) => a + b, 0) / monthsWithWeighted.length; // decimal

  const peak = monthsWithWeighted.reduce((best, r) =>
    (r.weighted_loss_rate as number) > (best.weighted_loss_rate as number) ? r : best
  );

  // Largest three buckets (by decimal) for the *peak* month
  const peakBuckets = BUCKETS.map((b) => ({
    label: b.label,
    key: b.key,
    value: safe((peak as any)[b.key]),
  }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const spike = (peak.weighted_loss_rate as number) > Math.max(avg * 3, 0.005); // >3× avg or >0.5%
  const latePressure =
    safe((peak as any).par_240_360) >= 0.2 || safe((peak as any).par_360_plus) >= 0.2;

  const calmShare =
    (monthsWithWeighted.filter(
      (r) => (r.weighted_loss_rate as number) < Math.max(avg * 0.5, 0.002)
    ).length /
      monthsWithWeighted.length) *
    100;

  const summary =
    `Overall monthly loss risk averages ${fmtPct(avg * 100)}. ` +
    `It peaks at ${fmtPct((peak.weighted_loss_rate as number) * 100)} on ${peak.date}. ` +
    (spike
      ? "That peak is a pronounced spike versus the average. "
      : "The peak is close to the average (no major spike). ") +
    `About ${Math.round(calmShare)}% of months with data look calm (very low loss).`;

  const details = [
    `At the peak (${peak.date}), the largest buckets are ` +
      peakBuckets.map((b) => `${b.label} (${fmtPct(b.value * 100)})`).join(", ") +
      ".",
    latePressure
      ? "The spike is largely driven by <strong>very late</strong> accounts (240–360 or 360+)."
      : "The spike isn’t dominated by the very-late buckets; mid buckets contribute more.",
    "Blue cells/low lines mean low estimated loss; red cells/steep lines mean higher risk.",
  ];

  const actions = [
    "Drill into spike months: which product/branch/cohort drove them?",
    "Check roll-rates into 240–360 / 360+ and any policy changes around the spike.",
    "If the weighted line rises again, watch which bucket moves first.",
  ];

  return { title: "Quick take — Weighted", summary, details, actions };
}

// ---------- Bucket explainer (tab: "bucket") ----------
// function buildBucketSummary(
//   rows: CreditLossRateRow[],
//   bucket: BucketKey,
//   compareKeys: string[]
// ) {
//   const series = getBucketSeries(rows, bucket); // [{date,val}] decimals
//   if (!series.length) {
//     return {
//       title: `Quick take — Bucket ${BUCKETS.find((b) => b.key === bucket)?.label}`,
//       summary:
//         "No numeric values for this bucket yet. The bucket trend chart will look empty for this selection.",
//       details: [] as string[],
//       actions: [
//         "Ensure Step 5 produced roll-rates for this bucket.",
//         "Verify coercer mappings for bucket labels.",
//       ],
//     };
//   }

//   const avg = series.reduce((a, b) => a + b.val, 0) / series.length;
//   const peak = series.reduce((best, x) => (x.val > best.val ? x : best), series[0]);
//   const first = series[0];
//   const last = series[series.length - 1];
//   const delta = last.val - first.val; // simple slope
//   const trend =
//     Math.abs(delta) < Math.max(0.001, avg * 0.15)
//       ? "flat"
//       : delta > 0
//       ? "rising"
//       : "falling";

//   // Rank vs selected compare keys (use their averages)
//   const visKeys = compareKeys
//     .filter((k): k is BucketKey => BUCKETS.some((b) => b.key === k))
//     .filter((k) => k !== bucket);

//   const ranking = [
//     { key: bucket, label: BUCKETS.find((b) => b.key === bucket)?.label || "", avg },
//     ...visKeys.map((k) => {
//       const s = getBucketSeries(rows, k);
//       const a = s.length ? s.reduce((p, q) => p + q.val, 0) / s.length : 0;
//       return { key: k, label: BUCKETS.find((b) => b.key === k)?.label || "", avg: a };
//     }),
//   ]
//     .sort((a, b) => b.avg - a.avg)
//     .map((x, i) => ({ ...x, rank: i + 1 }));

//   const me = ranking.find((r) => r.key === bucket)!;

//   const summary =
//     `Bucket ${me.label} averages ${fmtPct(avg * 100)}, ` +
//     `peaking at ${fmtPct(peak.val * 100)} on ${peak.date}. ` +
//     `Recent direction looks <strong>${trend}</strong> (${fmtPct(delta * 100)} from first to last point). ` +
//     (ranking.length > 1
//       ? `Among selected buckets, it ranks #${me.rank} by average.`
//       : "No comparison buckets are selected.");

//   const details = [
//     ranking.length > 1
//       ? "Average ranking (highest to lowest): " +
//         ranking
//           .map((r) => `${r.label} (${fmtPct(r.avg * 100)})`)
//           .join(" → ")
//       : "Tip: tick a few buckets in Compare to see how this bucket stacks up.",
//   ];

//   const actions = [
//     "If rising, check what changed recently (collections, policy, mix).",
//     "If this bucket ranks high persistently, consider targeted actions for that delinquency band.",
//   ];

//   return {
//     title: `Quick take — Bucket ${me.label}`,
//     summary,
//     details,
//     actions,
//   };
// }

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
  const [showExplainer, setShowExplainer] = useState(true);
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

  const heatmapMinMax = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const r of rows) {
      for (const b of BUCKETS) {
        const v = toPct((r as any)[b.key]);
        if (v != null) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
    }
    if (!isFinite(min)) min = 0;
    if (!isFinite(max)) max = 0;
    return { min, max };
  }, [rows]);

  // ----- Explain only for the active tab
  const weightedExplainer = useMemo(() => buildWeightedSummary(rows), [rows]);
  // const bucketExplainer = useMemo(
  //   () => buildBucketSummary(rows, bucketKey, visibleBuckets),
  //   [rows, bucketKey, visibleBuckets]
  // );

  // function colorFor(v: number | null, min: number, max: number) {
  //   if (v == null) return "rgba(0,0,0,0.05)";
  //   const t = max === min ? 1 : (v - min) / (max - min); // 0..1
  //   const h = 220 - 220 * t; // blue -> red
  //   const l = 55;
  //   const s = 85;
  //   return `hsl(${h} ${s}% ${l}%)`;
  // }

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
