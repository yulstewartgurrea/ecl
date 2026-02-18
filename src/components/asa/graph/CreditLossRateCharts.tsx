import { useMemo, useState, useRef, useEffect } from "react";
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

/**
 * If you DON'T install html2canvas, keep this so TS compiles.
 * If you DO install it, you can delete this block.
 */

export type CreditLossRateAnyRow = Record<string, any>;

type Props = {
  data: CreditLossRateAnyRow[];

  title?: string;
  rateSets?: string[];
  selectedRateSet?: string;
  onChangeRateSet?: (v: string) => void;
  loading?: boolean;
  className?: string;
  enableExport?: boolean;

  dateKeyCandidates?: string[];
  weightedKeyCandidates?: string[];
  excludeKeyCandidates?: string[];
};

const clean = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, "").trim();

const SERIES_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

function colorForKey(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % SERIES_COLORS.length;
  return SERIES_COLORS[idx];
}

function pickKey(keys: string[], candidates: string[]) {
  for (const cand of candidates) {
    const c = clean(cand);
    const found = keys.find((k) => clean(k) === c);
    if (found) return found;
  }
  for (const cand of candidates) {
    const c = clean(cand);
    const found = keys.find((k) => clean(k).includes(c));
    if (found) return found;
  }
  return undefined;
}

function toFraction(v: any): number | null {
  if (v === null || v === undefined || v === "" || v === "-") return 0;
  if (typeof v === "string" && v.trim().toUpperCase() === "#N/A") return null;

  if (typeof v === "number") {
    if (!Number.isFinite(v)) return 0;
    if (Math.abs(v) > 1.5) return v / 100;
    return v;
  }

  const raw = String(v).replace(/,/g, "").trim();
  if (!raw) return 0;
  if (raw.toUpperCase() === "#DIV/0!") return 0;
  if (raw.toUpperCase() === "#N/A") return null;

  const hasPct = raw.endsWith("%");
  const numStr = hasPct ? raw.slice(0, -1) : raw;
  const n = Number(numStr);
  if (!Number.isFinite(n)) return 0;

  if (hasPct) return n / 100;
  if (Math.abs(n) > 1.5) return n / 100;
  return n;
}

function toPct(v: number | null | undefined) {
  if (v == null) return null;
  return v * 100;
}

function fmtPct(v: number | null | undefined, digits = 4) {
  if (v == null) return "—";
  return `${v.toFixed(v >= 1 ? 2 : digits)}%`;
}

function labelFromKey(k: string) {
  const m = k.match(/(\d+)\D+(\d+)/);
  if (m) return `${m[1]}→${m[2]}`;
  return k;
}

function bucketSort(a: string, b: string) {
  const na = Number(a.match(/(\d+(\.\d+)?)/)?.[1] ?? "NaN");
  const nb = Number(b.match(/(\d+(\.\d+)?)/)?.[1] ?? "NaN");
  const aHas = Number.isFinite(na);
  const bHas = Number.isFinite(nb);
  if (aHas && bHas) return na - nb;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  return clean(a).localeCompare(clean(b));
}

function deriveSchema(rows: CreditLossRateAnyRow[], opts?: Partial<Props>) {
  const set = new Set<string>();
  (rows ?? []).forEach((r) => {
    Object.keys(r || {}).forEach((k) => set.add(k));
  });
  const keys = Array.from(set);

  const dateKey = pickKey(
    keys,
    opts?.dateKeyCandidates ?? [
      "date",
      "Date",
      "report_date",
      "Report Date",
      "month",
      "period",
    ],
  );

  const weightedKey = pickKey(
    keys,
    opts?.weightedKeyCandidates ?? [
      "Weighted Credit Loss Rate per Month",
      "weighted credit loss rate per month",
      "weighted_loss_rate",
      "weighted",
      "weighted_rate",
    ],
  );

  const monotonicKey = pickKey(keys, ["Monotonic?", "monotonic", "Monotonic"]);

  const extraExclude = (opts?.excludeKeyCandidates ?? []).map(clean);

  const excludeSet = new Set<string>();
  [dateKey, weightedKey, monotonicKey]
    .filter(Boolean)
    .forEach((k) => excludeSet.add(String(k)));

  const bucketKeys = keys
    .filter((k) => !excludeSet.has(k))
    .filter((k) => !extraExclude.includes(clean(k)));

  bucketKeys.sort(bucketSort);

  return { dateKey, weightedKey, monotonicKey, bucketKeys };
}

export default function CreditLossRateCharts({
  data,
  title = "Credit Loss Rate – Charts",
  rateSets = [],
  selectedRateSet,
  onChangeRateSet,
  loading,
  className = "",
  enableExport = false,
  dateKeyCandidates,
  weightedKeyCandidates,
  excludeKeyCandidates,
}: Props) {
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const schema = useMemo(
    () =>
      deriveSchema(rows, {
        dateKeyCandidates,
        weightedKeyCandidates,
        excludeKeyCandidates,
      }),
    [rows, dateKeyCandidates, weightedKeyCandidates, excludeKeyCandidates],
  );

  const filteredRows = useMemo(() => {
    const dk = schema.dateKey;
    if (!dk) return rows;
    return rows.filter((r) => {
      const raw = r?.[dk];
      if (raw == null) return true;
      const val = String(raw).trim().toLowerCase();
      return val !== "average" && val !== "avg";
    });
  }, [rows, schema.dateKey]);

  const [tab, setTab] = useState<"weighted" | "bucket">("weighted");
  const [bucketKey, setBucketKey] = useState<string>("");
  const [visibleBuckets, setVisibleBuckets] = useState<string[]>([]);
  const shotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schema.bucketKeys.length) {
      setBucketKey("");
      setVisibleBuckets([]);
      return;
    }
    setBucketKey((prev) =>
      prev && schema.bucketKeys.includes(prev) ? prev : schema.bucketKeys[0],
    );
    setVisibleBuckets((prev) => {
      const keep = prev.filter((k) => schema.bucketKeys.includes(k));
      if (keep.length) return keep;
      return schema.bucketKeys.slice(0, 3);
    });
  }, [schema.bucketKeys]);

  const weightedSeries = useMemo(() => {
    const wk = schema.weightedKey;
    const dk = schema.dateKey;

    if (!wk) return [];
    return filteredRows.map((r) => ({
      date: dk ? String(r?.[dk] ?? "") : "",
      weighted: toPct(toFraction(r?.[wk])),
    }));
  }, [filteredRows, schema.dateKey, schema.weightedKey]);

  const multiBucketSeries = useMemo(() => {
    const dk = schema.dateKey;

    if (!schema.bucketKeys.length) return [];
    return filteredRows.map((r) => {
      const o: any = { date: dk ? String(r?.[dk] ?? "") : "" };
      for (const k of schema.bucketKeys) {
        o[k] = toPct(toFraction(r?.[k]));
      }
      return o;
    });
  }, [filteredRows, schema.dateKey, schema.bucketKeys]);

  async function exportPNG() {
    if (!enableExport) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      if (!shotRef.current) return;
      const canvas = await html2canvas(shotRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `credit-loss-${tab}.png`;
      a.click();
    } catch {
      alert("To enable export, install html2canvas: npm i html2canvas");
    }
  }

  const hasWeighted = Boolean(schema.weightedKey);
  const hasBuckets = schema.bucketKeys.length > 0;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between bg-yellow-200 rounded-t-lg px-4 py-3 shadow-sm">
        <div>
          <div className="text-base font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-800 opacity-80 -mt-0.5">
            Values are decimals → rendered as percentages.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rateSets.length > 0 && (
            <>
              <label className="text-sm ml-2">Rate set:</label>
              <select
                className="text-sm rounded-md border border-gray-200 bg-white px-3 py-1 shadow-sm focus:outline-none"
                value={selectedRateSet ?? rateSets[0]}
                onChange={(e) => onChangeRateSet?.(e.target.value)}
              >
                {rateSets.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </>
          )}

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

      <div className="border border-gray-200 border-t-0 rounded-b-lg">
        <div className="px-3 pt-3">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1">
            {[
              { id: "weighted", label: "Weighted", disabled: !hasWeighted },
              { id: "bucket", label: "Bucket trend", disabled: !hasBuckets },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => !t.disabled && setTab(t.id as any)}
                disabled={t.disabled}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  tab === (t.id as any)
                    ? "bg-yellow-500 text-white"
                    : "hover:bg-gray-50"
                } ${t.disabled ? "opacity-40 cursor-not-allowed hover:bg-white" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="h-64 rounded-md bg-gray-100 animate-pulse" />
          ) : !rows.length ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-sm text-gray-600">No data available</p>
            </div>
          ) : (
            <div ref={shotRef} className="w-full">
              {tab === "weighted" && (
                <>
                  {!hasWeighted ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                      <p className="text-sm text-gray-600">
                        No weighted column detected in backend response.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full h-[380px]">
                      <ResponsiveContainer>
                        <LineChart data={weightedSeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12 }}
                            minTickGap={24}
                            height={38}
                          />
                          <YAxis
                            tickFormatter={(v) => `${v}%`}
                            width={60}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(v: any) => fmtPct(v as number)}
                            labelFormatter={(l) => `Date: ${l}`}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="weighted"
                            name={schema.weightedKey ?? "Weighted"}
                            dot={false}
                            strokeWidth={2}
                            stroke={colorForKey(
                              schema.weightedKey ?? "weighted",
                            )}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}

              {tab === "bucket" && (
                <>
                  {!hasBuckets ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                      <p className="text-sm text-gray-600">
                        No bucket columns detected in backend response.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Bucket:</span>
                          <select
                            value={bucketKey}
                            onChange={(e) => setBucketKey(e.target.value)}
                            className="text-sm rounded-md border border-gray-200 px-3 py-1"
                          >
                            {schema.bucketKeys.map((k) => (
                              <option key={k} value={k}>
                                {labelFromKey(k)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="hidden sm:flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-600">
                            Compare:
                          </span>
                          {schema.bucketKeys.map((k) => (
                            <label
                              key={k}
                              className="text-xs flex items-center gap-1"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={visibleBuckets.includes(k)}
                                onChange={(e) =>
                                  setVisibleBuckets((prev) =>
                                    e.target.checked
                                      ? Array.from(new Set([...prev, k]))
                                      : prev.filter((x) => x !== k),
                                  )
                                }
                              />
                              {labelFromKey(k)}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="w-full h-[420px]">
                        <ResponsiveContainer>
                          <LineChart data={multiBucketSeries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12 }}
                              minTickGap={24}
                              height={38}
                            />
                            <YAxis
                              tickFormatter={(v) => `${v}%`}
                              width={60}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                              formatter={(v: any, name: any) => [
                                fmtPct(v as number),
                                labelFromKey(String(name)),
                              ]}
                              labelFormatter={(l) => `Date: ${l}`}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey={bucketKey}
                              name={`Bucket ${labelFromKey(bucketKey)}`}
                              dot={false}
                              strokeWidth={3}
                              stroke={colorForKey(bucketKey)}
                            />
                            {visibleBuckets
                              .filter((k) => k !== bucketKey)
                              .map((k) => (
                                <Line
                                  key={k}
                                  type="monotone"
                                  dataKey={k}
                                  name={`Bucket ${labelFromKey(k)}`}
                                  dot={false}
                                  strokeWidth={1.75}
                                  strokeOpacity={0.9}
                                  stroke={colorForKey(k)}
                                />
                              ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
