// Step6.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ModelCompareGrid,
  type ModelSpec,
} from "../../../../components/overlay/development/candidate_model/ModelCompareGrid";
import { useAppSelector } from "../../../../redux_toolkit/hooks";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

const LEGACY_SELECTED_KEY = "ecl:selectedModel";   // kept for Step 7 compatibility
const SINGLE_SELECTED_PREFIX = "ecl:selectedmodels:"; // per-workflow single selection (exactly one)
const SHORTLIST_PREFIX = "ecl:shortlist:";         // optional favorites
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/* ---------- Types ---------- */
type SavedShortlist = {
  workflowId: number;
  models: ModelSpec[];
  savedAt: string;
};
type Step5Persist = {
  ids: Array<string | number>;
  rows: any[];
  savedAt: string;
};
type SinglePersist = {
  workflowId: number;
  models: ModelSpec[];       // always length 1
  index?: number;            // optional UI index on the page where it was selected
  savedAt: string;
};

/* ---------- Keys / helpers ---------- */
const shortlistKeyFor = (workflowId: number | string) => `${SHORTLIST_PREFIX}${workflowId}`;
const step5StorageKey = (workflowId: number | string) => `overlay:step5:selected:${workflowId}`;
const singleKeyFor = (workflowId: number | string) => `${SINGLE_SELECTED_PREFIX}${workflowId}`;

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

function mapStep5RowToModelSpec(row: any): ModelSpec {
  const title = `${row?.Y ?? "Model"}: ${row?.X1 ?? "-"} | ${row?.X2 ?? "-"}`;
  const variables = [
    {
      name: String(row?.X1 ?? "X1"),
      coeff_X1: Number(row?.coeff_X1 ?? row?.coeff_x1 ?? 0),
      "p-value_X1": row?.["p-value_X1"] ?? row?.p_value_X1 ?? row?.["p-value_x1"] ?? row?.p_value_x1,
      vif_X1: row?.vif_X1 ?? row?.vif_x1,
      raw: row?.coeff_X1 ?? row?.coeff_x1,
    },
    {
      name: String(row?.X2 ?? "X2"),
      coeff_X1: Number(row?.coeff_X2 ?? row?.coeff_x2 ?? 0),
      "p-value_X1": row?.["p-value_X2"] ?? row?.p_value_X2 ?? row?.["p-value_x2"] ?? row?.p_value_x2,
      vif_X1: row?.vif_X2 ?? row?.vif_x2,
      raw: row?.coeff_X2 ?? row?.coeff_x2,
    },
  ];

  return {
    title,
    variables,
    metrics: {
      Adj_R_Squared: row?.Adj_R_Squared,
      RMSE: row?.RMSE,
      MAPE: row?.MAPE,
      R_Squared: row?.R_Squared,
    },
    raw: row,
    index: row?.index,
    Y: row?.Y,
    X1: row?.X1,
    X2: row?.X2,
    R_Squared: row?.R_Squared,
    Adj_R_Squared: row?.Adj_R_Squared,
    MAPE: row?.MAPE,
  };
}

/* ---------- Step 5 selection ---------- */
function loadSelectedRowsFromStep5(workflowId: number): any[] {
  try {
    const raw = localStorage.getItem(step5StorageKey(workflowId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Step5Persist;
    return Array.isArray(parsed?.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
}

/* ---------- Shortlist ---------- */
function loadShortlist(workflowId: number): ModelSpec[] {
  try {
    const raw = localStorage.getItem(shortlistKeyFor(workflowId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedShortlist;
    if (Number(parsed?.workflowId) !== Number(workflowId)) return [];
    return Array.isArray(parsed.models) ? parsed.models : [];
  } catch {
    return [];
  }
}
function saveShortlist(workflowId: number, models: ModelSpec[]) {
  const payload: SavedShortlist = {
    workflowId,
    models,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(shortlistKeyFor(workflowId), JSON.stringify(payload));
}
function addToShortlist(workflowId: number, shortlist: ModelSpec[], model: ModelSpec): ModelSpec[] {
  const sig = modelSignature(model);
  const exists = shortlist.some((m) => modelSignature(m) === sig);
  const next = exists ? shortlist : [...shortlist, model];
  saveShortlist(workflowId, next);
  return next;
}
function clearShortlist(workflowId: number) {
  saveShortlist(workflowId, []);
}

/* ---------- Single-selection (exactly one per workflow) ---------- */
function saveSingleSelection(workflowId: number, idx: number, model: ModelSpec) {
  const payload: SinglePersist = {
    workflowId,
    models: [model], // enforce only one selected model
    index: idx,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(singleKeyFor(workflowId), JSON.stringify(payload));

  // Keep legacy key for Step 7 compatibility (Step 7 reads this)
  // We include model.raw if present so Step 7 can post the exact raw row.
  localStorage.setItem(
    LEGACY_SELECTED_KEY,
    JSON.stringify({
      index: idx,
      model,           // contains .raw if provided by backend
      workflowId,
      savedAt: payload.savedAt,
    })
  );
}
function loadSingleSelection(
  workflowId: number
): { index: number | null; model: ModelSpec | null } {
  try {
    const raw = localStorage.getItem(singleKeyFor(workflowId));
    if (!raw) return { index: null, model: null };
    const parsed = JSON.parse(raw) as SinglePersist;
    const m = Array.isArray(parsed?.models) && parsed.models[0] ? parsed.models[0] : null;
    return {
      index: typeof parsed?.index === "number" ? parsed.index : null,
      model: m,
    };
  } catch {
    return { index: null, model: null };
  }
}

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
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } = useSelector(
    (s: RootState) => (s as any).pdTransitionMatrixWfHelper
  );
  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const [models, setModels] = useState<ModelSpec[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [total, setTotal] = useState<number | undefined>(undefined);
  // pagination state retained for API parity (UI uses page=1)
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [savedIdx, setSavedIdx] = useState<number | null>(null);
  const [shortlist, setShortlist] = useState<ModelSpec[]>([]);
  const [hasStep5Selection, setHasStep5Selection] = useState<boolean>(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  /** Load saved candidates from Step 5 */
  const loadCandidatesFromStep5 = useCallback(
    async () => {
      const wfId = Number(selectedWorkflowId);
      if (!Number.isFinite(wfId)) {
        setErrMsg("Missing or invalid workflowId.");
        return;
      }

      setLoading(true);
      setErrMsg(null);
      setSaveMsg(null);
      try {
        const step5Rows = loadSelectedRowsFromStep5(wfId);
        setHasStep5Selection(step5Rows.length > 0);
        const mapped = step5Rows.map(mapStep5RowToModelSpec);
        setModels(mapped);
        setTotal(mapped.length);

        // Rehydrate the saved final selection for this workflow (if any)
        const { model: savedOne } = loadSingleSelection(wfId);
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
        setShortlist(loadShortlist(wfId));
      } catch (e: any) {
        setModels([]);
        setTotal(undefined);
        setTotal(undefined);
        setErrMsg(e?.message || "Failed to load candidate models.");
        setChosenIdx(null);
        setSavedIdx(null);
      } finally {
        setLoading(false);
      }
    },
    [selectedWorkflowId]
  );

  useEffect(() => {
    loadCandidatesFromStep5();
    console.log('ss')
  }, [])
  /** Auto-fetch on mount & whenever workflow changes (page reset) */
  useEffect(() => {
    const wfId = Number(selectedWorkflowId);
    if (!Number.isFinite(wfId)) return;
    setPage(1);
    loadCandidatesFromStep5();
  }, [selectedWorkflowId, pageSize, loadCandidatesFromStep5]);

  /** Optional: auto-refresh when the tab regains focus */
  useEffect(() => {
    const onFocus = () => {
      const wfId = Number(selectedWorkflowId);
      if (!Number.isFinite(wfId)) return;
      loadCandidatesFromStep5();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [selectedWorkflowId, pageSize, loadCandidatesFromStep5]);

  /** Optional: react to Step 5 updates (localStorage event) */
  useEffect(() => {
    const wfId = Number(selectedWorkflowId);
    if (!Number.isFinite(wfId)) return;

    const key = step5StorageKey(wfId);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        const hasSel = loadSelectedRowsFromStep5(wfId).length > 0;
        setHasStep5Selection(hasSel);
        loadCandidatesFromStep5();
      }
    };
    const onSaved = (e: Event) => {
      const detail = (e as CustomEvent)?.detail as { workflowId?: number } | undefined;
      if (detail?.workflowId && Number(detail.workflowId) !== wfId) return;
      const hasSel = loadSelectedRowsFromStep5(wfId).length > 0;
      setHasStep5Selection(hasSel);
      loadCandidatesFromStep5();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("overlay:step5:saved", onSaved as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("overlay:step5:saved", onSaved as EventListener);
    };
  }, [selectedWorkflowId, pageSize, loadCandidatesFromStep5]);

  // Enable export when we have results and not busy
  useEffect(() => {
    const ready =
      Number.isFinite(Number(selectedWorkflowId)) &&
      !loading &&
      !saving &&
      ((models?.length ?? 0) > 0 || (total ?? 0) > 0);
    setExportReady(Boolean(ready));
  }, [selectedWorkflowId, loading, saving, models, total]);

  // Refetch when user changes page or pageSize after trigger
  useEffect(() => {
    if (!Number.isFinite(Number(selectedWorkflowId))) return;
    loadCandidatesFromStep5();
  }, [page, pageSize, selectedWorkflowId, loadCandidatesFromStep5]);

  // Reset on workflow change
  useEffect(() => {
    setModels([]);
    setTotal(undefined);
    setErrMsg(null);
    setChosenIdx(null);
    setSavedIdx(null);
    setSaveMsg(null);

    const wfId = Number(selectedWorkflowId);
    const step5Rows = loadSelectedRowsFromStep5(wfId);
    setHasStep5Selection(step5Rows.length > 0);

    if (Number.isFinite(wfId)) {
      setShortlist(loadShortlist(wfId));
    } else {
      setShortlist([]);
    }
  }, [selectedWorkflowId]);

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

  function handleSaveCandidate() {
    const wfId = Number(selectedWorkflowId);
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
      saveSingleSelection(wfId, chosenIdx, model);
      const updated = addToShortlist(wfId, shortlist, model);
      setShortlist(updated);
      setSavedIdx(chosenIdx);
      setSaveMsg("Final model saved.");
    } catch {
      setErrMsg("Failed to save the final model. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleClearShortlist() {
    const wfId = Number(selectedWorkflowId);
    clearShortlist(wfId);
    setShortlist([]);
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
          <h1 className="text-2xl font-semibold tracking-tight">Final Overlay Model</h1>
          <p className="mt-1 max-w-3xl text-base text-neutral-700">
            Pick a candidate model and click Save Candidate to set the final model.
          </p>

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
              !Number.isFinite(selectedWorkflowId as any) ||
              chosenIdx == null ||
              chosenIdx === savedIdx
            }
            className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
            title={
              !selectedWorkflowId
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
            onClick={() => loadCandidatesFromStep5()}
            disabled={
              saving || loading || !Number.isFinite(selectedWorkflowId as any)
            }
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title={
              !selectedWorkflowId
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
      selectedWorkflowId,
      shortlist.length,
      hasStep5Selection,
      exportReady,
      exporting,
      chosenIdx,
      savedIdx,
      handleSaveCandidate,
      loadCandidatesFromStep5,
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
            <ModelCompareGrid
              models={models}
              chosenIndex={chosenIdx}
              onChosenIndexChange={handleChoose}
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