// pages/ecl/steps/Step2.tsx
import  { useEffect, useMemo, useRef, useState } from "react";
import {
  InformationCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

import { useAppSelector } from "../../../redux_toolkit/hooks";
import { selectModuleProgress } from "../../../redux_toolkit/features/progress/moduleProgressSlice";
import type { RootState } from "../../../redux_toolkit/store";
import EclCombinedExcelTable, {
  type EclClientRow,
} from "../../../components/asa/ecl/EclTablesCombined";

type ApiRowRaw = Record<string, any>;

type ApiPagination = {
  current_page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  next_page: number | null;
  previous_page: number | null;
  start_index?: number;
  end_index?: number;
};

export interface EclAgingSummaryRow {
  agingCategory: string;
  creditLossUpside: number;
  creditLossBaseline: number;
  creditLossDownside: number;
  eclUpside: number;
  eclBaseline: number;
  eclDownside: number;
  weightedEcl: number;
}

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

function toMMDDYYYY(iso: any) {
  const s = String(iso ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const [, yyyy, mm, dd] = m;
  return `${mm}/${dd}/${yyyy}`;
}

function formatLoanRefNo(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  if (Math.abs(n) >= 1e12)
    return n.toExponential(2).replace("e+", "E+").replace("e-", "E-");
  return String(n);
}

function round(n: number, d = 2) {
  const p = 10 ** d;
  return Math.round((Number(n) || 0) * p) / p;
}

function normalizeClientRows(data: ApiRowRaw[]): EclClientRow[] {
  return (data ?? []).map((r) => {
    const dateIso = r.date ?? r["date"];
    const aging = r["aging category"] ?? r.aging_category ?? r.agingCategory;

    const clrU = toNumber(r["credit loss rate upside"] ?? r.credit_loss_rate_upside);
    const clrB = toNumber(r["credit loss rate baseline"] ?? r.credit_loss_rate_baseline);
    const clrD = toNumber(r["credit loss rate downside"] ?? r.credit_loss_rate_downside);

    const eclU = toNumber(r["expected credit loss upside"] ?? r.expected_credit_loss_upside);
    const eclB = toNumber(r["expected credit loss baseline"] ?? r.expected_credit_loss_baseline);
    const eclD = toNumber(r["expected credit loss downside"] ?? r.expected_credit_loss_downside);

    const weighted = toNumber(r["weighted ecl"] ?? r.weighted_ecl);
    const delinquentDays = toNumber(r["delinquent_days"] ?? r.delinquent_days ?? r.delinquentDays);

    return {
      date: toMMDDYYYY(dateIso),
      clientRefNo: String(r.client_ref_no ?? r.clientRefNo ?? ""),
      loanRefNo: formatLoanRefNo(r.loan_ref_no ?? r.loanRefNo ?? ""),
      serviceCode: String(r.servicecode ?? r.serviceCode ?? ""),

      principalLoanBalance: toNumber(r.principal_loan_balance ?? r.principalLoanBalance),
      loanBalance: toNumber(r.loan_balance ?? r.loanBalance),
      pastDueAmount: toNumber(r.past_due_amount ?? r.pastDueAmount),
      totalSavings: toNumber(r.totalsavings ?? r.totalSavings),
      noPayment: toNumber(r.no_payment ?? r.noPayment),
      delinquentDays,
      agingCategory: toUpperAging(aging),

      // API returns decimals (0.0074...), UI expects percent points (0.74...)
      creditLossUpside: round(clrU * 100, 2),
      creditLossBaseline: round(clrB * 100, 2),
      creditLossDownside: round(clrD * 100, 2),

      eclUpside: eclU,
      eclBaseline: eclB,
      eclDownside: eclD,
      weightedEcl: weighted,
    };
  });
}


function getProbabilityWeightsFromState(weights?: {
  upside?: string;
  baseline?: string;
  downside?: string;
}): {
  upside: string;
  baseline: string;
  downside: string;
} {
  // defaults
  const fallback = { upside: "30", baseline: "50", downside: "20" };

  const upside = String(weights?.upside ?? "").trim();
  const baseline = String(weights?.baseline ?? "").trim();
  const downside = String(weights?.downside ?? "").trim();

  if (!upside || !baseline || !downside) return fallback;
  return { upside, baseline, downside };
}

export default function Step2() {
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
    | { upside?: string; baseline?: string; downside?: string }
    | undefined;

  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);

  const [clientRows, setClientRows] = useState<EclClientRow[]>([]);
  const [totalLoanBalance, setTotalLoanBalance] = useState(0);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);

  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasInitialFetched, setHasInitialFetched] = useState(false);
  const [needsRun, setNeedsRun] = useState(false);

  const POST_URL = "http://localhost:8000/api/ecl/";

  const lastInitialFetchRef = useRef<number | null>(null);
  const busy = loading || posting;

  const fetchEclData = async (opts?: { page?: number; markInitial?: boolean }) => {
    const targetPage = opts?.page ?? page;

    setError(null);
    setLoading(true);

    try {
      const url = `http://localhost:8000/api/ecl/?workflow_id=${workflowId}&page=${targetPage}&page_size=${pageSize}`;

      const res = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!json?.success) {
        throw new Error(json?.msg || "Failed to fetch ECL data.");
      }

      setTotalLoanBalance(json?.total_loan_balance);
      const normalized = normalizeClientRows(json?.data ?? []);
      const totalItems = Number(json?.pagination?.total_items ?? 0);

      setClientRows(normalized);
      setPagination((json?.pagination ?? null) as ApiPagination | null);

      // if the workflow has no computed data yet, show Run
      const noData = normalized.length === 0 && totalItems === 0;
      setNeedsRun(noData);

      if (opts?.markInitial) setHasInitialFetched(true);
    } catch (e: any) {
      setClientRows([]);
      setPagination(null);
      setError(e?.message || "Failed to fetch ECL data.");
      if (opts?.markInitial) setHasInitialFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const runComputeThenGet = async () => {
    if (posting) return;

    setError(null);
    setPosting(true);

    try {
      const formData = new FormData();
      formData.append("workflow_id", String(workflowId));
      const weights = getProbabilityWeightsFromState(persistedWeights);
      console.log('weights: ', weights)
formData.append(
  "probability_weights",
  JSON.stringify({
    upside: weights.upside,
    baseline: weights.baseline,
    downside: weights.downside,
  })
);


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

      // after POST success, GET again (page 1)
      setPage(1);
      await fetchEclData({ page: 1 });
    } catch (e: any) {
      setError(e?.message || "Failed to compute ECL.");
    } finally {
      setPosting(false);
    }
  };

  // Initial behavior: GET only (once per workflowId)
  useEffect(() => {
    if (!workflowId) return;

    if (lastInitialFetchRef.current === workflowId) return;
    lastInitialFetchRef.current = workflowId;

    setHasInitialFetched(false);
    //setNeedsRun(false);
    setPage(1);

    fetchEclData({ page: 1, markInitial: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  const reportingDate = useMemo(() => {
    if (clientRows.length) return clientRows[0].date;
    return "";
  }, [clientRows]);

  const totalPages = Number(pagination?.total_pages ?? 1);
  const currentPage = Number(pagination?.current_page ?? page);
  const hasNext = Boolean(pagination?.has_next);
  const hasPrev = Boolean(pagination?.has_previous);
  const totalItems = Number(pagination?.total_items ?? 0);

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
                ECL by Aging Category
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                This page shows the ECL calculation using each client™s loan balances by product or across all products as of the reporting date, together with the forward-looking loss rates.
              </p>
              <div className="mt-2 text-xs text-amber-900/80">
                Workflow Name: <b>{pdTransitionMatrixWfName || ""}</b>
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

        {/* Toolbar (Run / Refresh / Pagination) */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3  border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Loan-Level Expected Credit Loss
              </h2>
              <p className="text-xs text-slate-500">
                {loading && !hasInitialFetched
                  ? "Loading initial data"
                  : needsRun
                  ? "No computed data found. Click Run to compute."
                  : totalItems
                  ? `page ${currentPage} / ${totalPages}  total ${totalItems.toLocaleString("en-PH")}`
                  : "No data."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Run only when GET shows no data */}
              <button
                type="button"
                onClick={runComputeThenGet}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
                  busy
                    ? "bg-amber-200 text-slate-700"
                    : "bg-amber-400 text-slate-900 hover:brightness-95"
                }`}
                title={
                  !hasInitialFetched
                    ? "Waiting for initial GET"
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
                {posting ? "Running" : "Run"}
              </button>

              {/* Refresh always GET */}
              <button
                type="button"
                onClick={() => fetchEclData({ page })}
                disabled={busy || !hasInitialFetched}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="GET again"
              >
                <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>

              {/* Pagination */}
              <div className="ml-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, page - 1);
                    setPage(next);
                    fetchEclData({ page: next }).catch(() => {});
                  }}
                  disabled={busy || !hasInitialFetched || !hasPrev || page <= 1}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Prev
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    fetchEclData({ page: next }).catch(() => {});
                  }}
                  disabled={busy || !hasInitialFetched || !hasNext}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Combined Excel-like Table */}
          <EclCombinedExcelTable
            rows={clientRows}
            reportingDate={reportingDate || ""}
            totalLoanBalance={totalLoanBalance}
          />
        </section>
      </div>
    </div>
  );
}

