// src/pages/execution/Step1.tsx
import { useMemo, useState, useCallback, useEffect } from "react";
import UploadDropzone from "../../../../components/ui/UploadDropzone";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";

import { overlayUploadFile } from "../../../../services/upload";

import { useAppDispatch, useAppSelector } from "../../../../redux_toolkit/hooks";
import OverlayUploadResultModal, { type IssueRow } from "../../../../components/modals/OverlayUploadResultModal";
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
   Execution document types (must match backend / Postman)
----------------------------------------------------------- */
const DOC_MONTHLY = "OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA" as const;
const DOC_QUARTERLY = "OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA" as const;
type ExecDocType = typeof DOC_MONTHLY | typeof DOC_QUARTERLY;

/** Loosened filename inference:
 *  monthly_*_arima.*   -> DOC_MONTHLY
 *  quarterly_*_arima.* -> DOC_QUARTERLY
 */
function inferExecDocTypeFromName(name: string): ExecDocType | null {
  const base = name.toLowerCase();
  const isMonthly = /monthly/.test(base);
  const isQuarterly = /quarter/.test(base);
  const hasArima = /arima/.test(base);
  if (isMonthly && hasArima) return DOC_MONTHLY;
  if (isQuarterly && hasArima) return DOC_QUARTERLY;
  return null;
}

/** Compose the final storage path for this file:
 *  <entity>/<period>/<workflow>/input/overlay/execution/Auto/<DOCTYPE>
 */
function composeWorkflowPathWithDocType(basePath: string, docType: ExecDocType): string {
  // Normalize slashes a bit to avoid '//' when joining
  const base = basePath.replace(/\/+$/g, "");
  return `${base}/${docType}`;
}

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
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper as any);

  const token = useAppSelector((state) => state.auth.token);

  // Two execution inputs
  const [monthlyFiles, setMonthlyFiles] = useState<File[]>([]);
  const [quarterlyFiles, setQuarterlyFiles] = useState<File[]>([]);

  // Upload state
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

  // Build the base workflow path → <entity>/<period>/<wfName>/input/overlay/execution/Auto
  const baseDir = `/${entity}/${period}/${workflowName}`.replace(/^\/+/, "");
  const workflowPathBase = `${baseDir}/input/overlay/execution/Auto`;

  // Prefer explicit workflow id
  const effectiveWorkflowId = selectedWorkflowId ?? 1;

  /* -----------------------------------------------------------
     Prefill: fetch existing EXECUTION docs
     Doc types:
       - OVERLAY_EXECUTION_MEV_MONTHLY_ARIMA
       - OVERLAY_EXECUTION_MEV_QUARTERLY_ARIMA
  ----------------------------------------------------------- */
  const fetchExistingDocuments = useCallback(async () => {
    if (!selectedWorkflowId || !token) return;

    const documentTypes = [DOC_MONTHLY, DOC_QUARTERLY].join(",");

    try {
      const response = await fetch(
        `${API_BASE}/documents/workflow-documents/?workflow_id=${selectedWorkflowId}&document_types=${documentTypes}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) return;
      const result = await response.json();

      if (result?.success && Array.isArray(result.data)) {
        const existing: File[] = result.data.map((doc: any) => {
          const mime =
            doc.filename.endsWith(".csv")
              ? "text/csv"
              : doc.filename.endsWith(".xlsx")
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/vnd.ms-excel";

          const f = new File([], doc.filename, { type: mime }) as File & {
            isExisting?: boolean;
            documentId?: number | string;
          };
          (f as any).isExisting = true;
          (f as any).documentId = doc.id;
          return f;
        });

        const nextMonthly: File[] = [];
        const nextQuarterly: File[] = [];

        for (const f of existing) {
          const doc = result.data.find((d: any) => d.filename === f.name);
          if (!doc) continue;
          if (doc.document_type === DOC_MONTHLY) {
            nextMonthly.push(f);
            setUploadedFiles((prev) => new Set(prev).add(f.name));
          } else if (doc.document_type === DOC_QUARTERLY) {
            nextQuarterly.push(f);
            setUploadedFiles((prev) => new Set(prev).add(f.name));
          }
        }

        setMonthlyFiles(nextMonthly);
        setQuarterlyFiles(nextQuarterly);
      }
    } catch (err) {
      console.error("Failed to fetch execution docs:", err);
    }
  }, [selectedWorkflowId, token]);

  // Clear when workflow switches, then prefill
  const clearAll = useCallback(() => {
    setMonthlyFiles([]);
    setQuarterlyFiles([]);
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

  useEffect(() => {
    if (selectedWorkflowId) {
      fetchExistingDocuments();
    }
  }, [selectedWorkflowId, fetchExistingDocuments]);

  /* -----------------------------------------------------------
     Single-file upload helper
  ----------------------------------------------------------- */
  const uploadIndividualFile = useCallback(
    async (file: File) => {
      const fileName = file.name;

      if (uploadedFiles.has(fileName) || uploadingFiles.has(fileName)) return;

      setUploadingFiles((prev) => new Set(prev).add(fileName));
      try {
        const docType = inferExecDocTypeFromName(fileName);
        if (!docType) {
          throw new Error(
            "Filename not recognized. Expected names like `monthly_*_arima.*` or `quarterly_*_arima.*`"
          );
        }

        // 🔗 FINAL PATH now includes the doc type
        const finalWorkflowPath = composeWorkflowPathWithDocType(workflowPathBase, docType);

        const result = await overlayUploadFile({
          baseUrl: API_BASE,
          token,
          file,
          workflowPath: finalWorkflowPath, // <-- use base + doctype
          documentType: docType,           // <-- exact Postman doc type
          workflowId: effectiveWorkflowId,
          override: false,
          moduleVal: "OVERLAY",
          submoduleVal: "EXECUTION",
        });

        if (result.ok) {
          setUploadedFiles((prev) => new Set(prev).add(fileName));
          setFailedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });

          // place the file in the right bucket
          if (docType === DOC_MONTHLY) {
            setMonthlyFiles((prev) => [...prev, file]);
          } else if (docType === DOC_QUARTERLY) {
            setQuarterlyFiles((prev) => [...prev, file]);
          }

          setSuccessBanner(`${fileName} uploaded successfully!`);
          setUploadModalOpen(false);
        } else {
          // mark failed
          setFailedFiles((prev) => new Set(prev).add(fileName));
          setUploadedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });

          const docType2 = inferExecDocTypeFromName(fileName);
          if (docType2 === DOC_MONTHLY) {
            setMonthlyFiles((prev) => prev.filter((f) => f.name !== fileName));
          } else if (docType2 === DOC_QUARTERLY) {
            setQuarterlyFiles((prev) => prev.filter((f) => f.name !== fileName));
          }

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
          };

          setUploadIssues([issue]);
          setUploadModalOpen(true);
          setSuccessBanner(null);
        }
      } catch (error: any) {
        console.error(`Upload failed for ${fileName}:`, error);
        setFailedFiles((prev) => new Set(prev).add(fileName));

        const docType2 = inferExecDocTypeFromName(fileName);
        if (docType2 === DOC_MONTHLY) {
          setMonthlyFiles((prev) => prev.filter((f) => f.name !== fileName));
        } else if (docType2 === DOC_QUARTERLY) {
          setQuarterlyFiles((prev) => prev.filter((f) => f.name !== fileName));
        }

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
    [token, workflowPathBase, effectiveWorkflowId, uploadedFiles, uploadingFiles]
  );

  // Dropzone handlers — upload new files, ignore placeholders from existing docs
  const handleMonthlyFilesChange = useCallback(
    async (files: File[]) => {
      setMonthlyFiles(files);
      for (const f of files) {
        if (!uploadedFiles.has(f.name) && !uploadingFiles.has(f.name) && !(f as any).isExisting) {
          await uploadIndividualFile(f);
        }
      }
    },
    [uploadIndividualFile, uploadedFiles, uploadingFiles]
  );

  const handleQuarterlyFilesChange = useCallback(
    async (files: File[]) => {
      setQuarterlyFiles(files);
      for (const f of files) {
        if (!uploadedFiles.has(f.name) && !uploadingFiles.has(f.name) && !(f as any).isExisting) {
          await uploadIndividualFile(f);
        }
      }
    },
    [uploadIndividualFile, uploadedFiles, uploadingFiles]
  );

  // Summary & status
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (monthlyFiles.length) parts.push(`${monthlyFiles.length} monthly`);
    if (quarterlyFiles.length) parts.push(`${quarterlyFiles.length} quarterly`);
    return parts.join(" • ");
  }, [monthlyFiles.length, quarterlyFiles.length]);

  const uploadStatus = useMemo(() => {
    const totalFiles = monthlyFiles.length + quarterlyFiles.length;
    const uploadedCount = uploadedFiles.size;
    const uploadingCount = uploadingFiles.size;
    const failedCount = failedFiles.size;

    if (totalFiles === 0) return { status: "empty", message: "No files uploaded yet." };
    if (uploadingCount > 0) return { status: "uploading", message: `Uploading ${uploadingCount} file(s)...` };
    if (failedCount > 0) return { status: "error", message: `${failedCount} file(s) failed to upload.` };
    if (uploadedCount === totalFiles) return { status: "success", message: `All ${uploadedCount} file(s) uploaded successfully!` };
    return { status: "partial", message: `${uploadedCount}/${totalFiles} files uploaded.` };
  }, [monthlyFiles.length, quarterlyFiles.length, uploadedFiles.size, uploadingFiles.size, failedFiles.size]);

  // Workflow picker (status already filtered inside modal to "done")
  const handlePickWorkflow = useCallback(
    (w: Workflow) => {
      const nextEntity = (w as any).entity ?? "";
      const nextPeriod = (w as any).reporting_period ?? (w as any).reportingPeriod ?? "";
      const nextName = (w as any).workflow_name ?? (w as any).name ?? "";
      const nextId = typeof (w as any).id === "number" ? (w as any).id : null;

      console.log(`🎯 WORKFLOW SELECTED: ID=${nextId}, Name='${nextName}', Entity='${nextEntity}', Period='${nextPeriod}'`);

      if (nextEntity) dispatch(setPdTransitionMatrixSelectedEntity({ entity: nextEntity }));
      if (nextPeriod) dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: nextPeriod }));
      if (nextName) dispatch(setPdTransitionMatrixWfName({ workflow_name: nextName }));
      dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: nextId }));

      setPickerOpen(false);
    },
    [dispatch]
  );

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
            >
              ✕
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
        onProceed={async () => {
          const failedNames = Array.from(failedFiles);
          const retryFiles = failedFilesForRetry.filter((f) => failedNames.includes(f.name));

          for (const file of retryFiles) {
            const docType = inferExecDocTypeFromName(file.name);
            if (!docType) continue;
            try {
              // 🔗 FINAL PATH (retry) includes the doc type
              const finalWorkflowPath = composeWorkflowPathWithDocType(workflowPathBase, docType);

              const result = await overlayUploadFile({
                baseUrl: API_BASE,
                token,
                file,
                workflowPath: finalWorkflowPath,
                documentType: docType,
                workflowId: effectiveWorkflowId,
                override: true,
                moduleVal: "OVERLAY",
                submoduleVal: "EXECUTION",
              });

              if (result.ok) {
                const fileName = file.name;

                setUploadedFiles((prev) => new Set(prev).add(fileName));
                setFailedFiles((prev) => {
                  const ns = new Set(prev);
                  ns.delete(fileName);
                  return ns;
                });

                if (docType === DOC_MONTHLY) {
                  setMonthlyFiles((prev) => [...prev, file]);
                } else if (docType === DOC_QUARTERLY) {
                  setQuarterlyFiles((prev) => [...prev, file]);
                }

                setFailedFilesForRetry((prev) => prev.filter((f) => f.name !== fileName));
                setSuccessBanner(`${fileName} uploaded successfully with override!`);
              }
            } catch (err) {
              console.error(`Retry failed for ${file.name}:`, err);
            }
          }

          setUploadModalOpen(false);
        }}
        proceedDisabledReason={
          uploadIssues.length === 0
            ? "No issues to retry"
            : uploadIssues.some((i) => i.payload?.data?.validation_status === "error")
              ? "Code error detected - cannot retry"
              : undefined
        }
      />

      <div className="rounded-3xl  bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border border-gray-200">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">Execution Input Files</h3>
            <p className="text-xs text-gray-500">
              Upload your datasets. Accepted types: <span className="font-medium">{accept}</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Workflow ID: <span className="font-mono">{selectedWorkflowId ?? "—"}</span>
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
          {/* MONTHLY (ARIMA) */}
          <div className="space-y-2">
            <div className="relative">
              <UploadDropzone
                label="Monthly MEV (ARIMA)"
                description="CSV or Excel. Name like: monthly_*_arima.*"
                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={3}
                value={monthlyFiles}
                onChange={handleMonthlyFilesChange}
                emptyHint="Waiting for monthly ARIMA file(s)…"
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

          {/* QUARTERLY (ARIMA) */}
          <div className="space-y-2">
            <div className="relative">
              <UploadDropzone
                label="Quarterly MEV (ARIMA)"
                description="CSV or Excel. Name like: quarterly_*_arima.*"
                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={3}
                value={quarterlyFiles}
                onChange={handleQuarterlyFilesChange}
                emptyHint="Waiting for quarterly ARIMA file(s)…"
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
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-gray-600">
            <div className="mb-1">{uploadStatus.message}</div>
            {(monthlyFiles.length > 0 || quarterlyFiles.length > 0) && (
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