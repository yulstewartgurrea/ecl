// ==========================
// pages/flowrate/steps/Step3.tsx (API-DRIVEN, FIXED BLOCK + NUMBER PARSING)
// ==========================
import { useEffect, useMemo, useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import AgingByProductTable from "../../../components/asa/table/AgingByProductTable";
import TableFilterPopover from "../../../components/asa/table/ui/TableFilterPopover";
import type { AnyRow as AgingRow } from "../../../components/asa/table/aging.types";
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

/* -------- robust mappers (tolerate spacing/case differences from backend) -------- */
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

type Buck =
  | "d0"
  | "par1"
  | "par30"
  | "par60"
  | "par90"
  | "par120"
  | "par180"
  | "par240"
  | "par360";

/** Map an "Aging Category" label into our bucket key. */
function labelToBucketKey(label: string | undefined): Buck | undefined {
  if (!label) return undefined;
  const s = clean(label);
  if (s.startsWith("0day") || s === "0day" || s === "0") return "d0";
  const m = /par\s*([0-9]+)/i.exec(label);
  if (!m) return undefined;
  const n = Number(m[1]);
  switch (n) {
    case 1: return "par1";
    case 30: return "par30";
    case 60: return "par60";
    case 90: return "par90";
    case 120: return "par120";
    case 180: return "par180";
    case 240: return "par240";
    case 360: return "par360";
    default: return undefined;
  }
}

/** Accepts either pivoted rows (columns for buckets) or long rows with "Aging Category".
 *  FIX: read from data.flow_of_balance_principal_matrix (your backend shape).
 */
function coerceAgingRows(payload: any): AgingRow[] {
  const data = payload?.data ?? payload;

  const block =
    // Step 3 backend responses (prefer principal matrix)
    data?.flow_of_balance_principal_matrix ??
    data?.["flow_of_balance_principal_matrix"] ??
    // (optionally) distribution table if you want to show percents as numbers later
    data?.["flow_of_balance_principal_matrix (distribution)"] ??
    // fallbacks for other shapes
    data?.aging_by_product ??
    data?.rows ??
    data?.data ??
    data;

  const arr: any[] = Array.isArray(block) ? block : [];

  // Group by (product,date)
  const byKey = new Map<string, AgingRow>();

  const ensureRow = (product: string, date: string) => {
    const key = `${product}__${date}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        product,
        date,
        total_loan_balance_with_cp: "#N/A",
        d0: "#N/A",
        par1: "#N/A",
        par30: "#N/A",
        par60: "#N/A",
        par90: "#N/A",
        par120: "#N/A",
        par180: "#N/A",
        par240: "#N/A",
        par360: "#N/A",
      });
    }
    return byKey.get(key)!;
  };

  for (const r of arr) {
    const product = pick(r, ["Product", "product"]) ?? "";
    const date = pick(r, ["Report Date", "Date", "date", "report_date"]) ?? "";

    const row = ensureRow(String(product), String(date));

    // total loan balance with CP if present
    const tlp =
      pick(r, ["Total Loan Balance with C/P", "Total Loan Balance with CP", "Loan Balance w/ CP", "total_loan_balance_with_cp"]);
    if (tlp !== undefined) row.total_loan_balance_with_cp = numOrNA(tlp);

    // If row is long-form with "Aging Category"
    const cat = pick(r, ["Aging Category", "aging_category"]);
    if (cat !== undefined) {
      const key = labelToBucketKey(String(cat));
      if (key) {
        // prefer principal; fall back to loan bal w/ cp
        const amount =
          pick(r, ["Loan Balance Principal", "loan_balance_principal"]) ??
          pick(r, ["Loan Balance w/ CP"]);
        (row as any)[key] = numOrNA(amount);
      }
      continue;
    }

    // Else: pivot-style — scan for each bucket column on this object
    const bucketCols: Record<Buck, string[]> = {
      d0: ["0 day", "0 Day", "d0"],
      par1: ["PAR 1 (1 & 30 days)", "PAR 1  (1 & 30 days)", "par1"],
      par30: ["PAR 30 (31 & 60 days)", "PAR 30  (31 & 60 days)", "par30"],
      par60: ["PAR 60 (61 & 90 days)", "PAR 60  (61 & 90 days)", "par60"],
      par90: ["PAR 90 (91 & 120 days)", "PAR 90  (91 & 120 days)", "par90"],
      par120: ["PAR 120 (121 & 180 days)", "PAR 120  (121 & 180 days)", "par120"],
      par180: ["PAR 180 (181 & 240 days)", "PAR 180  (181 & 240 days)", "par180"],
      par240: ["PAR 240 (241 & 360 days)", "PAR 240  (241 & 360 days)", "par240"],
      par360: ["PAR 360 (361 & Up days)", "PAR 360  (361 & Up days)", "par360"],
    };

    (Object.keys(bucketCols) as Buck[]).forEach((b) => {
      const v = pick(r, bucketCols[b]);
      if (v !== undefined) (row as any)[b] = numOrNA(v);
    });
  }

  return Array.from(byKey.values());
}

export default function Step3() {
  const workflowId = useWorkflowId();
  const { getStep3Data } = useAsaApi();

  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productFilter, setProductFilter] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    getStep3Data(workflowId)
      .then((res) => {
        if (!mounted) return;
        const mapped = coerceAgingRows(res);
        setRows(mapped);
      })
      .catch((e: any) => {
        if (!mounted) return;
        console.error("Step3 API error:", e);
        setError(e?.message || "Failed to load data.");
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

  const exportCsv = () => {
    const headers = [
      "product",
      "date",
      "total_loan_balance_with_cp",
      "d0",
      "par1",
      "par30",
      "par60",
      "par90",
      "par120",
      "par180",
      "par240",
      "par360",
    ];
    const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const lines = [
      headers.map(esc).join(","),
      ...filteredRows.map((r) =>
        [
          r.product,
          r.date,
          r.total_loan_balance_with_cp,
          r.d0,
          r.par1,
          r.par30,
          r.par60,
          r.par90,
          r.par120,
          r.par180,
          r.par240,
          r.par360,
        ]
          .map(esc)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aging_by_product.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh p-6 space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-yellow-500">
          <h3 className="text-sm font-semibold text-gray-900">Aging by Product</h3>
          <p className="text-xs text-gray-800 -mt-0.5">Filter by product and paginate results.</p>
        </div>

        {/* Toolbar: product filter + export */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <TableFilterPopover
            value={productFilter}
            options={products}
            onApply={setProductFilter}
            onClear={() => setProductFilter(null)}
            label="Filter"
            title="Filter by product"
            align="left"
          />
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-400 bg-yellow-400 px-3 py-2 text-sm text-gray-900 hover:brightness-95"
            title="Export filtered as CSV"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export
          </button>
        </div>

        {/* Table / states */}
        <div className="p-4">
          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
              Loading…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : (
            <AgingByProductTable rows={filteredRows} height={560} />
          )}
        </div>
      </div>
    </div>
  );
}
