// src/pages/execution/Step1.tsx
import { useMemo, useState, useCallback, useEffect } from "react";
import UploadDropzone from "../../../../components/ui/UploadDropzone";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";

import { overlayUploadFile } from "../../../../services/upload";

import { useAppDispatch, useAppSelector } from "../../../../redux_toolkit/hooks";
import { setModuleProgress } from "../../../../redux_toolkit/features/progress/moduleProgressSlice";

import OverlayUploadResultModal, {
  type IssueRow,
} from "../../../../components/modals/OverlayUploadResultModal";
import { normalizeUploadError } from "../../../../utils/uploadErrorNormalizer";
import WorkflowPickerModal from "../../../../components/modals/WorkflowPickerModal";

import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWorkflowId,
} from "../../../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

import type { Workflow } from "../../../../services/workflow";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/* -----------------------------------------------------------
   Helpers
----------------------------------------------------------- */
const toNumberSafe = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const mimeFromName = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/vnd.ms-excel";
};

/* -----------------------------------------------------------
   Execution document types (must match backend / Postman)
----------------------------------------------------------- */
const DOC_MONTHLY = "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV" as const;
const DOC_QUARTERLY = "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV" as const;
const DOC_HISTORICAL = "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE" as const;

type ExecDocType =
  | typeof DOC_MONTHLY
  | typeof DOC_QUARTERLY
  | typeof DOC_HISTORICAL;

function inferExecDocTypeFromName(name: string): ExecDocType | null {
  const base = name.toLowerCase();
  const isMonthly = /monthly/.test(base);
  const isQuarterly = /quarter/.test(base);
  const isHistorical = /historical/.test(base);

  if (isMonthly) return DOC_MONTHLY;
  if (isQuarterly) return DOC_QUARTERLY;
  if (isHistorical) return DOC_HISTORICAL;
  return null;
}

/** <entity>/<period>/<workflow>/input/overlay/development/<loanProduct>/<DOCTYPE> */
function composeWorkflowPathWithDocType(
  basePath: string,
  docType: ExecDocType
): string {
  const base = basePath.replace(/\/+$/g, "");
  return `${base}/${docType}`;
}

type ExistingDocFile = File & {
  isExisting?: boolean;
  documentId?: number | string;
  sizeBytes?: number;
  serverFilename?: string;
  documentType?: ExecDocType;
  createdAt?: string;
};

/* -----------------------------------------------------------
   Component
----------------------------------------------------------- */
export default function Step1() {
  const dispatch = useAppDispatch();

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
    currentPdTransitionMatrixWorkflowId: selectedWorkflowId,
    selectedPdTransitionMatrixLoanProduct: loanproduct,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper as any);

  const token = useAppSelector((state) => state.auth.token);

  // Inputs
  const [monthlyFiles, setMonthlyFiles] = useState<File[]>([]);
  const [quarterlyFiles, setQuarterlyFiles] = useState<File[]>([]);
  const [historicalFiles, setHistoricalFiles] = useState<File[]>([]);

  // Upload state tracked by file.name
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [failedFiles, setFailedFiles] = useState<Set<string>>(new Set());

  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [uploadIssues, setUploadIssues] = useState<IssueRow[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [failedFilesForRetry, setFailedFilesForRetry] = useState<File[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  const baseDir = `/${entity}/${period}/${workflowName}`.replace(/^\/+/, "");
  const workflowPathBase = `${baseDir}/input/overlay/development/${loanproduct}`;

  const effectiveWorkflowId = selectedWorkflowId ?? 1;

  /* -----------------------------------------------------------
     Reset all local state on workflow change
  ----------------------------------------------------------- */
  const clearAll = useCallback(() => {
    setMonthlyFiles([]);
    setQuarterlyFiles([]);
    setHistoricalFiles([]);

    setUploadingFiles(new Set());
    setUploadedFiles(new Set());
    setFailedFiles(new Set());

    setSuccessBanner(null);

    setUploadIssues([]);
    setUploadModalOpen(false);
    setFailedFilesForRetry([]);
  }, []);

  useEffect(() => {
    clearAll();
  }, [selectedWorkflowId, clearAll]);

  /* -----------------------------------------------------------
     Fetch existing documents and show them in dropzones
     ✅ FIXED: no mismatch between filename and original_filename
  ----------------------------------------------------------- */
  const fetchExistingDocuments = useCallback(async () => {
    if (!selectedWorkflowId || !token) return;

    const documentTypes = [DOC_MONTHLY, DOC_QUARTERLY, DOC_HISTORICAL].join(",");
    const url = `${API_BASE}/documents/workflow-documents/?workflow_id=${encodeURIComponent(
      String(selectedWorkflowId)
    )}&document_types=${encodeURIComponent(documentTypes)}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) return;

      const result = await response.json();

      // your backend response can have { success: true, data: [...] }
      if (!result?.success || !Array.isArray(result.data)) return;

      const nextMonthly: ExistingDocFile[] = [];
      const nextQuarterly: ExistingDocFile[] = [];
      const nextHistorical: ExistingDocFile[] = [];
      const nextUploadedNames = new Set<string>();

      for (const doc of result.data as any[]) {
        const docType = doc.document_type as ExecDocType | undefined;
        if (!docType) continue;

        // Display should use original filename when available
        const displayName: string = doc.original_filename || doc.filename;
        const f = new File([], displayName, {
          type: mimeFromName(displayName),
        }) as ExistingDocFile;

        f.isExisting = true;
        f.documentId = doc.id;
        f.sizeBytes = toNumberSafe(doc.size_bytes ?? doc.size ?? doc.bytes ?? doc.file_size);
        f.serverFilename = doc.filename; // server stored filename
        f.documentType = docType;
        f.createdAt = doc.created_at;

        nextUploadedNames.add(displayName);

        if (docType === DOC_MONTHLY) nextMonthly.push(f);
        if (docType === DOC_QUARTERLY) nextQuarterly.push(f);
        if (docType === DOC_HISTORICAL) nextHistorical.push(f);
      }

      // only one per slot
      setMonthlyFiles(nextMonthly.slice(0, 1));
      setQuarterlyFiles(nextQuarterly.slice(0, 1));
      setHistoricalFiles(nextHistorical.slice(0, 1));

      setUploadedFiles(nextUploadedNames);
    } catch (err) {
      console.error("Failed to fetch execution docs:", err);
    }
  }, [selectedWorkflowId, token, workflowPathBase]);

  useEffect(() => {
    if (selectedWorkflowId) fetchExistingDocuments();
  }, [selectedWorkflowId, fetchExistingDocuments]);

  /* -----------------------------------------------------------
     Upload helper
  ----------------------------------------------------------- */
  const uploadIndividualFile = useCallback(
    async (file: File, docTypeOverride?: ExecDocType) => {
      const fileName = file.name;
      if (!token) throw new Error("Missing token.");

      const docType = docTypeOverride ?? inferExecDocTypeFromName(fileName);
      if (!docType) {
        throw new Error("File type not recognized for this input.");
      }

      if (uploadedFiles.has(fileName) || uploadingFiles.has(fileName)) return;

      setUploadingFiles((prev) => new Set(prev).add(fileName));

      try {
        const finalWorkflowPath = composeWorkflowPathWithDocType(
          workflowPathBase,
          docType
        );

        const result = await overlayUploadFile({
          baseUrl: API_BASE,
          token,
          file,
          workflowPath: finalWorkflowPath,
          documentType: docType,
          workflowId: effectiveWorkflowId,
          override: false,
          moduleVal: "OVERLAY",
          submoduleVal: "DEVELOPMENT",
        });

        if (result.ok) {
          setUploadedFiles((prev) => new Set(prev).add(fileName));
          setFailedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });

          setSuccessBanner(`${fileName} uploaded successfully!`);
          setUploadModalOpen(false);
          setUploadIssues([]);
          return;
        }

        // server responded ok=false
        setFailedFiles((prev) => new Set(prev).add(fileName));
        setUploadedFiles((prev) => {
          const ns = new Set(prev);
          ns.delete(fileName);
          return ns;
        });

        setFailedFilesForRetry((prev) => [...prev, file]);

        const validationStatus = result.data?.validation_status;
        const issueKind = validationStatus === "failed" ? "conflict" : "error";

        const issue: IssueRow = {
          fileName,
          status: result.status || 0,
          ok: result.ok,
          kind: issueKind,
          payload: {
            error: result.error,
            data: result.data,
            fullResponse: result,
            validationStatus,
          },
          normalized: normalizeUploadError(result.data ?? result.error ?? result),
        };

        setUploadIssues([issue]);
        setUploadModalOpen(true);
        setSuccessBanner(null);
      } catch (error: any) {
        console.error(`Upload failed for ${fileName}:`, error);

        setFailedFiles((prev) => new Set(prev).add(fileName));
        setUploadedFiles((prev) => {
          const ns = new Set(prev);
          ns.delete(fileName);
          return ns;
        });

        setFailedFilesForRetry((prev) => [...prev, file]);

        const issue: IssueRow = {
          fileName,
          status: 0,
          ok: false,
          kind: "error",
          payload: {
            error: error?.message || "Upload failed",
            caughtError: error,
            stack: error?.stack,
            validationStatus: "error",
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
    [
      token,
      workflowPathBase,
      effectiveWorkflowId,
      uploadedFiles,
      uploadingFiles,
    ]
  );

  const resetUploadStateForFiles = useCallback((files: File[]) => {
    const names = new Set(files.map((f) => f.name));
    if (names.size === 0) return;

    setUploadedFiles((prev) => {
      const ns = new Set(prev);
      names.forEach((n) => ns.delete(n));
      return ns;
    });

    setFailedFiles((prev) => {
      const ns = new Set(prev);
      names.forEach((n) => ns.delete(n));
      return ns;
    });

    setFailedFilesForRetry((prev) => prev.filter((f) => !names.has(f.name)));
    setUploadIssues([]);
    setSuccessBanner(null);
  }, []);

  /* -----------------------------------------------------------
     Dropzone handlers (single file each)
  ----------------------------------------------------------- */
  const handleMonthlyFilesChange = useCallback(
    async (files: File[]) => {
      const single = files.slice(-1);
      resetUploadStateForFiles(single);
      setMonthlyFiles(single);

      const f = single[0];
      if (!f) return;
      if ((f as any).isExisting) return;
      if (uploadedFiles.has(f.name) || uploadingFiles.has(f.name)) return;

      await uploadIndividualFile(f, DOC_MONTHLY);
    },
    [
      resetUploadStateForFiles,
      uploadIndividualFile,
      uploadedFiles,
      uploadingFiles,
    ]
  );

  const handleQuarterlyFilesChange = useCallback(
    async (files: File[]) => {
      const single = files.slice(-1);
      resetUploadStateForFiles(single);
      setQuarterlyFiles(single);

      const f = single[0];
      if (!f) return;
      if ((f as any).isExisting) return;
      if (uploadedFiles.has(f.name) || uploadingFiles.has(f.name)) return;

      await uploadIndividualFile(f, DOC_QUARTERLY);
    },
    [
      resetUploadStateForFiles,
      uploadIndividualFile,
      uploadedFiles,
      uploadingFiles,
    ]
  );

  const handleHistoricalFilesChange = useCallback(
    async (files: File[]) => {
      const single = files.slice(-1);
      resetUploadStateForFiles(single);
      setHistoricalFiles(single);

      const f = single[0];
      if (!f) return;
      if ((f as any).isExisting) return;
      if (uploadedFiles.has(f.name) || uploadingFiles.has(f.name)) return;

      await uploadIndividualFile(f, DOC_HISTORICAL);
    },
    [
      resetUploadStateForFiles,
      uploadIndividualFile,
      uploadedFiles,
      uploadingFiles,
    ]
  );

  /* -----------------------------------------------------------
     Status
     ✅ FIXED: count uploaded based on files in slots,
       not uploadedFiles.size (which can include older/stale entries)
  ----------------------------------------------------------- */
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (monthlyFiles.length) parts.push("1 monthly");
    if (quarterlyFiles.length) parts.push("1 quarterly");
    if (historicalFiles.length) parts.push("1 historical");
    return parts.join("  ");
  }, [monthlyFiles.length, quarterlyFiles.length, historicalFiles.length]);

  const uploadStatus = useMemo(() => {
    const selected = [...monthlyFiles, ...quarterlyFiles, ...historicalFiles];
    const totalFiles = selected.length;

    const uploadedCount = selected.filter((f) => uploadedFiles.has(f.name)).length;
    const uploadingCount = selected.filter((f) => uploadingFiles.has(f.name)).length;
    const failedCount = selected.filter((f) => failedFiles.has(f.name)).length;

    if (totalFiles === 0)
      return { status: "empty" as const, message: "No files uploaded yet." };
    if (uploadingCount > 0)
      return {
        status: "uploading" as const,
        message: `Uploading ${uploadingCount} file(s)...`,
      };
    if (failedCount > 0)
      return {
        status: "error" as const,
        message: `${failedCount} file(s) failed to upload.`,
      };
    if (uploadedCount === totalFiles)
      return {
        status: "success" as const,
        message: `All ${uploadedCount} file(s) uploaded successfully!`,
      };

    return {
      status: "partial" as const,
      message: `${uploadedCount}/${totalFiles} files uploaded.`,
    };
  }, [monthlyFiles, quarterlyFiles, historicalFiles, uploadedFiles, uploadingFiles, failedFiles]);

  /* -----------------------------------------------------------
     Persist Step 1 validity for gating
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!Number.isFinite(selectedWorkflowId)) return;

    const step1Valid = uploadStatus.status === "success";

    dispatch(
      setModuleProgress({
        moduleKey: "overlayDevelopment",
        contextKey: String(selectedWorkflowId),
        data: { step1Valid },
      })
    );
  }, [dispatch, selectedWorkflowId, uploadStatus.status]);

  /* -----------------------------------------------------------
     Workflow picker
  ----------------------------------------------------------- */
  const handlePickWorkflow = useCallback(
    (w: Workflow) => {
      const nextEntity = (w as any).entity ?? "";
      const nextPeriod =
        (w as any).reporting_period ?? (w as any).reportingPeriod ?? "";
      const nextName = (w as any).workflow_name ?? (w as any).name ?? "";
      const nextId = typeof (w as any).id === "number" ? (w as any).id : null;

      if (nextEntity)
        dispatch(setPdTransitionMatrixSelectedEntity({ entity: nextEntity }));
      if (nextPeriod)
        dispatch(
          setPdTransitionMatrixSelectedReportingPeriod({ period: nextPeriod })
        );
      if (nextName)
        dispatch(setPdTransitionMatrixWfName({ workflow_name: nextName }));
      dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: nextId }));

      setPickerOpen(false);
    },
    [dispatch]
  );

  /* -----------------------------------------------------------
     Retry flow (override = true)
  ----------------------------------------------------------- */
  const handleRetryProceed = useCallback(async () => {
    const failedNames = Array.from(failedFiles);
    const retryFiles = failedFilesForRetry.filter((f) =>
      failedNames.includes(f.name)
    );

    for (const file of retryFiles) {
      const docType = inferExecDocTypeFromName(file.name);
      if (!docType) continue;

      try {
        const finalWorkflowPath = composeWorkflowPathWithDocType(
          workflowPathBase,
          docType
        );

        const result = await overlayUploadFile({
          baseUrl: API_BASE,
          token,
          file,
          workflowPath: finalWorkflowPath,
          documentType: docType,
          workflowId: effectiveWorkflowId,
          override: true,
          moduleVal: "OVERLAY",
          submoduleVal: "DEVELOPMENT",
        });

        if (result.ok) {
          const fileName = file.name;

          setUploadedFiles((prev) => new Set(prev).add(fileName));
          setFailedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });

          setFailedFilesForRetry((prev) =>
            prev.filter((f) => f.name !== fileName)
          );

          setSuccessBanner(`${fileName} uploaded successfully with override!`);
        }
      } catch (err) {
        console.error(`Retry failed for ${file.name}:`, err);
      }
    }

    setUploadModalOpen(false);
  }, [failedFiles, failedFilesForRetry, workflowPathBase, token, effectiveWorkflowId]);

  /* -----------------------------------------------------------
     UI
  ----------------------------------------------------------- */
  return (
    <div className="mx-auto max-w-8xl">
      {/* Success banner */}
      {successBanner && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-center justify-between">
            <span>{successBanner}</span>
            <button
              onClick={() => setSuccessBanner(null)}
              className="ml-2 text-emerald-600 hover:text-emerald-800"
              title="Dismiss success message"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Upload Results / Retry Modal */}
      <OverlayUploadResultModal
        open={uploadModalOpen}
        title="Upload Error"
        issues={uploadIssues}
        isSubmitting={false}
        onClose={() => setUploadModalOpen(false)}
        onProceed={handleRetryProceed}
        proceedDisabledReason={
          uploadIssues.length === 0
            ? "No issues to retry"
            : uploadIssues.some((i) => i.payload?.data?.validation_status === "error")
            ? "Code error detected - cannot retry"
            : undefined
        }
      />

      <div className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">
              Inputs
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              Workflow: {workflowName || "—"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              disabled={uploadingFiles.size > 0}
              title="Pick from completed workflows"
              type="button"
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
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Uploading...
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
          {/* MONTHLY */}
          <div className="space-y-2">
            <div className="relative">
              <UploadDropzone
                label="Monthly MEV"
                description="CSV or Excel"
                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                value={monthlyFiles}
                onChange={handleMonthlyFilesChange}
                emptyHint="Waiting for monthly file"
                variant="card"
              />
              {monthlyFiles.length > 0 &&
                monthlyFiles.every((f) => uploadedFiles.has(f.name)) && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                      <CheckCircleIcon className="h-3 w-3" />
                      Uploaded
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* QUARTERLY */}
          <div className="space-y-2">
            <div className="relative">
              <UploadDropzone
                label="Quarterly MEV"
                description="CSV or Excel"
                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                value={quarterlyFiles}
                onChange={handleQuarterlyFilesChange}
                emptyHint="Waiting for quarterly file"
                variant="card"
              />
              {quarterlyFiles.length > 0 &&
                quarterlyFiles.every((f) => uploadedFiles.has(f.name)) && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                      <CheckCircleIcon className="h-3 w-3" />
                      Uploaded
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* HISTORICAL */}
          <div className="space-y-2 md:col-span-2">
            <div className="relative">
              <UploadDropzone
                label="Historical Default Rate"
                description="CSV or Excel"
                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                value={historicalFiles}
                onChange={handleHistoricalFilesChange}
                emptyHint="Waiting for historical file"
                variant="card"
              />
              {historicalFiles.length > 0 &&
                historicalFiles.every((f) => uploadedFiles.has(f.name)) && (
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

        <div className="flex flex-col gap-3 border-t px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-gray-600">
            <div className="mb-1">{uploadStatus.message}</div>
            {(monthlyFiles.length > 0 ||
              quarterlyFiles.length > 0 ||
              historicalFiles.length > 0) && (
              <div className="text-gray-500">Files: {summary}</div>
            )}
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
