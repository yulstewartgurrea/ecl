// Step6.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ModelCompareGrid,
  type ModelSpec,
} from "../../../../components/overlay/development/candidate_model/ModelCompareGrid";
import { useAppDispatch, useAppSelector } from "../../../../redux_toolkit/hooks";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import PaginationControls from "../../../../components/overlay/development/shared/PaginationControls";
import {
  selectModuleProgress,
  setModuleProgress,
} from "../../../../redux_toolkit/features/progress/moduleProgressSlice";
import { postCandidateModels } from "../../../../services/candidateModels";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/* ---------- Types ---------- */
type Step5Persist = {
  ids: Array<string | number>;
  rows: any[];
  savedAt: string;
};
type SinglePersist = {
  workflowId: number;
  model: ModelSpec;       // always one
  index?: number;            // optional UI index on the page where it was selected
  savedAt: string;
};

type OverlayDevelopmentData = {
  step5Selected?: Step5Persist;
  step5Checked?: Step5Persist;
  step6Shortlist?: ModelSpec[];
  step6Selected?: SinglePersist;
};

function modelSignature(m: ModelSpec): string {
  return JSON.stringify({
    title: m.title,
    metrics: m.metrics,
    variables: (m.variables || []).map((v) => ({
      name: v.name,
      coeff_X1: (v as any).coeff_X1,
      p: (v as any)["p-value_X1"],
      vif: (v as any).vif_X1 ?? (v as any).vif,
    })),
    // If raw exists, include a stable subset to improve matching
    raw_Y: (m as any)?.raw?.Y,
    raw_X1: (m as any)?.raw?.X1,
    raw_X2: (m as any)?.raw?.X2,
  });
}

function findColumn(row: any, colName: string): any {
  if (!row) return undefined;
  const colLower = colName.toLowerCase();
  for (const key in row) {
    if (key.toLowerCase() === colLower) return row[key];
  }
  return undefined;
}

function findAllXColumns(row: any): Array<{ index: number; name: string; value: any }> {
  if (!row) return [];
  const matches: Array<{ index: number; name: string; value: any }> = [];
  Object.keys(row).forEach((key) => {
    const m = String(key).match(/^x(\d+)$/i);
    if (!m) return;
    const idx = Number(m[1]);
    const value = row[key];
    if (value === undefined || value === null || value === "") return;
    matches.push({ index: idx, name: `X${idx}`, value });
  });
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

function mapStep5RowToModelSpec(row: any): ModelSpec {
  const xColumns = findAllXColumns(row);
  const xNames = xColumns.length > 0 ? xColumns.map((x) => x.value).join(" | ") : "-";
  const title = `${row?.Y ?? findColumn(row, "Y") ?? "Model"}: ${xNames}`;

  const variables = xColumns.map((xCol) => {
    const xName = xCol.name;
    const coeffKey = `coeff_${xName}`;
    const coeff = findColumn(row, coeffKey) ?? 0;
    const pvalKey1 = `p-value_${xName}`;
    const pvalKey2 = `p_value_${xName}`;
    const pval = findColumn(row, pvalKey1) ?? findColumn(row, pvalKey2);
    const vifKey = `vif_${xName}`;
    const vif = findColumn(row, vifKey);

    return {
      name: String(xCol.value),
      coeff_X1: Number(coeff),
      "p-value_X1": pval,
      vif_X1: vif,
      raw: coeff,
    };
  });

  const xObject: Record<string, any> = {};
  xColumns.forEach((xCol) => {
    xObject[xCol.name] = xCol.value;
  });

  return {
    title,
    variables,
    metrics: {
      Adj_R_Squared: findColumn(row, "Adj_R_Squared"),
      RMSE: findColumn(row, "RMSE"),
      MAPE: findColumn(row, "MAPE"),
      R_Squared: findColumn(row, "R_Squared"),
    },
    raw: row,
    index: findColumn(row, "index"),
    Y: findColumn(row, "Y"),
    ...xObject,
    R_Squared: findColumn(row, "R_Squared"),
    Adj_R_Squared: findColumn(row, "Adj_R_Squared"),
    MAPE: findColumn(row, "MAPE"),
  };
}

/* ---------- Step 5 selection + shortlist are now stored in Redux ---------- */

/* ---------- CSV helpers (only used if export endpoint returns JSON) ---------- */
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function deriveCsvHeadersFromModels(rows: ModelSpec[]): string[] {
  const set = new Set<string>();
  for (const r of rows || []) {
    Object.keys(r || {}).forEach((k) => set.add(k)); // top-level only; nested are stringified
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
function toCsv(headers: string[], rows: any[]): string {
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escapeCsv((r as any)[h])).join(",")).join("\n");
  return "\uFEFF" + head + "\n" + body; // BOM for Excel
}

/* ---------- Component ---------- */
const Step6: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } = useSelector(
    (s: RootState) => (s as any).pdTransitionMatrixWfHelper
  );
  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const overlayRoot = useAppSelector((state: RootState) =>
    selectModuleProgress(state, "overlayDevelopment")
  );
  const lastWorkflowId = (overlayRoot?.data as any)?.lastWorkflowId as
    | number
    | undefined;

  const [models, setModels] = useState<ModelSpec[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(1000);
  const [total, setTotal] = useState<number | undefined>(undefined);
  // pagination state retained for API parity (UI uses page=1)
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);
  const [shortlist, setShortlist] = useState<ModelSpec[]>([]);
  const [hasStep5Selection, setHasStep5Selection] = useState<boolean>(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const totalRows = models.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / Math.max(1, pageSize)));
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalRows);

  const pagedModels = useMemo(
    () => models.slice(pageStart, pageEnd),
    [models, pageStart, pageEnd]
  );

  const pagination = useMemo(
    () => ({
      page: currentPage,
      page_size: pageSize,
      total_rows: totalRows,
      total_pages: totalPages,
      has_next: currentPage < totalPages,
      has_previous: currentPage > 1,
    }),
    [currentPage, pageSize, totalRows, totalPages]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  const effectiveWorkflowId = useMemo(() => {
    const fromRedux = Number(selectedWorkflowId);
    if (Number.isFinite(fromRedux) && fromRedux > 0) return fromRedux;
    if (Number.isFinite(Number(lastWorkflowId)) && Number(lastWorkflowId) > 0) {
      return Number(lastWorkflowId);
    }
    return null;
  }, [selectedWorkflowId, lastWorkflowId]);

  const contextKey =
    Number.isFinite(Number(effectiveWorkflowId)) && Number(effectiveWorkflowId) > 0
      ? String(effectiveWorkflowId)
      : undefined;
  const overlayProgress = useAppSelector((state: RootState) =>
    selectModuleProgress(state, "overlayDevelopment", contextKey)
  );
  const overlayData = (overlayProgress?.data ?? {}) as OverlayDevelopmentData;

  const step5Rows = useMemo(() => {
    const checked = overlayData.step5Checked?.rows ?? [];
    const saved = overlayData.step5Selected?.rows ?? [];
    return checked.length ? checked : saved;
  }, [overlayData.step5Checked, overlayData.step5Selected]);

  /** Load saved candidates from Step 5 (Redux-backed) */
  const hydrateFromStep5 = useCallback(() => {
    const wfId = Number(effectiveWorkflowId);
    setErrMsg(null);
    setSaveMsg(null);

    if (!Number.isFinite(wfId)) {
      setModels([]);
      setTotal(undefined);
      setChosenIdx(null);
      setSavedIdx(null);
      setShortlist([]);
      setHasStep5Selection(false);
      return;
    }

    const mapped = step5Rows.map(mapStep5RowToModelSpec);
    setHasStep5Selection(step5Rows.length > 0);
    setModels(mapped);
    setTotal(mapped.length);

    // Rehydrate the saved final selection for this workflow (if any)
    const savedOne = overlayData.step6Selected?.model;
    if (savedOne) {
      const sig = modelSignature(savedOne);
      const idxHere = mapped.findIndex((m: ModelSpec) => modelSignature(m) === sig);
      setChosenIdx(idxHere >= 0 ? idxHere : null);
      setSavedIdx(idxHere >= 0 ? idxHere : null);
    } else {
      setChosenIdx(null);
      setSavedIdx(null);
    }

    // Rehydrate shortlist
    setShortlist(overlayData.step6Shortlist ?? []);
  }, [effectiveWorkflowId, overlayData.step6Selected, overlayData.step6Shortlist, step5Rows]);

  useEffect(() => {
    setLoading(true);
    hydrateFromStep5();
    setLoading(false);
  }, [hydrateFromStep5]);

  /** Auto-refresh when the tab regains focus */
  useEffect(() => {
    const onFocus = () => {
      hydrateFromStep5();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hydrateFromStep5]);

  // Enable export when we have results and not busy
  useEffect(() => {
    const ready =
      Number.isFinite(Number(selectedWorkflowId)) &&
      !loading &&
      !saving &&
      ((models?.length ?? 0) > 0 || (total ?? 0) > 0);
    setExportReady(Boolean(ready));
  }, [selectedWorkflowId, loading, saving, models, total]);

  // Export handler (uses your exact endpoint)
  async function exportCsv() {
    if (!Number.isFinite(selectedWorkflowId)) return;
    setExportErr(null);
    setExporting(true);
    try {
      const url = `${API_BASE}/api/overlay/development/candidate_models/export/?workflow_id=${encodeURIComponent(
        String(selectedWorkflowId)
      )}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/csv,application/json;q=0.9,*/*;q=0.8",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        let msg = `Export failed: HTTP ${res.status}`;
        try {
          const t = await res.text();
          if (t) msg = `${msg} – ${t}`;
        } catch {}
        throw new Error(msg);
      }

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const cd = res.headers.get("content-disposition") || "";
      const nameMatch =
        cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i) ||
        cd.match(/filename=["']?([^"']+)["']?/i);
      const fallback = `candidate_models_${selectedWorkflowId}.csv`;

      if (ct.includes("csv") || ct.startsWith("text/csv")) {
        const blob = await res.blob();
        const filename = (nameMatch && decodeURIComponent(nameMatch[1])) || fallback;
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      } else {
        const json = await res.json();
        const rows: ModelSpec[] = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];
        const headers = deriveCsvHeadersFromModels(rows);
        const csv = toCsv(headers, rows);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = fallback;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      }
    } catch (e: any) {
      setExportErr(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  // Choose & persist single selection; shortlist optional
  function handleChoose(idx: number) {
    setChosenIdx(idx);
    setSaveMsg(null);
  }

  async function handleSaveCandidate() {
    const wfId = Number(effectiveWorkflowId);
    if (!Number.isFinite(wfId)) {
      setErrMsg("Missing or invalid workflowId.");
      return;
    }
    if (chosenIdx == null || !models[chosenIdx]) {
      setErrMsg("Select a candidate model first.");
      return;
    }
    setSaving(true);
    setErrMsg(null);
    try {
      const model = models[chosenIdx];
      const savedAt = new Date().toISOString();
      const sig = modelSignature(model);
      const updated = shortlist.some((m) => modelSignature(m) === sig)
        ? shortlist
        : [...shortlist, model];
      setShortlist(updated);
      dispatch(
        setModuleProgress({
          moduleKey: "overlayDevelopment",
          contextKey: String(wfId),
          data: {
            step6Selected: {
              workflowId: wfId,
              model,
              index: chosenIdx,
              savedAt,
            },
            step6Shortlist: updated,
          } as OverlayDevelopmentData,
        })
      );
      
      // Send to API - only the selected model
      const selectedModelData = (model as any).raw || model;
      
      if (selectedModelData) {
        await postCandidateModels({
          apiBase: API_BASE,
          token,
          workflowId: wfId,
          candidate_models: [selectedModelData],
        });
      }
      
      setSavedIdx(chosenIdx);
      setSaveMsg("Final model saved.");
    } catch (e: any) {
      setErrMsg(e?.message || "Failed to save the final model. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleClearShortlist() {
    const wfId = Number(effectiveWorkflowId);
    setShortlist([]);
    if (Number.isFinite(wfId)) {
      dispatch(
        setModuleProgress({
          moduleKey: "overlayDevelopment",
          contextKey: String(wfId),
          data: { step6Shortlist: [] },
        })
      );
    }
  }
  function handleViewShortlist() {
    // eslint-disable-next-line no-console
    console.log("Shortlist:", shortlist);
    alert(`Shortlist contains ${shortlist.length} model(s). (Open console for details.)`);
  }

  const header = useMemo(
    () => (
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidate Models</h1>

          {!hasStep5Selection && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No selection from <strong>Step 5 (Filtering)</strong>. Please select one or more rows there first.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Shortlist toolbar */}
          <div className="mr-2 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-2 py-1">
            <span className="text-xs text-neutral-700">Shortlist:</span>
            <span className="rounded-md bg-amber-300/80 px-2 py-0.5 text-xs font-semibold text-black">
              {shortlist.length}
            </span>
            <button
              onClick={handleViewShortlist}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-100"
            >
              View
            </button>
            <button
              onClick={handleClearShortlist}
              disabled={!shortlist.length}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <button
            onClick={handleSaveCandidate}
            disabled={
              saving ||
              loading ||
              !Number.isFinite(effectiveWorkflowId as any) ||
              chosenIdx == null ||
              chosenIdx === savedIdx
            }
            className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
            title={
              !effectiveWorkflowId
                ? "Pick a workflow on Step 1"
                : chosenIdx == null
                ? "Select a candidate model first"
                : chosenIdx === savedIdx
                ? "This model is already saved"
                : ""
            }
          >
            {saving ? "Saving…" : "Save Candidate"}
          </button>

          <button
            onClick={() => hydrateFromStep5()}
            disabled={
              saving || loading || !Number.isFinite(effectiveWorkflowId as any)
            }
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title={
              !effectiveWorkflowId
                ? "Pick a workflow on Step 1"
                : "Refresh from Step 5 selection"
            }
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          {/* Export */}
          <button
            onClick={exportCsv}
            disabled={
              !exportReady ||
              exporting ||
              !Number.isFinite(selectedWorkflowId as any)
            }
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title={
              !Number.isFinite(selectedWorkflowId as any)
                ? "Pick a workflow on Step 1"
                : !exportReady
                ? "Load results first"
                : "Download CSV"
            }
          >
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    ),
    [
      saving,
      loading,
      effectiveWorkflowId,
      shortlist.length,
      hasStep5Selection,
      exportReady,
      exporting,
      chosenIdx,
      savedIdx,
      handleSaveCandidate,
      hydrateFromStep5,
    ]
  );



  return (
    <div className="min-h-dvh bg-neutral-50 p-6">
      {header}

      {errMsg && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errMsg}
        </div>
      )}
      {saveMsg && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {saveMsg}
        </div>
      )}
      {exportErr && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {exportErr}
        </div>
      )}


      <div className="relative rounded-2xl bg-yellow-50/60 p-6">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <div className="animate-pulse rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm">
              Loading…
            </div>
          </div>
        )}

        {!hasStep5Selection ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
            No selection from <strong>Step 5</strong>. Go to Filtering (Step 5), select one or more rows, then return here.
          </div>
        ) : (
          <div className="items-center cursor-pointer">
            <div className="mb-4">
              <PaginationControls
                pagination={pagination}
                currentCount={pagedModels.length}
                onPageChange={(page) => setCurrentPage(page)}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                disabled={loading}
              />
            </div>
            <ModelCompareGrid
              models={pagedModels}
              chosenIndex={chosenIdx}
              onChosenIndexChange={handleChoose}
              displayOffset={pageStart}
            />
          </div>
        )}

        {!loading && models.length === 0 && !errMsg && (
          <p className="mt-3 text-sm text-neutral-600">No candidate models found for this page.</p>
        )}
      </div>
    </div>
  );
};

export default Step6;