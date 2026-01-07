// src/pages/execution/Step1.tsx
import { useMemo, useState, useCallback, useEffect } from "react";
import UploadDropzone from "../../../../components/ui/UploadDropzone";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";

import { overlayUploadFile } from "../../../../services/upload";

import {
  useAppDispatch,
  useAppSelector,
} from "../../../../redux_toolkit/hooks";
import OverlayUploadResultModal, {
  type IssueRow,
} from "../../../../components/modals/OverlayUploadResultModal";
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

type InputMode = "AUTO_GENERATE" | "UPLOAD_MANUAL";

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
 *  <entity>/<period>/<workflow>/input/overlay/execution/<loanproduct>/<DOCTYPE>
 */
function composeWorkflowPathWithDocType(
  basePath: string,
  docType: ExecDocType
): string {
  const base = basePath.replace(/\/+$/g, "");
  return `${base}/${docType}`;
}

/** POST form-data workflow_id to generator endpoints */
async function postWorkflowIdFormData(args: {
  token: string;
  workflowId: number;
  endpoint: string; // full URL
}) {
  const fd = new FormData();
  fd.append("workflow_id", String(args.workflowId));

  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      // DO NOT set Content-Type for FormData; browser sets boundary.
    },
    body: fd,
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // ignore if not json
  }

  if (!res.ok) {
    const msg =
      payload?.detail ||
      payload?.message ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return payload;
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
    selectedPdTransitionMatrixLoanProduct: loanproduct,
  } = useSelector(
    (state: RootState) => state.pdTransitionMatrixWfHelper as any
  );

  const token = useAppSelector((state) => state.auth.token);

  // ✅ new: workflow mode
  const [mode, setMode] = useState<InputMode>("UPLOAD_MANUAL");

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

  // ✅ new: generator state
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoMonthlyOk, setAutoMonthlyOk] = useState<boolean | null>(null);
  const [autoQuarterlyOk, setAutoQuarterlyOk] = useState<boolean | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [existingMonthlyFilename, setExistingMonthlyFilename] = useState<string | null>(null);
  const [existingQuarterlyFilename, setExistingQuarterlyFilename] = useState<string | null>(null);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  // Build the base workflow path → <entity>/<period>/<wfName>/input/overlay/execution/<loanproduct>
  const baseDir = `/${entity}/${period}/${workflowName}`.replace(/^\/+/, "");
  const workflowPathBase = `${baseDir}/input/overlay/execution/${loanproduct}`;

  // Prefer explicit workflow id
  const effectiveWorkflowId = selectedWorkflowId ?? 1;

  const overlayExecApiBase = `${API_BASE.replace(/\/+$/g, "")}/api/overlay/execution`;

  /* -----------------------------------------------------------
     Prefill: fetch existing EXECUTION docs
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
          const mime = doc.filename.endsWith(".csv")
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

        // reset buckets but keep uploaded markers consistent
        const nextUploaded = new Set<string>();

        for (const f of existing) {
          const doc = result.data.find((d: any) => d.filename === f.name);
          if (!doc) continue;
          if (doc.document_type === DOC_MONTHLY) {
            nextMonthly.push(f);
            nextUploaded.add(f.name);
          } else if (doc.document_type === DOC_QUARTERLY) {
            nextQuarterly.push(f);
            nextUploaded.add(f.name);
          }
        }

        setMonthlyFiles(nextMonthly);
        setQuarterlyFiles(nextQuarterly);
        setUploadedFiles(nextUploaded);
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

    // auto
    setAutoRunning(false);
    setAutoMonthlyOk(null);
    setAutoQuarterlyOk(null);
    setAutoError(null);
    setExistingMonthlyFilename(null);
    setExistingQuarterlyFilename(null);
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
     Download forecast files
  ----------------------------------------------------------- */
  const downloadMonthlyForecast = useCallback(async () => {
    if (!token || !effectiveWorkflowId) return;
    
    try {
      const response = await fetch(
        `${overlayExecApiBase}/mev_monthly_arima_forecast/export/?workflow_id=${effectiveWorkflowId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = existingMonthlyFilename || "monthly_arima_forecast.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error("Failed to download monthly forecast");
      }
    } catch (err) {
      console.error("Error downloading monthly forecast:", err);
    }
  }, [token, effectiveWorkflowId, overlayExecApiBase, existingMonthlyFilename]);

  const downloadQuarterlyForecast = useCallback(async () => {
    if (!token || !effectiveWorkflowId) return;
    
    try {
      const response = await fetch(
        `${overlayExecApiBase}/mev_quarterly_arima_forecast/export/?workflow_id=${effectiveWorkflowId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = existingQuarterlyFilename || "quarterly_arima_forecast.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error("Failed to download quarterly forecast");
      }
    } catch (err) {
      console.error("Error downloading quarterly forecast:", err);
    }
  }, [token, effectiveWorkflowId, overlayExecApiBase, existingQuarterlyFilename]);

  /* -----------------------------------------------------------
     Check for existing forecast files
  ----------------------------------------------------------- */
  const checkExistingForecasts = useCallback(async () => {
    if (!token || !effectiveWorkflowId) return;
    
    try {
      // Check monthly forecast
      const monthlyRes = await fetch(
        `${overlayExecApiBase}/mev_monthly_arima_forecast?workflow_id=${effectiveWorkflowId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );
      
      if (monthlyRes.ok) {
        const monthlyData = await monthlyRes.json();
        if (monthlyData?.success && monthlyData?.data) {
          setExistingMonthlyFilename(monthlyData.data);
        } else {
          setExistingMonthlyFilename(null);
        }
      } else {
        setExistingMonthlyFilename(null);
      }
      
      // Check quarterly forecast
      const quarterlyRes = await fetch(
        `${overlayExecApiBase}/mev_quarterly_arima_forecast?workflow_id=${effectiveWorkflowId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );
      
      if (quarterlyRes.ok) {
        const quarterlyData = await quarterlyRes.json();
        if (quarterlyData?.success && quarterlyData?.data) {
          setExistingQuarterlyFilename(quarterlyData.data);
        } else {
          setExistingQuarterlyFilename(null);
        }
      } else {
        setExistingQuarterlyFilename(null);
      }
    } catch (err) {
      console.error("Error checking existing forecasts:", err);
    }
  }, [token, effectiveWorkflowId, overlayExecApiBase]);

  /* -----------------------------------------------------------
     AUTO-GENERATE: call both endpoints then refresh docs
  ----------------------------------------------------------- */
  const runAutoGenerate = useCallback(async () => {
    if (!token) return;
    if (!effectiveWorkflowId) return;

    setAutoRunning(true);
    setAutoMonthlyOk(null);
    setAutoQuarterlyOk(null);
    setAutoError(null);
    setSuccessBanner(null);

    try {
      // run sequentially (clean UX + easier error pinpoint)
      await postWorkflowIdFormData({
        token,
        workflowId: effectiveWorkflowId,
        endpoint: `${overlayExecApiBase}/mev_monthly_arima_forecast`,
      });
      setAutoMonthlyOk(true);

      await postWorkflowIdFormData({
        token,
        workflowId: effectiveWorkflowId,
        endpoint: `${overlayExecApiBase}/mev_quarterly_arima_forecast`,
      });
      setAutoQuarterlyOk(true);

      setSuccessBanner("Auto-generated Monthly & Quarterly ARIMA inputs successfully.");
      await fetchExistingDocuments(); // show placeholders as "existing"
      await checkExistingForecasts(); // refresh filenames
    } catch (e: any) {
      const msg = e?.message || "Auto-generation failed.";
      setAutoError(msg);

      // reflect partial success if one already succeeded
      setAutoMonthlyOk((prev) => (prev === true ? true : prev));
      setAutoQuarterlyOk((prev) => (prev === true ? true : prev));
    } finally {
      setAutoRunning(false);
    }
  }, [token, effectiveWorkflowId, overlayExecApiBase, fetchExistingDocuments, checkExistingForecasts]);

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
          submoduleVal: "EXECUTION",
        });

        if (result.ok) {
          setUploadedFiles((prev) => new Set(prev).add(fileName));
          setFailedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });

          if (docType === DOC_MONTHLY) {
            setMonthlyFiles((prev) => {
              if (prev.some((f) => f.name === fileName)) return prev;
              return [...prev, file];
            });
          } else if (docType === DOC_QUARTERLY) {
            setQuarterlyFiles((prev) => {
              if (prev.some((f) => f.name === fileName)) return prev;
              return [...prev, file];
            });
          }

          setSuccessBanner(`${fileName} uploaded successfully!`);
          setUploadModalOpen(false);
        } else {
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
            setQuarterlyFiles((prev) =>
              prev.filter((f) => f.name !== fileName)
            );
          }

          setFailedFilesForRetry((prev) => [...prev, file]);

          const validationStatus = result.data?.validation_status;
          const issueKind =
            validationStatus === "failed" ? "conflict" : "error";

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
    [
      token,
      workflowPathBase,
      effectiveWorkflowId,
      uploadedFiles,
      uploadingFiles,
    ]
  );

  // Dropzone handlers — upload new files, ignore placeholders from existing docs
  const handleMonthlyFilesChange = useCallback(
    async (files: File[]) => {
      setMonthlyFiles(files);
      for (const f of files) {
        if (
          !uploadedFiles.has(f.name) &&
          !uploadingFiles.has(f.name) &&
          !(f as any).isExisting
        ) {
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
        if (
          !uploadedFiles.has(f.name) &&
          !uploadingFiles.has(f.name) &&
          !(f as any).isExisting
        ) {
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

    if (totalFiles === 0)
      return { status: "empty", message: "No files uploaded yet." };
    if (uploadingCount > 0)
      return {
        status: "uploading",
        message: `Uploading ${uploadingCount} file(s)...`,
      };
    if (failedCount > 0)
      return {
        status: "error",
        message: `${failedCount} file(s) failed to upload.`,
      };
    if (uploadedCount === totalFiles)
      return {
        status: "success",
        message: `All ${uploadedCount} file(s) uploaded successfully!`,
      };
    return {
      status: "partial",
      message: `${uploadedCount}/${totalFiles} files uploaded.`,
    };
  }, [
    monthlyFiles.length,
    quarterlyFiles.length,
    uploadedFiles.size,
    uploadingFiles.size,
    failedFiles.size,
  ]);

  // Workflow picker
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

  const isAuto = mode === "AUTO_GENERATE";
  const disableUploads = isAuto || autoRunning;

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

      {/* Auto error banner */}
      {autoError && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Auto-generation failed</div>
              <div className="text-red-800">{autoError}</div>
            </div>
            <button
              onClick={() => setAutoError(null)}
              className="ml-2 text-red-600 hover:text-red-800"
              title="Dismiss error"
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
                  setMonthlyFiles((prev) => {
                    if (prev.some((f) => f.name === fileName)) return prev;
                    return [...prev, file];
                  });
                } else if (docType === DOC_QUARTERLY) {
                  setQuarterlyFiles((prev) => {
                    if (prev.some((f) => f.name === fileName)) return prev;
                    return [...prev, file];
                  });
                }

                setFailedFilesForRetry((prev) =>
                  prev.filter((f) => f.name !== fileName)
                );
                setSuccessBanner(
                  `${fileName} uploaded successfully with override!`
                );
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
            : uploadIssues.some(
                (i) => i.payload?.data?.validation_status === "error"
              )
            ? "Code error detected - cannot retry"
            : undefined
        }
      />

      <div className="rounded-3xl bg-white/80 backdrop-blur shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border border-gray-200">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">
              Execution Input Files
            </h3>
            <p className="text-xs text-gray-500">
              Accepted types: <span className="font-medium">{accept}</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Workflow ID: <span className="font-mono">{effectiveWorkflowId}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer"
              disabled={uploadingFiles.size > 0 || autoRunning}
              title="Pick from completed workflows"
            >
              Switch Workflow
            </button>

            {!isAuto && uploadStatus.status === "success" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                All Uploaded
              </span>
            )}
            {!isAuto && uploadStatus.status === "uploading" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-top-transparent" />
                Uploading...
              </span>
            )}
            {!isAuto && uploadStatus.status === "error" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Upload Failed
              </span>
            )}
            {!isAuto && uploadStatus.status === "partial" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Partial Upload
              </span>
            )}
          </div>
        </div>

        {/* ✅ Mode selector */}
        <div className="px-5 pt-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Choose input method</div>
              <div className="text-xs text-gray-500">
                You can either auto-generate the inputs from this workflow or upload your own ARIMA files.
              </div>
            </div>

            <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setMode("AUTO_GENERATE");
                  checkExistingForecasts();
                }}
                className={[
                  "cursor-pointer px-3 py-2 text-sm font-semibold rounded-xl transition",
                  isAuto
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                Generated Arima
              </button>
              <button
                type="button"
                onClick={() => setMode("UPLOAD_MANUAL")}
                className={[
                  "cursor-pointer px-3 py-2 text-sm font-semibold rounded-xl transition",
                  !isAuto
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                Upload manually
              </button>
            </div>
          </div>

          {/* AUTO controls */}
          {isAuto && (
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Auto-generate Monthly + Quarterly MEV ARIMA inputs
                  </div>
                  <div className="text-xs text-gray-600">
                    This will call the generator endpoints and store the generated files under your workflow.
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border",
                        autoMonthlyOk === true
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : autoMonthlyOk === false
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-white text-gray-700 border-gray-200",
                      ].join(" ")}
                    >
                      {autoMonthlyOk === true ? "✓" : autoMonthlyOk === false ? "!" : "•"} Monthly
                      
                    </span>

                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border",
                        autoQuarterlyOk === true
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : autoQuarterlyOk === false
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-white text-gray-700 border-gray-200",
                      ].join(" ")}
                    >
                      {autoQuarterlyOk === true ? "✓" : autoQuarterlyOk === false ? "!" : "•"} Quarterly
                      
                    </span>

                    {autoRunning && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-top-transparent" />
                        Generating...
                      </span>
                    )}
                  </div>

                  {(existingMonthlyFilename || existingQuarterlyFilename) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {existingMonthlyFilename && (
                        <button
                          type="button"
                          onClick={downloadMonthlyForecast}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                          title={`Download: ${existingMonthlyFilename}`}
                        >
                          <DocumentIcon className="h-4 w-4 text-gray-500" />
                          <span className="truncate max-w-[200px]">{existingMonthlyFilename}</span>
                        </button>
                      )}
                      {existingQuarterlyFilename && (
                        <button
                          type="button"
                          onClick={downloadQuarterlyForecast}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                          title={`Download: ${existingQuarterlyFilename}`}
                        >
                          <DocumentIcon className="h-4 w-4 text-gray-500" />
                          <span className="truncate max-w-[200px]">{existingQuarterlyFilename}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fetchExistingDocuments()}
                    disabled={autoRunning}
                    className="cursor-pointer inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                    title="Refresh and show generated/existing documents"
                  >
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={runAutoGenerate}
                    disabled={autoRunning || !token || !effectiveWorkflowId}
                    className="cursor-pointer inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                    title="Generate Monthly and Quarterly ARIMA inputs"
                  >
                    Generate inputs
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Body (dropzones) */}
        <div className="grid gap-5 p-5 md:grid-cols-2">
          {/* MONTHLY */}
          <div className="space-y-2">
            <div className="relative">
              <div className={disableUploads ? "pointer-events-none opacity-60" : ""}>
                <UploadDropzone
                  label="Monthly MEV ARIMA Input"
                  description={
                    isAuto
                      ? "Auto-generated from workflow (upload disabled)."
                      : "CSV or Excel. Name like: monthly_*_arima.*"
                  }
                  required
                  accept={accept}
                  maxSizeMB={maxSizeMB}
                  maxFiles={3}
                  value={monthlyFiles}
                  onChange={isAuto ? () => {} : handleMonthlyFilesChange}
                  emptyHint={
                    isAuto
                      ? "Click “Generate inputs” to create the monthly file…"
                      : "Waiting for monthly ARIMA file(s)…"
                  }
                  variant="card"
                />
              </div>

              {disableUploads && (
                <div className="absolute inset-0 rounded-2xl">
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white">
                      Upload disabled
                    </span>
                  </div>
                </div>
              )}

              {monthlyFiles.length > 0 &&
                monthlyFiles.every((f) => uploadedFiles.has(f.name)) && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                      <CheckCircleIcon className="h-3 w-3" />
                      Ready
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* QUARTERLY */}
          <div className="space-y-2">
            <div className="relative">
              <div className={disableUploads ? "pointer-events-none opacity-60" : ""}>
                <UploadDropzone
                  label="Quarterly MEV ARIMA Input"
                  description={
                    isAuto
                      ? "Auto-generated from workflow (upload disabled)."
                      : "CSV or Excel. Name like: quarterly_*_arima.*"
                  }
                  required
                  accept={accept}
                  maxSizeMB={maxSizeMB}
                  maxFiles={3}
                  value={quarterlyFiles}
                  onChange={isAuto ? () => {} : handleQuarterlyFilesChange}
                  emptyHint={
                    isAuto
                      ? "Click “Generate inputs” to create the quarterly file…"
                      : "Waiting for quarterly ARIMA file(s)…"
                  }
                  variant="card"
                />
              </div>

              {disableUploads && (
                <div className="absolute inset-0 rounded-2xl">
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white">
                      Upload disabled
                    </span>
                  </div>
                </div>
              )}

              {quarterlyFiles.length > 0 &&
                quarterlyFiles.every((f) => uploadedFiles.has(f.name)) && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                      <CheckCircleIcon className="h-3 w-3" />
                      Ready
                    </span>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Footer summary */}
        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-gray-600">
            {!isAuto ? (
              <>
                <div className="mb-1">{uploadStatus.message}</div>
                {(monthlyFiles.length > 0 || quarterlyFiles.length > 0) && (
                  <div className="text-gray-500">Files: {summary}</div>
                )}
              </>
            ) : (
              <>
                <div className="mb-1">
                  Auto mode enabled. Upload is disabled.
                </div>
                <div className="text-gray-500">
                  Generated/existing files will appear above after Refresh or Generate.
                </div>
              </>
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
