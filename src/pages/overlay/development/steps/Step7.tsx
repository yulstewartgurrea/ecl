// Step7.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { ModelSpec } from "../../../../components/overlay/development/candidate_model/ModelCompareGrid";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { useAppDispatch, useAppSelector } from "../../../../redux_toolkit/hooks";
import {
  selectModuleProgress,
  setModuleProgress,
} from "../../../../redux_toolkit/features/progress/moduleProgressSlice";
import { postFinalModel } from "../../../../services/finalModels"; //   uses your existing service

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const Step7: React.FC = () => {
  const [model, setModel] = useState<ModelSpec | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => (s as any).pdTransitionMatrixWfHelper);
  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;
  const overlayRoot = useAppSelector((state: RootState) =>
    selectModuleProgress(state, "overlayDevelopment")
  );
  const lastWorkflowId = (overlayRoot?.data as any)?.lastWorkflowId as
    | number
    | undefined;

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

  // Helper to find column case-insensitively
  function findColumn(row: any, colName: string): any {
    if (!row) return undefined;
    const colLower = colName.toLowerCase();
    for (const key in row) {
      if (key.toLowerCase() === colLower) {
        return row[key];
      }
    }
    return undefined;
  }

  // Helper to find all X columns dynamically (X1, X2, X3, ..., Xn)
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

  // Helper to map raw model data to ModelSpec
  function mapRowToModelSpec(row: any): ModelSpec {
    // Find all X columns dynamically
    const xColumns = findAllXColumns(row);
    
    // Build title with all X variables
    const xNames = xColumns.length > 0 
      ? xColumns.map(x => x.value).join(" | ")
      : "-";
    const title = `${row?.Y ?? findColumn(row, "Y") ?? "Model"}: ${xNames}`;
    
    // Build variables array dynamically
    const variables = xColumns.map((xCol) => {
      const xName = xCol.name;
      
      // Find coefficient (case-insensitive)
      const coeffKey = `coeff_${xName}`;
      const coeff = findColumn(row, coeffKey) ?? 0;
      
      // Find p-value (case-insensitive, multiple formats)
      const pvalKey1 = `p-value_${xName}`;
      const pvalKey2 = `p_value_${xName}`;
      const pval = findColumn(row, pvalKey1) ?? findColumn(row, pvalKey2);
      
      // Find VIF (case-insensitive)
      const vifKey = `vif_${xName}`;
      const vif = findColumn(row, vifKey);
      
      return {
        name: String(xCol.value),
        coeff_X1: Number(coeff), // Keep field name for compatibility
        "p-value_X1": pval, // Keep field name for compatibility
        vif_X1: vif, // Keep field name for compatibility
        raw: coeff,
      };
    });

    // Build X object dynamically (X1, X2, X3, etc.)
    const xObject: Record<string, any> = {};
    xColumns.forEach((xCol) => {
      xObject[xCol.name] = xCol.value;
    });

    return {
      title,
      variables,
      metrics: {
        Adj_R_Squared: findColumn(row, "Adj_R_Squared") ?? findColumn(row, "adj_r_squared"),
        RMSE: findColumn(row, "RMSE") ?? findColumn(row, "rmse"),
        MAPE: findColumn(row, "MAPE") ?? findColumn(row, "mape"),
        R_Squared: findColumn(row, "R_Squared") ?? findColumn(row, "r_squared"),
      },
      raw: row,
      index: findColumn(row, "index"),
      Y: findColumn(row, "Y") ?? findColumn(row, "y"),
      ...xObject, // Spread all X columns dynamically
      R_Squared: findColumn(row, "R_Squared") ?? findColumn(row, "r_squared"),
      Adj_R_Squared: findColumn(row, "Adj_R_Squared") ?? findColumn(row, "adj_r_squared"),
      MAPE: findColumn(row, "MAPE") ?? findColumn(row, "mape"),
      
    };
  }

  // Fetch final models from API if no data in Redux
  const fetchFinalModels = useCallback(async () => {
    const wfId = Number(effectiveWorkflowId);
    if (!Number.isFinite(wfId) || !token) return;

    setLoading(true);
    setErr(null);
    try {
      const url = `${API_BASE}/api/overlay/development/final_models/?workflow_id=${encodeURIComponent(wfId)}&page=1&page_size=1`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch final models`);
      }

      const json = await res.json();
      // API returns: { success: true, data: [...], pagination: {...} }
      // data is the array directly, not nested
      if (json?.success && json?.data && Array.isArray(json.data) && json.data.length > 0) {
        // Take the first model from the response
        const firstModel = json.data[0];
        const modelSpec = mapRowToModelSpec(firstModel);
        setModel(modelSpec);
      } else {
        console.log("No final models found in API response:", json);
      }
    } catch (e: any) {
      console.warn("Failed to fetch final models from API:", e);
      // Don't set error - just silently fail if API doesn't have data
    } finally {
      setLoading(false);
    }
  }, [effectiveWorkflowId, token]);

  useEffect(() => {
    const data = (overlayProgress?.data ?? {}) as {
      step6Selected?: { model?: ModelSpec | null };
    };
    const redxModel = (data.step6Selected?.model as ModelSpec) ?? null;
    
    if (redxModel) {
      // Prefer Redux model if available
      setModel(redxModel);
    } else if (effectiveWorkflowId && token) {
      // If no data in Redux but we have workflowId and token, fetch from API
      fetchFinalModels();
    } else {
      // No workflowId or token, clear model
      setModel(null);
    }
  }, [overlayProgress, effectiveWorkflowId, token, fetchFinalModels]);

  async function saveSelectedModel() {
    setErr(null);
    if (!model) {
      setErr("No model selected. Please go back to Step 6 and choose a model.");
      return;
    }
    const wfId = Number(effectiveWorkflowId);
    if (!Number.isFinite(wfId)) {
      setErr(
        "Missing or invalid workflow id. Please select a workflow in Step 1."
      );
      return;
    }

    // Prefer the raw record (exact shape you showed) if present:
    // [
    //   {
    //     "index": 23041,
    //     "Y": "odr.logit",
    //     "X1": "rrp_rate",
    //     "X2": "gni_growth_12m",
    //     ...
    //   }
    // ]
    const rawPayload = (model as any)?.raw ?? model; // fallback to model if raw missing

    setSaving(true);
    console.log("rawPayload: ", rawPayload);
    try {
      await postFinalModel({
        apiBase: API_BASE,
        token,
        workflowId: wfId,
        model: rawPayload, // single object
        payloadKey: "final_models",
        asArray: true, // send as array [rawPayload]
        // useFormData: true,      // enable only if backend needs multipart
      });

      if (contextKey) {
        dispatch(
          setModuleProgress({
            moduleKey: "overlayDevelopment",
            contextKey,
            data: { step6Selected: null },
          })
        );
      }
      setShowModal(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to save the selected model.");
    } finally {
      setSaving(false);
    }
  }

  // Download handler: use export API
  async function handleDownload() {
    if (!model) return;

    const wfId = Number(effectiveWorkflowId);
    if (!Number.isFinite(wfId)) {
      setErr("Missing or invalid workflow id.");
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const url = `${API_BASE}/api/overlay/development/final_models/export/?workflow_id=${encodeURIComponent(wfId)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/csv,application/json",
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
      const fallback = `final_models_${wfId}.csv`;

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
        // If server returns JSON, convert to CSV
        const json = await res.json();
        const rows = Array.isArray(json?.data?.data) ? json.data.data : Array.isArray(json?.data) ? json.data : [];
        if (rows.length === 0) {
          throw new Error("No data to export");
        }
        // Use first row for CSV conversion
        const headers = Object.keys(rows[0] || {});
        const csvLines = [
          headers.join(","),
          ...rows.map((r: any) => headers.map((h) => {
            const val = r[h];
            if (val == null) return "";
            const s = String(val);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          }).join(","))
        ];
        const csv = "\uFEFF" + csvLines.join("\r\n");
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
      setErr(e?.message || "Export failed");
    } finally {
      setLoading(false);
    }
  }

  if (!model) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">
          {loading ? "Loading final model..." : "No model selected"}
        </h2>
        <p className="mt-2 text-neutral-600">
          {loading
            ? "Fetching final model from server..."
            : "Please go back to Step 6 and choose a model to proceed."}
        </p>
        {!loading && (
          <button
            onClick={() => navigate("/overlay?tab=development&sub=6")}
            className="mt-4 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-neutral-800"
          >
            Back to Step 6
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Final Model
          </h1>
        </div>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {err}
          </div>
        )}

        {/* Selection banner */}
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-neutral-900">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 font-semibold text-black">
               
            </span>
            <p className="text-base">
              <span className="font-medium">{model.title}</span> is locked in
              for your ECL computation.
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-700 text-white">
              <tr>
                <th className="px-4 py-3 text-sm font-medium">Variable</th>
                <th className="px-4 py-3 text-right text-sm font-medium">
                  Coefficient
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium">
                  P-Value
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium">
                  VIF
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {model.variables?.length ? (
                model.variables.map((v, i) => (
                  <tr key={i} className={i % 2 ? "bg-neutral-50/40" : ""}>
                    <td className="px-4 py-3 text-neutral-800">{v.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtNumber(v.coeff_X1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtPctOrVal(v["p-value_X1"])}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtPctOrVal((v as any).vif_X1)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-neutral-500"
                  >
                    No variables
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Key metrics (keep consistent with Step 6) */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile
            label="RMSE"
            value={fmtPercent(
              (model.metrics as any)?.RMSE ?? (model as any)?.RMSE
            )}
          />
          <StatTile
            label="Adj. R²"
            value={fmtPercent(
              model.metrics?.Adj_R_Squared ?? (model as any)?.Adj_R_Squared
            )}
          />
          <StatTile
            label="MAPE"
            value={fmtPctOrVal(model.metrics?.MAPE ?? (model as any)?.MAPE)}
          />
        </div>

        {/* Actions */}
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={handleDownload}
            disabled={loading || !model}
            className="cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-2 text-neutral-800 disabled:opacity-50"
          >
            {loading ? "Exporting..." : "Download"}
          </button>

          <button
            onClick={saveSelectedModel} //   POST to server
            disabled={saving}
            className="cursor-pointer rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50"
          >
            {saving ? "Saving " : "Save & Finish  "}
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <div className="space-y-3 text-center">
            <h3 className="text-lg font-semibold">Model saved successfully</h3>
            <p className="text-sm text-neutral-700">
              Please click the <span className="font-medium">Execution</span>{" "}
              toggle at the
              <span className="font-medium"> top-right</span> of the screen to
              continue.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800"
              >
                Close
              </button>
              <button
                onClick={() => navigate("/overlay?tab=execution")}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Proceed to Execution
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

/* ---------- Modal ---------- */
function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-end">
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
            aria-label="Close"
          >
            
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

/* ---------- Format helpers ---------- */
function fmtNumber(v?: number): string {
  if (v == null || Number.isNaN(Number(v))) return " ";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function fmtPercent(v?: number): string {
  if (v == null || Number.isNaN(Number(v))) return " ";
  return (
    (Number(v) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) +
    "%"
  );
}
function fmtPctOrVal(v: number | string | undefined): string {
  if (v == null) return " ";
  if (typeof v === "string") return v;
  if (v >= 0 && v <= 1)
    return (
      (v * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%"
    );
  return v.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

// Helper for downloading Excel (.xls) from HTML
// function downloadExcelFile(html: string, filename: string) {
//   try {
//     const blob = new Blob([html], {
//       type: "application/vnd.ms-excel;charset=utf-8;",
//     });
//     const url = URL.createObjectURL(blob);

//     const a = document.createElement("a");
//     a.href = url;
//     a.download = filename;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();

//     URL.revokeObjectURL(url);
//   } catch (e) {
//     console.error("Failed to download Excel file", e);
//   }
// }

export default Step7;

