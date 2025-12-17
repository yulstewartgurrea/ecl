// pages/ecl/steps/Step3.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector } from "../../../redux_toolkit/hooks";

import AgingCategoryPortfolioEclTable, {
  type AgingPortfolioRow,
} from "../../../components/asa/ecl/AgingCategoryPortfolioEclTable";

type ApiRowRaw = Record<string, any>;

function toNumber(v: any): number {
  const n = typeof v === "string" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toUpperAging(s: any) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeSummaryRows(data: ApiRowRaw[]): AgingPortfolioRow[] {
  return (data ?? []).map((r) => {
    const aging = r["aging category"] ?? r.aging_category ?? r.agingCategory ?? "";
    return {
      agingCategory: toUpperAging(aging),
      count: toNumber(r["count"] ?? r.count),
      loanBalance: toNumber(r["loan balance"] ?? r.loan_balance ?? r.loanBalance),
      // summary endpoint doesn't provide distribution; leave 0 (table may compute/ignore)
      distribution: toNumber(r["distribution"] ?? r.distribution),
      eclUpside: toNumber(
        r["expected credit loss upside"] ?? r.expected_credit_loss_upside ?? r.eclUpside
      ),
      eclBaseline: toNumber(
        r["expected credit loss baseline"] ?? r.expected_credit_loss_baseline ?? r.eclBaseline
      ),
      eclDownside: toNumber(
        r["expected credit loss downside"] ?? r.expected_credit_loss_downside ?? r.eclDownside
      ),
      weightedEcl: toNumber(r["weighted ecl"] ?? r.weighted_ecl ?? r.weightedEcl),
    } as AgingPortfolioRow;
  });
}

function calcOverallEclRatePercent(allRows: AgingPortfolioRow[]): number {
  // Prefer TOTAL row if backend provides it (your sample does)
  const total = allRows.find((r) => r.agingCategory === "TOTAL");
  if (total && total.loanBalance > 0) {
    return (total.weightedEcl / total.loanBalance) * 100;
  }

  // Fallback: sum over non-meta rows
  const usable = allRows.filter(
    (r) => r.agingCategory !== "TOTAL" && r.agingCategory !== "ECL RATE"
  );
  const sumLoan = usable.reduce((acc, r) => acc + toNumber(r.loanBalance), 0);
  const sumWeighted = usable.reduce((acc, r) => acc + toNumber(r.weightedEcl), 0);
  return sumLoan > 0 ? (sumWeighted / sumLoan) * 100 : 0;
}

export default function Step3() {
  const reduxToken = useAppSelector((s: any) => s.auth.token);
  const token = reduxToken ?? undefined;

  const { currentPdTransitionMatrixWorkflowId } = useAppSelector(
    (state: any) => state.pdTransitionMatrixWfHelper
  );

  const workflowId = useMemo(() => {
    const fromRedux = currentPdTransitionMatrixWorkflowId;
    if (fromRedux) return Number(fromRedux);

    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("current_workflow_id");
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    // fallback sample
    return 35;
  }, [currentPdTransitionMatrixWorkflowId]);

  const [rows, setRows] = useState<AgingPortfolioRow[]>([]);
  const [overallEclRatePercent, setOverallEclRatePercent] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasInitialFetched, setHasInitialFetched] = useState(false);
  const [needsRun, setNeedsRun] = useState(false);

  const busy = loading || posting;

  const GET_URL = useMemo(
    () => `http://localhost:8000/api/ecl/summary/?workflow_id=${workflowId}`,
    [workflowId]
  );
  const POST_URL = "http://localhost:8000/api/ecl/summary/";

  const lastInitialFetchRef = useRef<number | null>(null);

  const fetchSummary = async (opts?: { markInitial?: boolean }) => {
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
        throw new Error(json?.msg || "Failed to fetch summary.");
      }

      const normalizedAll = normalizeSummaryRows(json?.data ?? []);

      // Table rows: exclude TOTAL + ECL RATE
      const tableRows = normalizedAll.filter(
        (r) => r.agingCategory !== "TOTAL" && r.agingCategory !== "ECL RATE"
      );

      setRows(tableRows);
      setOverallEclRatePercent(calcOverallEclRatePercent(normalizedAll));

      // if no usable rows, require user to run
      setNeedsRun(tableRows.length === 0);

      if (opts?.markInitial) setHasInitialFetched(true);
    } catch (e: any) {
      setRows([]);
      setOverallEclRatePercent(0);
      setNeedsRun(false);
      setError(e?.message || "Failed to fetch summary.");
      if (opts?.markInitial) setHasInitialFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const runThenGet = async () => {
    if (posting) return;

    setError(null);
    setPosting(true);

    try {
      const formData = new FormData();
      formData.append("workflow_id", String(workflowId));

      const res = await fetch(POST_URL, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!json?.success) {
        throw new Error(json?.msg || "POST failed.");
      }

      // after POST success, GET again
      await fetchSummary();
    } catch (e: any) {
      setError(e?.message || "Failed to run summary compute.");
    } finally {
      setPosting(false);
    }
  };

  // ✅ Initial: GET only (once per workflowId)
  useEffect(() => {
    if (!workflowId) return;

    if (lastInitialFetchRef.current === workflowId) return;
    lastInitialFetchRef.current = workflowId;

    setHasInitialFetched(false);
    setNeedsRun(false);
    setRows([]);
    setOverallEclRatePercent(0);
    setError(null);

    fetchSummary({ markInitial: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  return (
    <div className={`min-h-dvh bg-slate-50 ${busy ? "cursor-wait" : ""}`}>
      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        {/* Description */}
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm">
          <div className="flex gap-3">
            <div className="mt-0.5">
              <InformationCircleIcon className="h-5 w-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-amber-900">
                Step 3 – Portfolio-Level ECL
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                This page first loads existing summary results using GET. If there is no computed
                data yet, click <b>Run</b> to POST and compute, then it will GET again.
              </p>
              <div className="mt-2 text-xs text-amber-900/80">
                workflow_id: <b>{workflowId}</b>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            <div className="flex items-center gap-2 font-semibold">
              <ExclamationTriangleIcon className="h-4 w-4" />
              Error
            </div>
            <div className="mt-1">{error}</div>
          </div>
        ) : null}

        {/* Main table */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Portfolio ECL by Aging Category
              </h2>
              <p className="text-xs text-slate-500">
                {loading && !hasInitialFetched
                  ? "Loading initial data…"
                  : needsRun
                  ? "No computed data found. Click Run to compute."
                  : "Derived from the loan-level ECL computation in previous steps."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runThenGet}
                disabled={busy || !hasInitialFetched || !needsRun}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                  busy || !hasInitialFetched || !needsRun
                    ? "bg-amber-200 text-slate-700"
                    : "bg-amber-400 text-slate-900 hover:brightness-95"
                }`}
                title={
                  !hasInitialFetched
                    ? "Waiting for initial GET…"
                    : needsRun
                    ? "Compute (POST) then reload (GET)"
                    : "Already has data"
                }
              >
                {posting ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
                {posting ? "Running…" : "Run"}
              </button>

              <button
                type="button"
                onClick={() => fetchSummary()}
                disabled={busy || !hasInitialFetched}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="GET again"
              >
                <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="p-4">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                {loading
                  ? "Loading…"
                  : needsRun
                  ? "No summary yet. Click Run to compute."
                  : "No rows."}
              </div>
            ) : (
              <AgingCategoryPortfolioEclTable
                rows={rows}
                overallEclRatePercent={overallEclRatePercent}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
