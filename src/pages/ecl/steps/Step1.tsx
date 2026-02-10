// ==========================
// pages/flowrate/steps/Step1.tsx
// ==========================
import { useState, useEffect, useCallback, useMemo } from "react";
import UploadDropzone from "../../../components/ui/UploadDropzone";
import OverlayUploadResultModal from "../../../components/modals/OverlayUploadResultModal";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useAppSelector, useAppDispatch } from "../../../redux_toolkit/hooks";
import { setModuleProgress } from "../../../redux_toolkit/features/progress/moduleProgressSlice";
import { normalizeUploadError } from "../../../utils/uploadErrorNormalizer";
import WorkflowPickerModal from "../../../components/modals/WorkflowPickerModal";
import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWorkflowId,
  setPdTransitionMatrixSelectedLoanProduct,
  setPdTransitionMatrixWorkflowData,
} from "../../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
import type { Workflow } from "../../../services/workflow";
import { useUploadManager } from "../../../hooks/useUploadManager";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const ECL_DOC_TYE = "ECL_CLIENT_LOAN_BALANCES";

const toNumberSafe = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const pathBuilder = (ctx: { entity: string; cadence: string; wf: string | number; loanProduct: string; subdir?: string; categoryKey: string }) => {
  const { entity, cadence, wf, loanProduct, subdir } = ctx;
  return [entity, cadence, String(wf), loanProduct, subdir].filter(Boolean).join("/");
};

type ExistingDocFile = File & {
  isExisting?: boolean;
  documentId?: number | string;
  sizeBytes?: number;
  serverFilename?: string;
  createdAt?: string;
};

export default function Step1() {
  const dispatch = useAppDispatch();

  const {
    pdTransitionMatrixWfName,
    currentPdTransitionMatrixWorkflowId,
    currentPdTransitionMatrixWorkflowData,
    selectedPdTransitionMatrixEntity,
    selectedPdTransitionMatrixReportingPeriod,
    selectedPdTransitionMatrixLoanProduct,
    selectedPdTransitionMatrixReportDateStart,
  } = useAppSelector((state: any) => state.pdTransitionMatrixWfHelper);

  const token = useAppSelector((state: any) => state.auth?.token) as string | null;

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [isUploaded, setUploaded] = useState(false);
  const [isFailed, setFailed] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [skipFetchExisting, setSkipFetchExisting] = useState(false);

  const workflowIdFromRedux =
    currentPdTransitionMatrixWorkflowId ?? currentPdTransitionMatrixWorkflowData?.id;
  const workflowId = Number.isFinite(Number(workflowIdFromRedux))
    ? Number(workflowIdFromRedux)
    : undefined;

  const entity =
    currentPdTransitionMatrixWorkflowData?.entity || selectedPdTransitionMatrixEntity;
  const period =
    currentPdTransitionMatrixWorkflowData?.reporting_period ||
    selectedPdTransitionMatrixReportingPeriod
  const wfName =
    currentPdTransitionMatrixWorkflowData?.workflow_name || pdTransitionMatrixWfName;
  const loanProduct =
    currentPdTransitionMatrixWorkflowData?.loan_product ||
    selectedPdTransitionMatrixLoanProduct
  const reportDateStart =
    currentPdTransitionMatrixWorkflowData?.report_date_start ||
    selectedPdTransitionMatrixReportDateStart

  // Only allow upload if workflow is selected
  const hasSelectedWorkflow = Boolean(workflowId || wfName);
  console.log('hasSelectedWorkflow: ',wfName, ",", hasSelectedWorkflow, workflowId, pdTransitionMatrixWfName, wfName)
  const context = {
    entity,
    cadence: period,
    wf: wfName,
    loanProduct,
    reportDateStart,
    subdir: "input/flowrate_approach",
  };

  const workflowPath = [entity, period, wfName, loanProduct].filter(Boolean).join("/");
  const progressKey = workflowPath || (workflowId ? `wf:${workflowId}` : undefined);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  const uploadManager = useUploadManager({
    uploadFn: async ({ file, override }) => {
      if (!hasSelectedWorkflow) return;

      setUploading(true);
      const workflowPath = pathBuilder({ ...context, categoryKey: ECL_DOC_TYE });

      const form = new FormData();
      form.append("file", file);
      form.append("workflow_path", workflowPath);
      form.append("document_type", ECL_DOC_TYE);
      form.append("workflow_id", String(workflowId));
      form.append("override", String(override));
      form.append("module", "FLOWRATE_APPROACH");
      form.append("submodule", "");

      try {
        const response = await fetch(`${API_BASE}/api/document/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.success === false) {
          setFailed(true);
          setUploaded(false);
          throw {
            fileName: file.name,
            status: response.status || 0,
            ok: false,
            kind: "error",
            payload,
            normalized: normalizeUploadError(payload),
          };
        }

        setUploaded(true);
        setFailed(false);
        setSkipFetchExisting(true);
        setTimeout(() => setSkipFetchExisting(false), 2000);
      } finally {
        setUploading(false);
      }
    },
  });

  const fetchExistingDocument = useCallback(async () => {
    if (!workflowId || !token) {
      setFile(null);
      return;
    }
    if (skipFetchExisting) return;

    try {
      const response = await fetch(
        `${API_BASE}/documents/workflow-documents/?workflow_id=${workflowId}&document_types=${ECL_DOC_TYE}`,
        {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }
      );

      if (!response.ok) return setFile(null);

      const result = await response.json();
      if (!result?.success || !Array.isArray(result.data) || result.data.length === 0) return setFile(null);

      const doc = result.data[0];
      const mime =
        doc.filename.endsWith(".csv")
          ? "text/csv"
          : doc.filename.endsWith(".xlsx")
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/vnd.ms-excel";

      const existingFile: ExistingDocFile = new File([], doc.original_filename || doc.filename, { type: mime }) as ExistingDocFile;
      existingFile.isExisting = true;
      existingFile.documentId = doc.id;
      existingFile.sizeBytes = toNumberSafe(doc.size_bytes ?? doc.size ?? doc.bytes ?? doc.file_size);
      existingFile.serverFilename = doc.filename;
      existingFile.createdAt = doc.created_at;

      setFile(existingFile);
      setUploaded(true);
      setFailed(false);
    } catch (err) {
      console.error("Failed to fetch existing document:", err);
      setFile(null);
    }
  }, [workflowId, token, skipFetchExisting]);

  useEffect(() => {
    fetchExistingDocument();
  }, [fetchExistingDocument]);

  const handlePickWorkflow = useCallback(
    (w: Workflow) => {
      const nextEntity = (w as any).entity ?? "";
      const nextPeriod = (w as any).reporting_period ?? (w as any).reportingPeriod ?? "";
      const nextName = (w as any).workflow_name ?? (w as any).name ?? "";
      const nextId = typeof (w as any).id === "number" ? (w as any).id : null;
      const nextLoanProduct = (w as any).loan_product ?? (w as any).loanProduct ?? "";

      if (nextEntity) dispatch(setPdTransitionMatrixSelectedEntity({ entity: nextEntity }));
      if (nextPeriod) dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: nextPeriod }));
      if (nextName) dispatch(setPdTransitionMatrixWfName({ workflow_name: nextName }));
      if (nextLoanProduct) dispatch(setPdTransitionMatrixSelectedLoanProduct({ loan_product: nextLoanProduct }));
      dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: nextId }));
      dispatch(setPdTransitionMatrixWorkflowData({ workflow_data: w as any }));

      setPickerOpen(false);
    },
    [dispatch]
  );

  const uploadStatus = useMemo(() => {
    if (!file) return { status: "empty", message: "No file uploaded yet." };
    if (isUploading) return { status: "uploading", message: "Uploading..." };
    if (isFailed) return { status: "error", message: "Upload failed." };
    if (isUploaded) return { status: "success", message: "File uploaded successfully." };
    return { status: "idle", message: "Waiting for upload." };
  }, [file, isUploading, isUploaded, isFailed]);

  useEffect(() => {
    if (!progressKey) return;
    const step1Valid = uploadStatus.status === "success";
    dispatch(
      setModuleProgress({
        moduleKey: "flowrate",
        contextKey: progressKey,
        data: {
          workflowId,
          workflowPath,
          step1Valid,
          step1Status: uploadStatus.status,
          step1Message: uploadStatus.message,
        },
      })
    );
  }, [dispatch, progressKey, workflowId, workflowPath, uploadStatus]);

  const handleReset = () => {
    setFile(null);
    setUploaded(false);
    setFailed(false);
    setUploading(false);
    setSuccessBanner(null);
    setPickerOpen(false);
    uploadManager.setModalOpen(false);
  };

  return (
    <div className="mx-auto max-w-8xl">
      {successBanner && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-center justify-between">
            <span>{successBanner}</span>
            <button onClick={handleReset} className="ml-2 text-emerald-600 hover:text-emerald-800" title="Dismiss success message">
              x
            </button>
          </div>
        </div>
      )}

      <OverlayUploadResultModal
        open={uploadManager.modalOpen}
        issues={uploadManager.issues}
        isSubmitting={false}
        onClose={handleReset}
        onProceed={async () => {
          if (file) await uploadManager.startUpload(file, true);
          uploadManager.setModalOpen(false);
        }}
      />

      <div className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">Inputs</h3>
            <p className="mt-1 text-xs text-gray-600">Workflow: {pdTransitionMatrixWfName || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer"
              disabled={isUploading}
              title="Pick from completed workflows"
            >
              Switch Workflow
            </button>

            {hasSelectedWorkflow && uploadStatus.status === "success" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                Uploaded
              </span>
            )}
            {uploadStatus.status === "uploading" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-top-transparent" />
                Uploading
              </span>
            )}
            {uploadStatus.status === "error" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Upload Failed
              </span>
            )}
            {!hasSelectedWorkflow && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400">
                Please select a workflow to upload
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-2">
            <div className="relative">
              <UploadDropzone
                  label="ECL"
                description="CSV or Excel. Filename can be 'client loan balances' or anything with 'ecl'."

                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                value={file ? [file] : []}
                disabled={!hasSelectedWorkflow || uploadStatus.status === "uploading"} // 🔹 Disable if no workflow
                onChange={(selectedFiles) => {
                  const firstFile = selectedFiles.length > 0 ? selectedFiles[0] : null;
                  setFile(firstFile);
                  if (firstFile) {
                    setUploaded(false);
                    setFailed(false);
                    setSkipFetchExisting(false);
                    uploadManager.onFilesSelected([firstFile]);
                  }
                }}
                emptyHint={!hasSelectedWorkflow ? "Select a workflow first" : "Waiting for ecl file"}
              />

              {isUploaded && file && hasSelectedWorkflow && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircleIcon className="h-3 w-3" />
                    Uploaded
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <WorkflowPickerModal
        open={pickerOpen}
        token={token}
        onClose={handleReset}
        onSelect={handlePickWorkflow}
      />
    </div>
  );
}
