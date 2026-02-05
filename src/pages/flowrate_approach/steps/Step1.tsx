// ==========================
// pages/flowrate/steps/Step1.tsx
// ==========================
import { useState, useEffect, useCallback, useMemo } from "react";
import UploadDropzone from "../../../components/ui/UploadDropzone";
import OverlayUploadResultModal, {
  type IssueRow,
} from "../../../components/modals/OverlayUploadResultModal";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector, useAppDispatch } from "../../../redux_toolkit/hooks";
import { setModuleProgress } from "../../../redux_toolkit/features/progress/moduleProgressSlice";
import { normalizeUploadError } from "../../../utils/uploadErrorNormalizer";
import WorkflowPickerModal from "../../../components/modals/WorkflowPickerModal";
import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWorkflowId,
} from "../../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
import type { Workflow } from "../../../services/workflow";
const DOC_AGING_REPORT = "FLOWRATE_APPROACH_AGING_REPORT";

const toNumberSafe = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/**
 * Align upload path with workflow path:
 *   entity / loanProduct / period / report_date_start / workflowName / subdir
 */
const pathBuilder = (ctx: { entity: string; cadence: string; wf: string | number; loanProduct: string; subdir?: string; categoryKey: string }) => {
  const anyCtx = ctx as any;

  const entity = anyCtx.entity; // e.g. "Entity 1"
  const loanProduct = anyCtx.loanProduct; // e.g. "Home"
  const period = anyCtx.cadence; // e.g. "Monthly"
  const wf = anyCtx.wf; // workflow name
  const subdir = anyCtx.subdir; // e.g. "input/flowrate_approach"

  return [
    entity,
    period,
    wf ? String(wf) : undefined,
    loanProduct,
    subdir,
  ]
    .filter(Boolean)
    .join("/");
};

export default function Step1() {
  const dispatch = useAppDispatch();
  // Get workflow data + selected fields from Redux
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
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [failedFiles, setFailedFiles] = useState<Set<string>>(new Set());
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [uploadIssues, setUploadIssues] = useState<IssueRow[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [failedFilesForRetry, setFailedFilesForRetry] = useState<File[]>([]);

  console.log("Step1 - Workflow Data:", currentPdTransitionMatrixWorkflowData);

  // Prefer Redux workflowId, then fallback to 1
  const workflowIdFromRedux =
    currentPdTransitionMatrixWorkflowId ?? currentPdTransitionMatrixWorkflowData?.id;
  const workflowId = Number(workflowIdFromRedux)

  // Prefer values from persisted workflowData; fall back to selected values; finally to sane defaults
  const entity =
    currentPdTransitionMatrixWorkflowData?.entity ||
    selectedPdTransitionMatrixEntity ||
    "Entity 1";
  const period =
    currentPdTransitionMatrixWorkflowData?.reporting_period ||
    selectedPdTransitionMatrixReportingPeriod ||
    "Monthly";
  const wfName =
    currentPdTransitionMatrixWorkflowData?.workflow_name ||
    pdTransitionMatrixWfName ||
    "wf3";
  const loanProduct =
    currentPdTransitionMatrixWorkflowData?.loan_product ||
    selectedPdTransitionMatrixLoanProduct ||
    "";
  const reportDateStart =
    currentPdTransitionMatrixWorkflowData?.report_date_start ||
    selectedPdTransitionMatrixReportDateStart ||
    "";

  const context = {
    entity,
    cadence: period,
    wf: wfName,
    loanProduct,
    reportDateStart,
    subdir: "input/flowrate_approach",
  };

  console.log("Uploader context:", context);
  console.log("Step1 - final workflowId:", workflowId);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;
  const [pickerOpen, setPickerOpen] = useState(false);

  
  // Fetch existing documents for the workflow
  const fetchExistingDocuments = useCallback(async () => {
    if (!workflowId || !token) {
      setFiles([]);
      return;
    }

    const documentTypes = DOC_AGING_REPORT;

    try {
      const response = await fetch(
        `${API_BASE}/documents/workflow-documents/?workflow_id=${workflowId}&document_types=${documentTypes}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        setFiles([]);
        return;
      }

      const result = await response.json();

      if (result?.success && Array.isArray(result.data)) {
        const existing: File[] = result.data.map((doc: any) => {
          const mime =
            doc.filename.endsWith(".csv")
              ? "text/csv"
              : doc.filename.endsWith(".xlsx")
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/vnd.ms-excel";

          const displayName = doc.original_filename || doc.filename;
          const file = new File([], displayName, { type: mime }) as File & {
            isExisting?: boolean;
            documentId?: number | string;
            sizeBytes?: number;
            serverFilename?: string;
          };
          (file as any).isExisting = true;
          (file as any).documentId = doc.id;
          (file as any).sizeBytes = toNumberSafe(
            doc.size_bytes ?? doc.size ?? doc.bytes ?? doc.file_size
          );
          (file as any).serverFilename = doc.filename;
          return file;
        });

        const onlyOne = existing.slice(0, 1);
        setFiles(onlyOne);
        setUploadedFiles(new Set(onlyOne.map((f) => f.name)));
      } else {
        setFiles([]);
      }
    } catch (err) {
      console.error("Failed to fetch existing documents:", err);
      setFiles([]);
    }
  }, [workflowId, token]);

  // Fetch existing documents when workflowId or token changes
  useEffect(() => {
    fetchExistingDocuments();
  }, [fetchExistingDocuments]);

  const resetAllUploadState = useCallback(() => {
    setUploadedFiles(new Set());
    setFailedFiles(new Set());
    setFailedFilesForRetry([]);
    setUploadIssues([]);
    setSuccessBanner(null);
  }, []);

  const uploadIndividualFile = useCallback(
    async (file: File, override = false) => {
      const fileName = file.name;
      if (uploadedFiles.has(fileName) || uploadingFiles.has(fileName)) return;

      setUploadingFiles((prev) => new Set(prev).add(fileName));
      try {
        const workflowPath = pathBuilder({
          ...context,
          categoryKey: DOC_AGING_REPORT,
        });

        const form = new FormData();
        form.append("file", file);
        form.append("workflow_path", workflowPath);
        form.append("document_type", DOC_AGING_REPORT);
        form.append("workflow_id", String(workflowId));
        form.append("override", String(override));
        form.append("module", "FLOWRATE_APPROACH");
        form.append("submodule", "");

        const response = await fetch(`${API_BASE}/api/document/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });

        const payload = await response.json().catch(() => ({}));
        const ok = response.ok && payload?.success !== false;

        if (ok) {
          setUploadedFiles((prev) => new Set(prev).add(fileName));
          setFailedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });
          setFiles((prev) => {
            if (prev.some((f) => f.name === fileName)) return prev;
            return [...prev, file];
          });
          setSuccessBanner(`${fileName} uploaded successfully.`);
          setUploadModalOpen(false);
          setUploadIssues([]);
        } else {
          setFailedFiles((prev) => new Set(prev).add(fileName));
          setUploadedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });
          setFiles((prev) => prev.filter((f) => f.name !== fileName));
          setFailedFilesForRetry((prev) => [...prev, file]);

          const issue: IssueRow = {
            fileName,
            status: response.status || 0,
            ok: false,
            kind: "error",
            payload: payload,
            normalized: normalizeUploadError(payload),
          };
          setUploadIssues([issue]);
          setUploadModalOpen(true);
          setSuccessBanner(null);
        }
      } catch (error: any) {
        setFailedFiles((prev) => new Set(prev).add(fileName));
        setFiles((prev) => prev.filter((f) => f.name !== fileName));
        setFailedFilesForRetry((prev) => [...prev, file]);

        const issue: IssueRow = {
          fileName,
          status: 0,
          ok: false,
          kind: "error",
          payload: {
            error: error?.message || "Upload failed",
          },
          normalized: normalizeUploadError(error),
        };
        setUploadIssues([issue]);
        setUploadModalOpen(true);
        setSuccessBanner(null);
      } finally {
        setUploadingFiles((prev) => {
          const ns = new Set(prev);
          ns.delete(fileName);
          return ns;
        });
      }
    },
    [uploadedFiles, uploadingFiles, workflowId, token, context]
  );

  const handleFilesChange = useCallback(
    async (nextFiles: File[]) => {
      const single = nextFiles.slice(-1);
      resetAllUploadState();
      setFiles(single);
      for (const f of single) {
        if (!uploadedFiles.has(f.name) && !uploadingFiles.has(f.name) && !(f as any).isExisting) {
          await uploadIndividualFile(f);
        }
      }
    },
    [resetAllUploadState, uploadIndividualFile, uploadedFiles, uploadingFiles]
  );
  const handlePickWorkflow = useCallback(
    (w: Workflow) => {
      const nextEntity = (w as any).entity ?? "";
      const nextPeriod = (w as any).reporting_period ?? (w as any).reportingPeriod ?? "";
      const nextName = (w as any).workflow_name ?? (w as any).name ?? "";
      const nextId = typeof (w as any).id === "number" ? (w as any).id : null;

      if (nextEntity) dispatch(setPdTransitionMatrixSelectedEntity({ entity: nextEntity }));
      if (nextPeriod) dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: nextPeriod }));
      if (nextName) dispatch(setPdTransitionMatrixWfName({ workflow_name: nextName }));
      dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: nextId }));

      setPickerOpen(false);
    },
    [dispatch]
  );
  const uploadStatus = useMemo(() => {
    const totalFiles = files.length;
    const uploadedCount = uploadedFiles.size;
    const uploadingCount = uploadingFiles.size;
    const failedCount = failedFiles.size;

    if (totalFiles === 0) return { status: "empty", message: "No files uploaded yet." };
    if (uploadingCount > 0) return { status: "uploading", message: `Uploading ${uploadingCount} file(s)...` };
    if (failedCount > 0) return { status: "error", message: `${failedCount} file(s) failed to upload.` };
    if (uploadedCount === totalFiles) return { status: "success", message: `All ${uploadedCount} file(s) uploaded successfully.` };
    return { status: "partial", message: `${uploadedCount}/${totalFiles} files uploaded.` };
  }, [files.length, uploadedFiles.size, uploadingFiles.size, failedFiles.size]);

  useEffect(() => {
    if (!workflowId) return;
    const step1Valid = uploadStatus.status === "success";
    dispatch(
      setModuleProgress({
        moduleKey: "flowrate",
        contextKey: `${entity}/${period}/${wfName}/${loanProduct}`,
        data: {
          step1Valid,
          step1Status: uploadStatus.status,
          step1Message: uploadStatus.message,
        },
      })
    );
  }, [dispatch, workflowId, entity, period, wfName, loanProduct, uploadStatus.status]);

  return (
    <div className="mx-auto max-w-8xl">
      {successBanner && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-center justify-between">
            <span>{successBanner}</span>
            <button
              onClick={() => setSuccessBanner(null)}
              className="ml-2 text-emerald-600 hover:text-emerald-800"
              title="Dismiss success message"
            >
              x
            </button>
          </div>
        </div>
      )}

      <OverlayUploadResultModal
        open={uploadModalOpen}
        issues={uploadIssues}
        isSubmitting={false}
        onClose={() => setUploadModalOpen(false)}
        onProceed={async () => {
          const failedNames = Array.from(failedFiles);
          const retryFiles = failedFilesForRetry.filter((f) =>
            failedNames.includes(f.name)
          );
          for (const file of retryFiles) {
            await uploadIndividualFile(file, true);
          }
          setUploadModalOpen(false);
        }}
        proceedDisabledReason={
          uploadIssues.length === 0 ? "No issues to retry" : undefined
        }
      />

      <div className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">
              Inputs
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              Workflow: {pdTransitionMatrixWfName || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer"
              disabled={uploadingFiles.size > 0}
              title="Pick from completed workflows"
            >
              Switch Workflow
            </button>
            {uploadStatus.status === "success" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                All Uploaded
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
            {uploadStatus.status === "partial" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Partial Upload
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-2">
            <div className="relative">
              <UploadDropzone
                label="Aging Report"
                description="CSV or Excel. Upload your aging report data."
                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                value={files}
                onChange={handleFilesChange}
                emptyHint="Waiting for aging report file"
                variant="card"
              />
              {files.length > 0 &&
                files.every((f) => uploadedFiles.has(f.name)) && (
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
            {/* Workflow picker */}
            <WorkflowPickerModal
              open={pickerOpen}
              token={token}
              onClose={() => setPickerOpen(false)}
              onSelect={handlePickWorkflow}
            />
    </div>
  );
}
