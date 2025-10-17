// ==========================
// pages/flowrate/steps/Step4.tsx (API-DRIVEN)
// ==========================
import React, { useEffect, useMemo, useState } from "react";
import {
  Squares2X2Icon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

import PrincipalMatrixTable from "../../../components/asa/table/PrincipalMatrixTable";
import PrincipalMatrixDistributionTable from "../../../components/asa/table/PrincipalMatrixDistributionTable";
import FlowRateCalcTable from "../../../components/asa/table/FlowRateCalcTable";
import TableFilterPopover from "../../../components/asa/table/ui/TableFilterPopover";
import type { AgingRow } from "../../../components/asa/table/aging.types";
import { useAsaApi } from "../../../lib/asaApi";
import { useLocation, useSearchParams } from "react-router-dom";

/* -------- workflow id helpers (URL ?workflow_id=, route state, or localStorage) -------- */
function useWorkflowId(): number {
  const { state } = useLocation() as { state?: { workflowId?: number } };
  const [params] = useSearchParams();

  const q = Number(params.get("workflow_id"));
  if (!Number.isNaN(q) && q > 0) return q;

  if (state?.workflowId && state.workflowId > 0) return state.workflowId;

  const ls = Number(localStorage.getItem("current_workflow_id") || "");
  if (!Number.isNaN(ls) && ls > 0) return ls;

  return 1; // sensible dev fallback
}

/* ---------- helpers (same style as Step 3) ---------- */
const clean = (s: string) => s?.toLowerCase().replace(/\s+/g, "") ?? "";

function pick(o: any, candidates: string[]) {
  for (const k of candidates) {
    if (o && Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    const found = Object.keys(o || {}).find((kk) => clean(kk) === clean(k));
    if (found) return o[found];
  }
  return undefined;
}

/** Accept numbers with commas, and treat "-", "", null, "#N/A" as missing. */
function numOrNA(v: any): number | "#N/A" {
  if (
    v === "" ||
    v == null ||
    String(v).trim() === "-" ||
    String(v).toUpperCase() === "#N/A"
  ) {
    return "#N/A";
  }
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : "#N/A";
}

/** Coerce backend principal matrix -> AgingRow[] used by all three Step 4 tables */
function coercePrincipalMatrix(payload: any): AgingRow[] {
  const data = payload?.data ?? payload;

  // Prefer the principal matrix block (your Step 3/4 backend)
  const block =
    data?.flow_of_balance_principal_matrix ??
    data?.["flow_of_balance_principal_matrix"] ??
    data?.rows ??
    data?.data ??
    data;

  const arr: any[] = Array.isArray(block) ? block : [];

  const out: AgingRow[] = arr.map((r) => {
    const product = (pick(r, ["Product", "product"]) ?? "").toString();
    const date =
      (pick(r, ["Date", "Report Date", "date", "report_date"]) ?? "").toString();

    // Total Loan Balance with C/P can be "-" or a number string like "22,774,500.00"
    const tlb =
      pick(r, [
        "Total Loan Balance with C/P",
        "Total Loan Balance with CP",
        "Loan Balance w/ CP",
        "total_loan_balance_with_cp",
      ]);

    // Bucket columns (pivot style)
    const d0 = pick(r, ["0 day", "0 Day", "d0"]);
    const par1 = pick(r, ["PAR 1 (1 & 30 days)", "PAR 1  (1 & 30 days)", "par1"]);
    const par30 = pick(r, ["PAR 30 (31 & 60 days)", "PAR 30  (31 & 60 days)", "par30"]);
    const par60 = pick(r, ["PAR 60 (61 & 90 days)", "PAR 60  (61 & 90 days)", "par60"]);
    const par90 = pick(r, ["PAR 90 (91 & 120 days)", "PAR 90  (91 & 120 days)", "par90"]);
    const par120 = pick(r, ["PAR 120 (121 & 180 days)", "PAR 120  (121 & 180 days)", "par120"]);
    const par180 = pick(r, ["PAR 180 (181 & 240 days)", "PAR 180  (181 & 240 days)", "par180"]);
    const par240 = pick(r, ["PAR 240 (241 & 360 days)", "PAR 240  (241 & 360 days)", "par240"]);
    const par360 = pick(r, ["PAR 360 (361 & Up days)", "PAR 360  (361 & Up days)", "par360"]);

    const row: AgingRow = {
      product,
      date,
      total_loan_balance_with_cp: numOrNA(tlb),
      d0: numOrNA(d0),
      par1: numOrNA(par1),
      par30: numOrNA(par30),
      par60: numOrNA(par60),
      par90: numOrNA(par90),
      par120: numOrNA(par120),
      par180: numOrNA(par180),
      par240: numOrNA(par240),
      par360: numOrNA(par360),
    };

    return row;
  });

  return out;
}

/* ------------------ Page ------------------ */
type ViewKey = "principal" | "distribution" | "flowrate";

export default function Step4() {
  const workflowId = useWorkflowId();

  // NOTE: Your asaApi.getStep4Data currently points to data_consolidation,
  // which does NOT contain the principal matrix. Step 4 needs the same
  // endpoint used in Step 3 (processed_flow_rate_approach).
  const { getStep3Data } = useAsaApi();

  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // default view = principal
  const [view, setView] = useState<ViewKey>("principal");
  const [productFilter, setProductFilter] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    getStep3Data(workflowId)
      .then((res) => {
        if (!mounted) return;
        setRows(coercePrincipalMatrix(res));
      })
      .catch((e: any) => {
        if (!mounted) return;
        console.error("Step4 API error:", e);
        setError(e?.message || "Failed to load Step 4 data.");
        setRows([]);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [workflowId, getStep3Data]);

  const products = useMemo(
    () => Array.from(new Set(rows.map((r) => r.product))).filter(Boolean).sort(),
    [rows]
  );

  const filteredRows = useMemo(
    () => (productFilter ? rows.filter((r) => r.product === productFilter) : rows),
    [rows, productFilter]
  );

  return (
    <div className="min-h-dvh p-6 space-y-6">
      {/* Top heading + product filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Flowrate Approach — Step 4</h2>
          <p className="text-xs text-gray-700">
            Explore principal matrices, their distributions, and flow rate calculations.
          </p>
        </div>

        <TableFilterPopover
          value={productFilter}
          options={products}
          onApply={setProductFilter}
          onClear={() => setProductFilter(null)}
          label="Filter"
          title="Filter by product"
          align="right"
        />
      </div>

      {/* Segmented View Switch */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setView("principal")}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
              ${view === "principal" ? "bg-white shadow-sm" : "hover:bg-white/60"}
            `}
            aria-pressed={view === "principal"}
          >
            <Squares2X2Icon className="h-4 w-4" />
            Principal Matrix
          </button>
          <button
            type="button"
            onClick={() => setView("distribution")}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
              ${view === "distribution" ? "bg-white shadow-sm" : "hover:bg-white/60"}
            `}
            aria-pressed={view === "distribution"}
          >
            <ChartBarIcon className="h-4 w-4" />
            Distribution
          </button>
          <button
            type="button"
            onClick={() => setView("flowrate")}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
              ${view === "flowrate" ? "bg-white shadow-sm" : "hover:bg-white/60"}
            `}
            aria-pressed={view === "flowrate"}
          >
            <ArrowTrendingUpIcon className="h-4 w-4" />
            Flow Rate Calc
          </button>
        </div>
      </div>

      {/* Loading / Error / Content */}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : (
        <>
          {view === "principal" && (
            <Card
              title="Flow of Loan Balance Principal Matrix"
              subtitle="Raw principal balances by PAR bucket."
            >
              <PrincipalMatrixTable rows={filteredRows} height={420} />
            </Card>
          )}

          {view === "distribution" && (
            <Card
              title="Flow of Loan Balance Principal Matrix — Distribution"
              subtitle="Bucket shares (percent of total) per row."
            >
              {/* This table computes distribution from the numeric principal rows */}
              <PrincipalMatrixDistributionTable rows={filteredRows} height={420} />
            </Card>
          )}

          {view === "flowrate" && (
            <Card
              title="Flow Rate Calculation"
              subtitle="Calculated from successive periods per product."
            >
              {/* Component typically derives transitions; feeding principal rows is fine */}
              <FlowRateCalcTable rows={filteredRows} height={420} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------ Small Card wrapper (matches Step 5 style) ------------------ */
const Card: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string }>> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center justify-between px-4 py-3 border-b rounded-t-2xl bg-yellow-500">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-800 -mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-4">{children}</div>
  </div>
);
