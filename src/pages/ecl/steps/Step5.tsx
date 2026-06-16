// pages/ecl/steps/Step5.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  InformationCircleIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
} from "@heroicons/react/24/outline";
import { useAppDispatch, useAppSelector } from "../../../redux_toolkit/hooks";
import {
  selectModuleProgress,
  setModuleProgress,
} from "../../../redux_toolkit/features/progress/moduleProgressSlice";
import type { RootState } from "../../../redux_toolkit/store";
import { downloadBlobWithTauri } from "../../../utils/downloadBlobWithTauri";

type ApiRowRaw = Record<string, any>;

type CreditLossRateRow = {
  agingCategory: string;
  historicalCreditLossRate: number;
  upside: number;
  baseline: number;
  downside: number;
};

function toNumber(v: any): number {
  const n = typeof v === "string" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pct(n: number, decimals = 4) {
  // backend returns decimals (e.g., 0.00097 = 0.097%)
  const p = n * 100;
  return `${p.toFixed(decimals)}%`;
}

type EclWeights = {
  upside: string;
  baseline: string;
  downside: string;
};


function normalizeRows(data: ApiRowRaw[]): CreditLossRateRow[] {
  return (data ?? []).map((r) => ({
    agingCategory: String(
      r["aging category"] ?? r.aging_category ?? r.agingCategory ?? ""
    ),
    historicalCreditLossRate: toNumber(
      r["historical credit loss rate"] ??
        r.historical_credit_loss_rate ??
        r.historicalCreditLossRate
    ),
    upside: toNumber(r["upside"] ?? r.upside),
    baseline: toNumber(r["baseline"] ?? r.baseline),
    downside: toNumber(r["downside"] ?? r.downside),
  }));
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "green" | "red" | "yellow" | "blue";
}) {
  const tones: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    yellow: "bg-amber-50 text-amber-800",
    blue: "bg-sky-50 text-sky-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-black/5 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export default function Step5() {
  const dispatch = useAppDispatch();
  const reduxToken = useAppSelector((s: any) => s.auth.token);
  const token = reduxToken ?? undefined;

  const {
    currentPdTransitionMatrixWorkflowId,
    currentPdTransitionMatrixWorkflowData,
    pdTransitionMatrixWfName,
  } = useAppSelector((state: any) => state.pdTransitionMatrixWfHelper);

  const workflowId = useMemo(() => {
    const fromRedux =
      currentPdTransitionMatrixWorkflowId ?? currentPdTransitionMatrixWorkflowData?.id;
    const parsed = Number(fromRedux);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 1;
  }, [currentPdTransitionMatrixWorkflowId, currentPdTransitionMatrixWorkflowData]);

  const eclProgress = useAppSelector((state: RootState) =>
    selectModuleProgress(state, "ecl", String(workflowId))
  );
  const persistedWeights = (eclProgress?.data as any)?.probabilityWeights as
    | EclWeights
    | undefined;

  const [upside, setUpside] = useState<string>("30");
  const [baseline, setBaseline] = useState<string>("50");
  const [downside, setDownside] = useState<string>("20");

  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CreditLossRateRow[]>([]);
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const weightsSum = useMemo(() => {
    return toNumber(upside) + toNumber(baseline) + toNumber(downside);
  }, [upside, baseline, downside]);

  const canSubmit = useMemo(() => {
    const u = toNumber(upside);
    const b = toNumber(baseline);
    const d = toNumber(downside);
    return [u, b, d].every((x) => Number.isFinite(x) && x >= 0) && weightsSum > 0;
  }, [upside, baseline, downside, weightsSum]);

  const GET_URL = useMemo(
    () =>
      `http://localhost:8000/api/ecl/credit_loss_rates/?workflow_id=${workflowId}`,
    [workflowId]
  );

  const fetchResults = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(GET_URL, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!json?.success) {
        throw new Error(json?.msg || "Failed to fetch credit loss rates.");
      }
      dispatch(
        setModuleProgress({
          moduleKey: "ecl",
          contextKey: String(workflowId),
          data: {
            probabilityWeights: {
              upside: String(upside ?? ""),
              baseline: String(baseline ?? ""),
              downside: String(downside ?? ""),
            } as EclWeights,
          },
        })
      );

      setRows(normalizeRows(json?.data ?? []));
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Failed to fetch results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (persistedWeights) {
      setUpside(persistedWeights.upside ?? "30");
      setBaseline(persistedWeights.baseline ?? "50");
      setDownside(persistedWeights.downside ?? "20");
    } else {
      // optional: keep defaults
      setUpside("30");
      setBaseline("50");
      setDownside("20");
    }
    setStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, persistedWeights]);

  const submitWeights = async () => {
    if (!canSubmit || posting) return;

    setError(null);
    setStatus(null);
    setPosting(true);

    try {
      const formData = new FormData();
      formData.append("workflow_id", String(workflowId));

      formData.append(
        "probability_weights",
        JSON.stringify({
          upside: String(upside ?? ""),
          baseline: String(baseline ?? ""),
          downside: String(downside ?? ""),
        })
      );

      const res = await fetch("http://localhost:8000/api/ecl/credit_loss_rates/", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!json?.success) {
        throw new Error(json?.msg || "Failed to save probability weights.");
      }

      setStatus({ ok: true, msg: json?.msg || "Success" });
      dispatch(
        setModuleProgress({
          moduleKey: "ecl",
          contextKey: String(workflowId),
          data: {
            probabilityWeights: {
              upside: String(upside ?? ""),
              baseline: String(baseline ?? ""),
              downside: String(downside ?? ""),
            } as EclWeights,
          },
        })
      );

      await fetchResults();
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message || "Request failed." });
      setError(e?.message || "Request failed.");
    } finally {
      setPosting(false);
    }
  };

  const exportCreditLossRates = async () => {
    if (!token || !workflowId) return;
    
    try {
      const response = await fetch(
        `http://localhost:8000/api/ecl/credit_loss_rates/export?workflow_id=${workflowId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "credit_loss_rates.xlsx";
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        await downloadBlobWithTauri(blob, filename);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData?.msg || "Failed to export credit loss rates");
      }
    } catch (err: any) {
      console.error("Error exporting credit loss rates:", err);
      setError(err?.message || "Error exporting credit loss rates");
    }
  };

  useEffect(() => {
    fetchResults().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Description */}
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm">
          <div className="flex gap-3">
            <div className="mt-0.5">
              <InformationCircleIcon className="h-5 w-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-amber-900">
                Credit Loss Rate
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                Enter the scenario probability weights then submit. If successful, the system will
                compute and return the forward-looking credit loss rates per aging category.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone="blue">Workflow Name: {pdTransitionMatrixWfName || ""}</Pill>
                <Pill tone={weightsSum === 100 ? "green" : "yellow"}>
                  weights sum: {weightsSum}%
                </Pill>
                {status?.ok ? (
                  <Pill tone="green">
                    <CheckCircleIcon className="h-4 w-4 mr-1" /> {status.msg}
                  </Pill>
                ) : status?.ok === false ? (
                  <Pill tone="red">
                    <ExclamationTriangleIcon className="h-4 w-4 mr-1" /> {status.msg}
                  </Pill>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Input card */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3  border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Probability Weights
              </h2>
             
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchResults}
                disabled={loading || posting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </button>

              <button
                type="button"
                onClick={submitWeights}
                disabled={!canSubmit || posting}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${
                  !canSubmit || posting
                    ? "bg-amber-300/60 text-slate-700 cursor-not-allowed"
                    : "bg-amber-400 text-slate-900 hover:brightness-95"
                }`}
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                {posting ? "Submitting..." : "Submit & Compute"}
              </button>

              <button
                type="button"
                onClick={exportCreditLossRates}
                disabled={loading || posting || rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                title="Export credit loss rates as Excel file"
              >
                <CloudArrowDownIcon className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <div className="text-xs font-medium text-slate-700">
                  Upside (%)
                </div>
                <input
                  value={upside}
                  onChange={(e) => {
                    setUpside(e.target.value);
                    setStatus(null);
                  }}
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="e.g. 30"
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs font-medium text-slate-700">
                  Baseline (%)
                </div>
                <input
                  value={baseline}
                  onChange={(e) => {
                    setBaseline(e.target.value);
                    setStatus(null);
                  }}
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="e.g. 50"
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs font-medium text-slate-700">
                  Downside (%)
                </div>
                <input
                  value={downside}
                  onChange={(e) => {
                    setDownside(e.target.value);
                    setStatus(null);
                  }}
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="e.g. 20"
                />
              </label>
            </div>

            {weightsSum !== 100 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Tip: Excel sample uses 30/50/20 (sum = 100). Current sum is{" "}
                <b>{weightsSum}%</b>.
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                <div className="flex items-center gap-2 font-semibold">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Error
                </div>
                <div className="mt-1">{error}</div>
              </div>
            )}
          </div>
        </section>

        {/* Results table */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3  border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Forward-Looking Credit Loss Rate
              </h2>
             
            </div>

            {loading ? (
              <Pill tone="blue">Loading...</Pill>
            ) : rows.length ? (
              <Pill tone="green">{rows.length} rows</Pill>
            ) : (
              <Pill tone="default">No data</Pill>
            )}
          </div>

          <div className="p-4 overflow-x-auto">
            {rows.length === 0 ? (
              <div className="text-sm text-slate-500">
                No results yet. Submit probability weights to compute.
              </div>
            ) : (
              <table className="min-w-[980px] w-full border-collapse">
                {/* Excel-like header colors + group header */}
                <thead>
                  {/* Row 1: Group headers */}
                  <tr>
                    <th
                      rowSpan={2}
                      className="text-left text-xs font-semibold text-slate-900 border border-slate-300 px-3 py-2 bg-[#D9EAF7]"
                    >
                      Aging Category
                    </th>

                    <th
                      rowSpan={2}
                      className="text-right text-xs font-semibold text-slate-900 border border-slate-300 px-3 py-2 bg-[#F4B183]"
                    >
                      Historical Credit Loss Rate
                    </th>

                    <th
                      colSpan={3}
                      className="text-center text-xs font-semibold text-slate-900 border border-slate-300 px-3 py-2 bg-[#D9EAF7]"
                    >
                      Forward-Looking Credit Loss Rate
                    </th>
                  </tr>

                  {/* Row 2: Scenario headers */}
                  <tr>
                    <th className="text-right text-xs font-semibold text-slate-900 border border-slate-300 px-3 py-2 bg-[#E2F0D9]">
                      Upside
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-900 border border-slate-300 px-3 py-2 bg-[#FFF2CC]">
                      Baseline
                    </th>
                    <th className="text-right text-xs font-semibold text-slate-900 border border-slate-300 px-3 py-2 bg-[#FCE4D6]">
                      Downside
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={`${r.agingCategory}-${idx}`} className="odd:bg-white even:bg-slate-50/50">
                      <td className="text-sm text-slate-900 px-3 py-2 border border-slate-300">
                        {r.agingCategory}
                      </td>
                      <td className="text-sm text-right text-slate-900 px-3 py-2 border border-slate-300 tabular-nums">
                        {pct(r.historicalCreditLossRate)}
                      </td>
                      <td className="text-sm text-right text-slate-900 px-3 py-2 border border-slate-300 tabular-nums">
                        {pct(r.upside)}
                      </td>
                      <td className="text-sm text-right text-slate-900 px-3 py-2 border border-slate-300 tabular-nums">
                        {pct(r.baseline)}
                      </td>
                      <td className="text-sm text-right text-slate-900 px-3 py-2 border border-slate-300 tabular-nums">
                        {pct(r.downside)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

