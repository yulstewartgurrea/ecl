// pages/ecl/steps/Step4.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  InformationCircleIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { useAppSelector } from "../../../redux_toolkit/hooks";

import type { AgingPortfolioRow } from "../../../components/asa/ecl/AgingCategoryPortfolioEclTable";
import PortfolioEclByAgingChart from "../../../components/asa/ecl/PortfolioEclByAgingChart";

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
  const rows = (data ?? []).map((r) => {
    const aging = r["aging category"] ?? r.aging_category ?? r.agingCategory ?? "";
    return {
      agingCategory: toUpperAging(aging),
      count: toNumber(r["count"] ?? r.count),
      loanBalance: toNumber(r["loan balance"] ?? r.loan_balance ?? r.loanBalance),
      // Step4 chart expects these
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

      // if your table needs this (your demo had it), keep it optional
      distribution: toNumber(r["distribution"] ?? r.distribution),
    } as AgingPortfolioRow;
  });

  // Chart should NOT include TOTAL / ECL RATE rows
  return rows.filter(
    (x) => x.agingCategory !== "TOTAL" && x.agingCategory !== "ECL RATE"
  );
}

export default function Step4() {
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
    return 35; // fallback (matches your sample GET)
  }, [currentPdTransitionMatrixWorkflowId]);

  const [rows, setRows] = useState<AgingPortfolioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ initial GET state
  const [hasInitialFetched, setHasInitialFetched] = useState(false);
  // ✅ if no data, require manual run
  const [needsRun, setNeedsRun] = useState(false);

  const busy = loading || posting;

  const GET_URL = useMemo(
    () => `http://localhost:8000/api/ecl/summary/?workflow_id=${workflowId}`,
    [workflowId]
  );
  // const POST_URL = "http://localhost:8000/api/ecl/summary/";

  const lastInitialFetchRef = useRef<number | null>(null);

  const fetchInitialOrRefresh = async (opts?: { markInitial?: boolean }) => {
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

      const normalized = normalizeSummaryRows(json?.data ?? []);
      setRows(normalized);

      const noData = normalized.length === 0;
      setNeedsRun(noData);

      if (opts?.markInitial) setHasInitialFetched(true);
    } catch (e: any) {
      setRows([]);
      setNeedsRun(false);
       setPosting(false)
      setError(e?.message || "Failed to fetch summary.");
      if (opts?.markInitial) setHasInitialFetched(true);
    } finally {
      setLoading(false);
    }
  };


  // ✅ Initial behavior: GET only (once per workflowId)
  useEffect(() => {
    if (!workflowId) return;

    if (lastInitialFetchRef.current === workflowId) return;
    lastInitialFetchRef.current = workflowId;

    setHasInitialFetched(false);
    setNeedsRun(false);
    setRows([]);
    setError(null);

    fetchInitialOrRefresh({ markInitial: true }).catch(() => {});
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
                Graphical View of Portfolio ECL
              </h1>
              
              <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90">
                <span className="font-semibold">Per bucket ECL Rate formula:</span>{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px]">
                  ECL Rate (bucket) = Weighted ECL ÷ Loan Balance × 100
                </code>
                .
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

        {/* Chart card */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Portfolio ECL by Aging Category – Chart
              </h2>
              <p className="text-xs text-slate-500">
                {loading && !hasInitialFetched
                  ? "Loading initial data…"
                  : needsRun
                  ? "No computed data found. Click Run to compute."
                  : "Bars show loan balance per bucket; line shows ECL rate (weightedEcl / loanBalance × 100)."}
              </p>
            </div>

            
          </div>

          <div className="px-4 pb-4 pt-3">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                {loading ? "Loading…" : needsRun ? "No data yet. Click Run." : "No rows."}
              </div>
            ) : (
              <PortfolioEclByAgingChart rows={rows} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
