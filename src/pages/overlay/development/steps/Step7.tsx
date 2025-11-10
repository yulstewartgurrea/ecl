// Step7.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ModelSpec } from "../../../../components/overlay/development/candidate_model/ModelCompareGrid";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { useAppSelector } from "../../../../redux_toolkit/hooks";
import { postFinalModel } from "../../../../services/finalModels";   // ← NEW
const LS_KEY = "ecl:selectedModel";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const Step7: React.FC = () => {
  const [model, setModel] = useState<ModelSpec | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  // get workflow id + token like other steps
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);
  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setModel(parsed?.model ?? null);
    } catch {
      setModel(null);
    }
  }, []);

  async function saveSelectedModel() {
    setErr(null);
    if (!model) {
      setErr("No model selected. Please go back to Step 6 and choose a model.");
      return;
    }
    if (!Number.isFinite(Number(selectedWorkflowId))) {
      setErr("Missing or invalid workflow id. Please select a workflow in Step 1.");
      return;
    }
    
    setSaving(true);
    try {
      // By default: { workflow_id, final_models: [model] } as JSON
      await postFinalModel({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        model,
        payloadKey: "final_models",   // or "selected_model" if your backend requires
        asArray: true,                // send as array [model]; set false for single object
        // useFormData: true,         // uncomment if your backend insists on multipart
      });

      // clean up local cache and show the modal
      localStorage.removeItem(LS_KEY);
      setShowModal(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to save the selected model.");
    } finally {
      setSaving(false);
    }
  }

  if (!model) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">No model selected</h2>
        <p className="mt-2 text-neutral-600">
          Please go back to Step 6 and choose a model to proceed.
        </p>
        <button
          onClick={() => navigate("/overlay?tab=development&sub=5")}
          className="mt-4 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-neutral-800"
        >
          ← Back to Step 6
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Selected Model Summary</h1>
          <p className="mt-1 text-neutral-700">
            You chose <span className="font-semibold">{model.title}</span> in Step 6.
          </p>
        </div>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {err}
          </div>
        )}

        {/* Selection banner */}
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-neutral-900">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 font-semibold text-black">✓</span>
            <p className="text-base">
              <span className="font-medium">{model.title}</span> is locked in for your ECL computation.
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-700 text-white">
              <tr>
                <th className="px-4 py-3 text-sm font-medium">Variable</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Coefficient</th>
                <th className="px-4 py-3 text-right text-sm font-medium">P-Value</th>
                <th className="px-4 py-3 text-right text-sm font-medium">VIF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {model.variables?.length ? (
                model.variables.map((v, i) => (
                  <tr key={i} className={i % 2 ? "bg-neutral-50/40" : ""}>
                    <td className="px-4 py-3 text-neutral-800">{v.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtNumber(v.coeff_X1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtPctOrVal(v["p-value_X1"])}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtPctOrVal((v as any).vif_X1)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    No variables
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Key metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile label="Adj. R²" value={fmtPercent(model.metrics.Adj_R_Squared)} />
          <StatTile label="RMSE" value={fmtNumber(model.metrics.RMSE)} />
          <StatTile label="MAPE" value={fmtPctOrVal(model.metrics.MAPE)} />
        </div>

        {/* Actions */}
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => {
              // TODO: implement exporting your model/summary
            }}
            className="cursor-pointer rounded-xl border border-neutral-300 bg-white px-4 py-2 text-neutral-800"
          >
            ⬇️ Download
          </button>

          <button
            onClick={saveSelectedModel}     // ← POST to server
            disabled={saving}
            className="cursor-pointer rounded-xl bg-neutral-900 px-4 py-2 font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save & Finish →"}
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <div className="space-y-3 text-center">
            <h3 className="text-lg font-semibold">Model saved successfully</h3>
            <p className="text-sm text-neutral-700">
              Please click the <span className="font-medium">Execution</span> toggle at the
              <span className="font-medium"> top-right</span> of the screen to continue.
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
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-end">
          <button onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
            ✕
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
      <div className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums">{value}</div>
    </div>
  );
}

/* ---------- Format helpers ---------- */
function fmtNumber(v?: number): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
}
function fmtPercent(v?: number): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return (Number(v) * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%";
}
function fmtPctOrVal(v: number | string | undefined): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (v >= 0 && v <= 1) return (v * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + "%";
  return v.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export default Step7;