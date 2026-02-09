// src/pages/execution/Step1.tsx
import { useMemo, useState, useCallback, useEffect } from "react";
import UploadDropzone from "../../../../components/ui/UploadDropzone";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CloudArrowDownIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { setModuleProgress } from "../../../../redux_toolkit/features/progress/moduleProgressSlice";
import { overlayUploadFile } from "../../../../services/upload";

import {
  useAppDispatch,
  useAppSelector,
} from "../../../../redux_toolkit/hooks";
import { setExecutionInputFile } from "../../../../redux_toolkit/features/overlay/executionInputFileSlice";
import { setFinalModelExecutionFile } from "../../../../redux_toolkit/features/overlay/finalModelExecutionFileSlice";
import { setHistoricalWeightedCreditLossRateFile } from "../../../../redux_toolkit/features/overlay/historicalWeightedCreditLossRateFileSlice";
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
  setPdTransitionMatrixSelectedLoanProduct,
  setPdTransitionMatrixWorkflowData,
} from "../../../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

import type { Workflow } from "../../../../services/workflow";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const toNumberSafe = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/* -----------------------------------------------------------
   Execution document types
----------------------------------------------------------- */
const DOC_MONTHLY = "OVERLAY_EXECUTION_MONTHLY_HISTORICAL_MEV" as const;
const DOC_QUARTERLY = "OVERLAY_EXECUTION_QUARTERLY_HISTORICAL_MEV" as const;
const DOC_FINAL_MODEL = "OVERLAY_EXECUTION_FINAL_MODEL" as const;
const DOC_HISTORICAL_WEIGHTED =
  "OVERLAY_EXECUTION_HISTORICAL_WEIGHTED_CREDIT_LOSS_RATE" as const;
type ExecDocType =
  | typeof DOC_MONTHLY
  | typeof DOC_QUARTERLY
  | typeof DOC_FINAL_MODEL
  | typeof DOC_HISTORICAL_WEIGHTED;

function inferExecDocTypeFromName(name: string): ExecDocType | null {
  const base = name.toLowerCase();
  if (/monthly/.test(base)) return DOC_MONTHLY;
  if (/quarter/.test(base)) return DOC_QUARTERLY;
  if (/final.*model/.test(base) || /model.*final/.test(base)) return DOC_FINAL_MODEL;
  if (
    /historical.*weighted/.test(base) ||
    /weighted.*credit.*loss/.test(base) ||
    /historical.*credit.*loss/.test(base) ||
    /historical.*rates/.test(base)
  )
    return DOC_HISTORICAL_WEIGHTED;
  return null;
}

// function composeWorkflowPathWithDocType(basePath: string, docType: ExecDocType) {
//   return `${basePath.replace(/\/+$/g, "")}/${docType}`;
// }

const mimeFromName = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/vnd.ms-excel";
};

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
const uniqueFiles = (files: File[]) =>
  Array.from(new Map(files.map((f) => [fileKey(f), f])).values());

/* -----------------------------------------------------------
   Existing doc type (keeps sizeBytes etc.)
----------------------------------------------------------- */
type ExistingDocFile = File & {
  isExisting?: boolean;
  documentId?: number | string;
  sizeBytes?: number;
  serverFilename?: string;
  documentType?: ExecDocType | string;
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
  const executionInputFile = useAppSelector(
    (s) => s.executionInputFile.execution_input_file
  );
  const finalModelExecutionFile = useAppSelector(
    (s) => s.finalModelExecutionFile.final_model_execution_file
  );
  const historicalWeightedCreditLossRateFile = useAppSelector(
    (s) =>
      s.historicalWeightedCreditLossRateFile
        .historical_weighted_credit_loss_rate_file
  );

  // mode: AUTO_GENERATE or UPLOAD_MANUAL (synced with Redux executionInputFile)
  const [mode, setMode] = useState<"AUTO_GENERATE" | "UPLOAD_MANUAL">(
    executionInputFile === "forecast_mev" ? "AUTO_GENERATE" : "UPLOAD_MANUAL"
  );

  // Single-file-per-slot arrays (length 0 or 1)
  // NOTE: separate auto vs manual for monthly & quarterly to prevent leakage.
  const [monthlyFiles, setMonthlyFiles] = useState<ExistingDocFile[]>([]); // manual monthly
  const [quarterlyFiles, setQuarterlyFiles] = useState<ExistingDocFile[]>([]); // manual quarterly
  const [autoMonthlyFiles, setAutoMonthlyFiles] = useState<ExistingDocFile[]>([]); // auto-generated/manual-uploaded while in AUTO
  const [autoQuarterlyFiles, setAutoQuarterlyFiles] = useState<ExistingDocFile[]>([]);

  // final model & historical weighted are shared (only manual upload typically)
  const [finalModelFiles, setFinalModelFiles] = useState<ExistingDocFile[]>([]);
  const [historicalWeightedFiles, setHistoricalWeightedFiles] = useState<
    ExistingDocFile[]
  >([]);

  // upload state (tracked by filename)
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(
    new Set()
  );
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(
    new Set()
  );
  const [failedFiles, setFailedFiles] = useState<Set<string>>(new Set());
  const [failedFilesForRetry, setFailedFilesForRetry] = useState<File[]>(
    []
  );

  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [uploadIssues, setUploadIssues] = useState<IssueRow[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [skipFetchExisting, setSkipFetchExisting] = useState(false);

  // auto-generation state (kept)
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoMonthlyOk, setAutoMonthlyOk] = useState<boolean | null>(
    null
  );
  const [autoQuarterlyOk, setAutoQuarterlyOk] = useState<boolean | null>(
    null
  );
  const [autoError, setAutoError] = useState<string | null>(null);
  const [existingMonthlyFilename, setExistingMonthlyFilename] = useState<
    string | null
  >(null);
  const [existingQuarterlyFilename, setExistingQuarterlyFilename] =
    useState<string | null>(null);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  const baseDir = `/${entity}/${period}/${workflowName}`.replace(/^\/+/, "");
  const workflowPathBase = `${baseDir}/input/overlay/execution/${loanproduct}`;
  const effectiveWorkflowId = selectedWorkflowId ?? 1;
  const overlayExecApiBase = `${API_BASE.replace(/\/+$/g, "")}/api/overlay/execution`;

  /* -----------------------------------------------------------
     Clear local state on workflow change
  ----------------------------------------------------------- */
  const clearAll = useCallback(() => {
    setMonthlyFiles([]);
    setQuarterlyFiles([]);
    setAutoMonthlyFiles([]);
    setAutoQuarterlyFiles([]);
    setFinalModelFiles([]);
    setHistoricalWeightedFiles([]);
    setUploadingFiles(new Set());
    setUploadedFiles(new Set());
    setFailedFiles(new Set());
    setFailedFilesForRetry([]);
    setSuccessBanner(null);
    setUploadIssues([]);
    setUploadModalOpen(false);

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

  /* -----------------------------------------------------------
     Fetch existing execution documents (single per slot)
     -> We populate both auto and manual slots for server-persisted files.
     This means backend-stored documents are shown regardless of input mode.
     Only session uploads are kept separate (auto vs manual).
  ----------------------------------------------------------- */
  const fetchExistingDocuments = useCallback(async () => {
    if (!selectedWorkflowId || !token) return;
    
    // Skip fetching if we just uploaded a new file (to prevent overwriting the new upload)
    if (skipFetchExisting) {
      return;
    }

    const documentTypes = [
      DOC_MONTHLY,
      DOC_QUARTERLY,
      DOC_FINAL_MODEL,
      DOC_HISTORICAL_WEIGHTED,
    ].join(",");

    try {
      const resp = await fetch(
        `${API_BASE}/documents/workflow-documents/?workflow_id=${selectedWorkflowId}&document_types=${encodeURIComponent(
          documentTypes
        )}`,
        {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }
      );
      if (!resp.ok) return;
      const result = await resp.json();
      if (!result?.success || !Array.isArray(result.data)) return;

      const nextMonthly: ExistingDocFile[] = [];
      const nextQuarterly: ExistingDocFile[] = [];
      const nextFinal: ExistingDocFile[] = [];
      const nextHistWeighted: ExistingDocFile[] = [];
      const nextUploaded = new Set<string>();

      for (const doc of result.data as any[]) {
        const displayName = doc.original_filename || doc.filename;
        const f = new File([], displayName, { type: mimeFromName(displayName) }) as ExistingDocFile;
        f.isExisting = true;
        f.documentId = doc.id;
        f.sizeBytes = toNumberSafe(
          doc.size_bytes ?? doc.size ?? doc.bytes ?? doc.file_size
        );
        f.serverFilename = doc.filename;
        f.documentType = doc.document_type;
        f.createdAt = doc.created_at;

        nextUploaded.add(displayName);

        if (doc.document_type === DOC_MONTHLY) nextMonthly.push(f);
        else if (doc.document_type === DOC_QUARTERLY) nextQuarterly.push(f);
        else if (doc.document_type === DOC_FINAL_MODEL) nextFinal.push(f);
        else if (doc.document_type === DOC_HISTORICAL_WEIGHTED) nextHistWeighted.push(f);
      }

      // update both manual and auto slots with persisted documents
      setMonthlyFiles(nextMonthly.slice(0, 1));
      setAutoMonthlyFiles(nextMonthly.slice(0, 1));
      setQuarterlyFiles(nextQuarterly.slice(0, 1));
      setAutoQuarterlyFiles(nextQuarterly.slice(0, 1));
      setFinalModelFiles(nextFinal.slice(0, 1));
      setHistoricalWeightedFiles(nextHistWeighted.slice(0, 1));
      setUploadedFiles(nextUploaded);
    } catch (err) {
      console.error("Failed to fetch execution docs:", err);
    }
  }, [selectedWorkflowId, token, skipFetchExisting]);

  useEffect(() => {
    if (selectedWorkflowId) fetchExistingDocuments();
  }, [selectedWorkflowId, fetchExistingDocuments]);

  /* -----------------------------------------------------------
     Auto-generate helpers (kept)
  ----------------------------------------------------------- */
  async function postWorkflowIdFormData(args: {
    token: string;
    workflowId: number;
    endpoint: string;
  }) {
    const fd = new FormData();
    fd.append("workflow_id", String(args.workflowId));
    const res = await fetch(args.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.token}` },
      body: fd,
    });
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {}
    if (!res.ok) {
      const msg = payload?.detail || payload?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return payload;
  }

  const checkExistingForecasts = useCallback(async () => {
    if (!token || !effectiveWorkflowId) return;
    try {
      const monthlyRes = await fetch(`${overlayExecApiBase}/mev_monthly_arima_forecast?workflow_id=${effectiveWorkflowId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (monthlyRes.ok) {
        const j = await monthlyRes.json();
        setExistingMonthlyFilename(j?.data ?? null);
      } else setExistingMonthlyFilename(null);

      const quarterlyRes = await fetch(`${overlayExecApiBase}/mev_quarterly_arima_forecast?workflow_id=${effectiveWorkflowId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (quarterlyRes.ok) {
        const j = await quarterlyRes.json();
        setExistingQuarterlyFilename(j?.data ?? null);
      } else setExistingQuarterlyFilename(null);
    } catch (err) {
      console.error("Error checking existing forecasts:", err);
    }
  }, [token, effectiveWorkflowId, overlayExecApiBase]);

  useEffect(() => {
    if (selectedWorkflowId) checkExistingForecasts();
  }, [selectedWorkflowId, checkExistingForecasts]);

  const downloadBlobAndTrigger = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const downloadMonthlyForecast = useCallback(async () => {
    if (!token || !effectiveWorkflowId) return;
    try {
      const resp = await fetch(`${overlayExecApiBase}/mev_monthly_arima_forecast/export/?workflow_id=${effectiveWorkflowId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to download monthly forecast");
      const blob = await resp.blob();
      downloadBlobAndTrigger(blob, existingMonthlyFilename || "monthly_arima_forecast.xlsx");
    } catch (err) {
      console.error("Error downloading monthly forecast:", err);
    }
  }, [token, effectiveWorkflowId, overlayExecApiBase, existingMonthlyFilename]);

  const downloadQuarterlyForecast = useCallback(async () => {
    if (!token || !effectiveWorkflowId) return;
    try {
      const resp = await fetch(`${overlayExecApiBase}/mev_quarterly_arima_forecast/export/?workflow_id=${effectiveWorkflowId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to download quarterly forecast");
      const blob = await resp.blob();
      downloadBlobAndTrigger(blob, existingQuarterlyFilename || "quarterly_arima_forecast.xlsx");
    } catch (err) {
      console.error("Error downloading quarterly forecast:", err);
    }
  }, [token, effectiveWorkflowId, overlayExecApiBase, existingQuarterlyFilename]);

  // ---------- NEW: small helper sleep ----------
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // ---------- NEW: attemptPostWithRetries ----------
  const attemptPostWithRetries = useCallback(
    async (endpoint: string, maxAttempts = 3) => {
      if (!token || !effectiveWorkflowId) throw new Error("Missing token or workflowId");
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const payload = await postWorkflowIdFormData({
            token,
            workflowId: effectiveWorkflowId,
            endpoint,
          });
          return { success: true, payload };
        } catch (err: any) {
          lastError = err;
          // exponential backoff (slight)
          const backoff = 500 * Math.pow(2, attempt - 1);
          await sleep(backoff);
        }
      }
      return { success: false, error: lastError?.message ?? "Unknown error after retries" };
    },
    [token, effectiveWorkflowId]
  );

  const runAutoGenerate = useCallback(async () => {
    if (!token || !effectiveWorkflowId) return;
    setAutoRunning(true);
    setAutoMonthlyOk(null);
    setAutoQuarterlyOk(null);
    setAutoError(null);
    setSuccessBanner(null);

    const monthlyEndpoint = `${overlayExecApiBase}/mev_monthly_arima_forecast`;
    const quarterlyEndpoint = `${overlayExecApiBase}/mev_quarterly_arima_forecast`;

    try {
      // Attempt monthly with retries
      const monthlyRes = await attemptPostWithRetries(monthlyEndpoint, 3);
      if (monthlyRes.success) {
        setAutoMonthlyOk(true);
      } else {
        setAutoMonthlyOk(false);
      }

      // Attempt quarterly with retries
      const quarterlyRes = await attemptPostWithRetries(quarterlyEndpoint, 3);
      if (quarterlyRes.success) {
        setAutoQuarterlyOk(true);
      } else {
        setAutoQuarterlyOk(false);
      }

      // If both succeeded -> success path
      if (monthlyRes.success && quarterlyRes.success) {
        setSuccessBanner("Auto-generated Monthly & Quarterly ARIMA inputs successfully.");
        await fetchExistingDocuments();
        await checkExistingForecasts();
        return;
      }

      // If one or both failed, give the backend a short moment, re-check if files landed
      await sleep(1000);
      await fetchExistingDocuments();
      await checkExistingForecasts();

      // If files now exist, mark them ok
      let fallbackMonthlyOk = autoMonthlyOk;
      let fallbackQuarterlyOk = autoQuarterlyOk;

      if (!monthlyRes.success && existingMonthlyFilename) {
        setAutoMonthlyOk(true);
        fallbackMonthlyOk = true;
      }
      if (!quarterlyRes.success && existingQuarterlyFilename) {
        setAutoQuarterlyOk(true);
        fallbackQuarterlyOk = true;
      }

      // If either still failed, compose an error
      const monthlyErr = monthlyRes.success ? null : monthlyRes.error;
      const quarterlyErr = quarterlyRes.success ? null : quarterlyRes.error;

      if ((!monthlyRes.success && !existingMonthlyFilename) || (!quarterlyRes.success && !existingQuarterlyFilename)) {
        const msgs: string[] = [];
        if (monthlyErr && !existingMonthlyFilename) msgs.push(`Monthly: ${monthlyErr}`);
        if (quarterlyErr && !existingQuarterlyFilename) msgs.push(`Quarterly: ${quarterlyErr}`);
        const combined = msgs.join(" | ") || "Auto-generation failed for unknown reasons.";
        setAutoError(combined);
        // still show partial success banner if one succeeded
        if (monthlyRes.success || quarterlyRes.success || existingMonthlyFilename || existingQuarterlyFilename) {
          setSuccessBanner("Auto-generation partially succeeded. Check the available generated files above.");
        }
      } else {
        // both either succeeded or file fallback found
        setSuccessBanner("Auto-generated Monthly & Quarterly ARIMA inputs (detected after retry/refresh).");
      }
    } catch (e: any) {
      setAutoError(e?.message || "Auto-generation failed.");
    } finally {
      // refresh persisted documents & forecast filenames
      try {
        await fetchExistingDocuments();
        await checkExistingForecasts();
      } catch (err) {
        // ignore
      }
      setAutoRunning(false);
    }
  }, [
    token,
    effectiveWorkflowId,
    overlayExecApiBase,
    attemptPostWithRetries,
    fetchExistingDocuments,
    checkExistingForecasts,
    existingMonthlyFilename,
    existingQuarterlyFilename,
    autoMonthlyOk,
    autoQuarterlyOk,
  ]);

  /* -----------------------------------------------------------
     Single-file upload helper
     - reads `mode` to place successful files into correct slot (auto vs manual)
     - resets previous issues before attempting upload (so modal will re-open)
  ----------------------------------------------------------- */
  const uploadFile = useCallback(
    async (file: File, docType: ExecDocType, override: boolean = false) => {
      if (!file) return;
      const fileName = file.name;
      if (!token) return;

      // Reset previous issues for this attempt so modal will reliably reopen.
      setUploadIssues([]);
      setUploadModalOpen(false);

      // Check if already uploading - if so, don't start another upload
      // But allow re-upload if it was previously uploaded (override allows replacement)
      if (uploadingFiles.has(fileName)) return;

      setUploadingFiles((prev) => new Set(prev).add(fileName));

      try {
        const finalWorkflowPath = `${workflowPathBase}/${docType}`;
        const result = await overlayUploadFile({
          baseUrl: API_BASE,
          token,
          file,
          workflowPath: finalWorkflowPath,
          documentType: docType,
          workflowId: effectiveWorkflowId,
          override,
          moduleVal: "OVERLAY",
          submoduleVal: "EXECUTION",
        });

        if (result.ok) {
          // mark uploaded
          setUploadedFiles((prev) => new Set(prev).add(fileName));
          setFailedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });

          // successful -> put file into appropriate slot based on docType & current mode
          const asExisting: ExistingDocFile = Object.assign(file, {
            sizeBytes: (file as any).size ?? (file as any).sizeBytes,
            isExisting: false,
            documentType: docType,
          });

          // monthly/quarterly should live in separate auto/manual slots
          if (docType === DOC_MONTHLY) {
            if (mode === "AUTO_GENERATE") setAutoMonthlyFiles([asExisting]);
            else setMonthlyFiles([asExisting]);
          } else if (docType === DOC_QUARTERLY) {
            if (mode === "AUTO_GENERATE") setAutoQuarterlyFiles([asExisting]);
            else setQuarterlyFiles([asExisting]);
          } else if (docType === DOC_FINAL_MODEL) {
            setFinalModelFiles([asExisting]);
          } else if (docType === DOC_HISTORICAL_WEIGHTED) {
            setHistoricalWeightedFiles([asExisting]);
          }

          setSuccessBanner(`${fileName} uploaded successfully!`);
          setUploadModalOpen(false);
          setUploadIssues([]);
          // Prevent fetchExistingDocuments from overwriting the newly uploaded file
          setSkipFetchExisting(true);
          // Reset the skip flag after a delay to allow future fetches
          setTimeout(() => setSkipFetchExisting(false), 2000);
          return;
        }

        // server ok === false
        setFailedFiles((prev) => new Set(prev).add(fileName));
        setUploadedFiles((prev) => {
          const ns = new Set(prev);
          ns.delete(fileName);
          return ns;
        });
        setFailedFilesForRetry((prev) => [...prev, file]);

        const issue: IssueRow = {
          fileName,
          status: result.status || 0,
          ok: result.ok,
          kind: result.data?.validation_status === "failed" ? "conflict" : "error",
          payload: result.data ?? result,
          normalized: normalizeUploadError(result.data ?? result),
        };

        // IMPORTANT: always create a new array/object to force React state update
        setUploadIssues([issue]);
        setUploadModalOpen(true);
        setSuccessBanner(null);
      } catch (err: any) {
        console.error("Upload failed:", err);
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
          payload: { error: err?.message, caughtError: err },
          normalized: normalizeUploadError(err),
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
    // include mode so uploadFile places file in correct slot
    [token, workflowPathBase, effectiveWorkflowId, uploadingFiles, mode]
  );

  /* -----------------------------------------------------------
     Generic single-file dropzone handler (uses active slot based on mode)
     - uniqueFiles + pick last ensures single-file behavior
     - only uploads if file is not existing placeholder AND not currently uploading
  ----------------------------------------------------------- */
  const handleFilesChange = useCallback(
    async (
      files: File[],
      docType: ExecDocType,
      isAutoSlot: boolean,
      setFilesAuto: (f: File[]) => void,
      setFilesManual: (f: File[]) => void
    ) => {
      const single = uniqueFiles(files).slice(-1);
      if (isAutoSlot) {
        setFilesAuto(single as ExistingDocFile[]);
      } else {
        setFilesManual(single as ExistingDocFile[]);
      }

      const f = single[0];
      if (!f) return;

      // Reset skip flag when user selects a new file
      setSkipFetchExisting(false);

      // Remove from uploadedFiles and failedFiles to allow re-uploading the same file
      setUploadedFiles((prev) => {
        const ns = new Set(prev);
        ns.delete(f.name);
        return ns;
      });
      setFailedFiles((prev) => {
        const ns = new Set(prev);
        ns.delete(f.name);
        return ns;
      });
      setUploadingFiles((prev) => {
        const ns = new Set(prev);
        ns.delete(f.name);
        return ns;
      });

      // Small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 0));

      // if placeholder from server, don't attempt upload
      if ((f as any).isExisting) return;

      // if same name is currently uploading - skip
      if (uploadingFiles.has(f.name)) return;

      // always attempt upload (even if previously failed) — uploadFile will handle marking
      await uploadFile(f, docType);
    },
    [uploadFile]
  );

  /* -----------------------------------------------------------
     Status & summary
  ----------------------------------------------------------- */
  const activeMonthlyFiles = mode === "AUTO_GENERATE" ? autoMonthlyFiles : monthlyFiles;
  const activeQuarterlyFiles = mode === "AUTO_GENERATE" ? autoQuarterlyFiles : quarterlyFiles;

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (activeMonthlyFiles.length) parts.push("1 monthly");
    if (activeQuarterlyFiles.length) parts.push("1 quarterly");
    if (finalModelFiles.length) parts.push("1 final model");
    if (historicalWeightedFiles.length) parts.push("1 historical weighted");
    return parts.join(" - ");
  }, [activeMonthlyFiles.length, activeQuarterlyFiles.length, finalModelFiles.length, historicalWeightedFiles.length]);

  const uploadStatus = useMemo(() => {
    const selected = [...activeMonthlyFiles, ...activeQuarterlyFiles, ...finalModelFiles, ...historicalWeightedFiles];
    const totalFiles = selected.length;
    const uploadedCount = selected.filter((f) => uploadedFiles.has(f.name)).length;
    const uploadingCount = selected.filter((f) => uploadingFiles.has(f.name)).length;
    const failedCount = selected.filter((f) => failedFiles.has(f.name)).length;

    if (totalFiles === 0) return { status: "empty" as const, message: "No files uploaded yet." };
    if (uploadingCount > 0) return { status: "uploading" as const, message: `Uploading ${uploadingCount} file(s)...` };
    if (failedCount > 0) return { status: "error" as const, message: `${failedCount} file(s) failed to upload.` };
    if (uploadedCount === totalFiles) return { status: "success" as const, message: `All ${uploadedCount} file(s) uploaded successfully!` };
    return { status: "partial" as const, message: `${uploadedCount}/${totalFiles} files uploaded.` };
  }, [activeMonthlyFiles, activeQuarterlyFiles, finalModelFiles, historicalWeightedFiles, uploadedFiles, uploadingFiles, failedFiles]);

  /* -----------------------------------------------------------
     Persist Step 1 validity
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!Number.isFinite(selectedWorkflowId)) return;
    dispatch(setModuleProgress({ moduleKey: "overlayExecution", contextKey: String(selectedWorkflowId), data: { step1Valid: uploadStatus.status === "success" } }));
  }, [dispatch, selectedWorkflowId, uploadStatus.status]);

  /* -----------------------------------------------------------
     Workflow picker
  ----------------------------------------------------------- */
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
      // Update workflow data to ensure currentPdTransitionMatrixWorkflowData is in sync
      dispatch(setPdTransitionMatrixWorkflowData({ workflow_data: w as any }));

      setPickerOpen(false);
    },
    [dispatch]
  );

  /* -----------------------------------------------------------
     Sync mode with Redux
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!executionInputFile) dispatch(setExecutionInputFile("manual_upload"));
  }, [executionInputFile, dispatch]);

  useEffect(() => {
    if (executionInputFile === "forecast_mev") setMode("AUTO_GENERATE");
    else setMode("UPLOAD_MANUAL");
  }, [executionInputFile]);

  const isAuto = mode === "AUTO_GENERATE";

  /* -----------------------------------------------------------
     Retry handler (modal proceed)
  ----------------------------------------------------------- */
  const handleRetryProceed = useCallback(async () => {
    const failedNames = Array.from(failedFiles);
    const retryFiles = failedFilesForRetry.filter((f) => failedNames.includes(f.name));
    for (const file of retryFiles) {
      const docType = inferExecDocTypeFromName(file.name);
      if (!docType) continue;
      // Use uploadFile with override: true when retrying
      await uploadFile(file, docType, true);
    }
    setUploadModalOpen(false);
  }, [failedFiles, failedFilesForRetry, uploadFile]);

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
            <button onClick={() => setSuccessBanner(null)} className="ml-2 text-emerald-600 hover:text-emerald-800" title="Dismiss" type="button">×</button>
          </div>
        </div>
      )}

      {/* Auto error */}
      {autoError && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Auto-generation failed</div>
              <div className="text-red-800">{autoError}</div>
            </div>
            <button onClick={() => setAutoError(null)} className="ml-2 text-red-600 hover:text-red-800" title="Dismiss">×</button>
          </div>
        </div>
      )}

      {/* Upload Results / Retry Modal */}
      <OverlayUploadResultModal
        open={uploadModalOpen}
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

      <div className="rounded-3xl bg-white/80 backdrop-blur shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">Inputs</h3>
            <p className="mt-1 text-xs text-gray-600">Workflow: {workflowName || "—"}</p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setPickerOpen(true)} className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50" disabled={uploadingFiles.size > 0 || autoRunning} title="Pick from completed workflows">Switch Workflow</button>

            {!isAuto && uploadStatus.status === "success" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><CheckCircleIcon className="h-4 w-4" />All Uploaded</span>}
            {!isAuto && uploadStatus.status === "uploading" && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"><div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-top-transparent" />Uploading...</span>}
            {!isAuto && uploadStatus.status === "error" && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"><ExclamationTriangleIcon className="h-4 w-4" />Upload Failed</span>}
            {!isAuto && uploadStatus.status === "partial" && <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700"><ExclamationTriangleIcon className="h-4 w-4" />Partial Upload</span>}
          </div>
        </div>

        {/* Mode selector */}
        <div className="px-5 pt-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Choose input method</div>
              <div className="text-xs text-gray-500">You can either auto-generate the inputs from this workflow or upload your own ARIMA files.</div>
            </div>

            <div className="inline-flex rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
              <button type="button" onClick={() => { setMode("AUTO_GENERATE"); dispatch(setExecutionInputFile("forecast_mev")); checkExistingForecasts(); }} className={["cursor-pointer px-3 py-2 text-sm font-semibold rounded-xl transition", isAuto ? "bg-gray-100 text-gray-900 border border-gray-200" : "text-gray-700 hover:bg-gray-50"].join(" ")}>Forecast MEV</button>
              <button type="button" onClick={() => { setMode("UPLOAD_MANUAL"); dispatch(setExecutionInputFile("manual_upload")); }} className={["cursor-pointer px-3 py-2 text-sm font-semibold rounded-xl transition", !isAuto ? "bg-gray-100 text-gray-900 border border-gray-200" : "text-gray-700 hover:bg-gray-50"].join(" ")}>Upload manually</button>
            </div>
          </div>

          {/* AUTO controls */}
          {isAuto && (
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Auto-generate Monthly + Quarterly MEV inputs</div>
                  <div className="text-xs text-gray-600">This will call the generator endpoints and store the generated files under your workflow.</div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={["inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border", autoMonthlyOk === true ? "bg-emerald-50 text-emerald-700 border-emerald-200" : autoMonthlyOk === false ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-gray-700 border-gray-200"].join(" ")}>{autoMonthlyOk === true ? "OK" : autoMonthlyOk === false ? "!" : "-"} Monthly</span>
                    <span className={["inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border", autoQuarterlyOk === true ? "bg-emerald-50 text-emerald-700 border-emerald-200" : autoQuarterlyOk === false ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-gray-700 border-gray-200"].join(" ")}>{autoQuarterlyOk === true ? "OK" : autoQuarterlyOk === false ? "!" : "-"} Quarterly</span>

                    {autoRunning && <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200"><div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-top-transparent" />Generating...</span>}
                  </div>

                  {(existingMonthlyFilename || existingQuarterlyFilename) && (
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-600 mb-1.5">Generated Forecast Results:</div>
                      <div className="flex flex-wrap gap-2">
                        {existingMonthlyFilename && <button type="button" onClick={downloadMonthlyForecast} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"><CloudArrowDownIcon className="h-4 w-4 text-gray-500" /><span className="truncate max-w-[200px]">{existingMonthlyFilename}</span></button>}
                        {existingQuarterlyFilename && <button type="button" onClick={downloadQuarterlyForecast} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"><CloudArrowDownIcon className="h-4 w-4 text-gray-500" /><span className="truncate max-w-[200px]">{existingQuarterlyFilename}</span></button>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => fetchExistingDocuments()} disabled={autoRunning} className="cursor-pointer inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60">Refresh</button>
                  <button type="button" onClick={runAutoGenerate} disabled={autoRunning || !token || !effectiveWorkflowId} className="cursor-pointer inline-flex items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-60">Generate inputs</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Body (dropzones) */}
        <div className="grid gap-5 p-5 md:grid-cols-2">
          {/* Monthly */}
          <div className="space-y-2">
            <div className="relative">
              <UploadDropzone
                label={isAuto ? "Monthly MEV Input" : "Monthly MEV ARIMA Input"}
                description="CSV or Excel."
                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                // value shows the slot appropriate for current mode
                value={isAuto ? autoMonthlyFiles : monthlyFiles}
                onChange={(f) => handleFilesChange(f, DOC_MONTHLY, isAuto, setAutoMonthlyFiles, setMonthlyFiles)}
                emptyHint="Waiting for monthly file..."
                variant="card"
              />

              {(isAuto ? autoMonthlyFiles : monthlyFiles).length > 0 &&
                (isAuto ? autoMonthlyFiles : monthlyFiles).every((f) => uploadedFiles.has(f.name)) && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                      <CheckCircleIcon className="h-3 w-3" />
                      Ready
                    </span>
                  </div>
                )}

         
            </div>
          </div>

          {/* Quarterly */}
          <div className="space-y-2">
            <div className="relative">
              <UploadDropzone
                label={isAuto ? "Quarterly MEV Input" : "Quarterly MEV ARIMA Input"}
                description="CSV or Excel."
                required
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                value={isAuto ? autoQuarterlyFiles : quarterlyFiles}
                onChange={(f) => handleFilesChange(f, DOC_QUARTERLY, isAuto, setAutoQuarterlyFiles, setQuarterlyFiles)}
                emptyHint="Waiting for quarterly file..."
                variant="card"
              />

              {(isAuto ? autoQuarterlyFiles : quarterlyFiles).length > 0 &&
                (isAuto ? autoQuarterlyFiles : quarterlyFiles).every((f) => uploadedFiles.has(f.name)) && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                      <CheckCircleIcon className="h-3 w-3" />
                      Ready
                    </span>
                  </div>
                )}

            </div>
          </div>

          {/* Final model */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Use Final Model</span>
                <span className="relative group inline-flex items-center">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    If toggled on, overlay execution uploaded final model will be used. If off, development final models will be used.
                  </span>
                </span>
              </div>
              <button type="button" onClick={() => dispatch(setFinalModelExecutionFile(!finalModelExecutionFile))} className={["relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2", finalModelExecutionFile ? "bg-emerald-500" : "bg-gray-200"].join(" ")} role="switch" aria-checked={finalModelExecutionFile}>
                <span className={["pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out", finalModelExecutionFile ? "translate-x-5" : "translate-x-0"].join(" ")} />
              </button>
            </div>

            <div className="relative">
              <UploadDropzone
                label="Final Model"
                description="CSV or Excel."
                required={false}
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                value={finalModelFiles}
                onChange={(f) => handleFilesChange(f, DOC_FINAL_MODEL, false, setFinalModelFiles, setFinalModelFiles)}
                emptyHint="Waiting for final model file..."
                variant="card"
              />

              {finalModelFiles.length > 0 && finalModelFiles.every((f) => uploadedFiles.has(f.name)) && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircleIcon className="h-3 w-3" />
                    Ready
                  </span>
                </div>
              )}

        
            </div>
          </div>

          {/* Historical weighted */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Use Historical Weighted Credit Loss Rates</span>
                <span className="relative group inline-flex items-center">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-80 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    If toggled on, overlay execution uploaded historical weighted credit loss will be used. If off, development historical weighted credit loss will be used.
                  </span>
                </span>
              </div>
              <button type="button" onClick={() => dispatch(setHistoricalWeightedCreditLossRateFile(!historicalWeightedCreditLossRateFile))} className={["relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2", historicalWeightedCreditLossRateFile ? "bg-emerald-500" : "bg-gray-200"].join(" ")} role="switch" aria-checked={historicalWeightedCreditLossRateFile}>
                <span className={["pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out", historicalWeightedCreditLossRateFile ? "translate-x-5" : "translate-x-0"].join(" ")} />
              </button>
            </div>

            <div className="relative">
              <UploadDropzone
                label="Historical Weighted Credit Loss Rates"
                description="CSV or Excel."
                required={false}
                accept={accept}
                maxSizeMB={maxSizeMB}
                maxFiles={1}
                multiple={false}
                value={historicalWeightedFiles}
                onChange={(f) => handleFilesChange(f, DOC_HISTORICAL_WEIGHTED, false, setHistoricalWeightedFiles, setHistoricalWeightedFiles)}
                emptyHint="Waiting for historical weighted credit loss rates file..."
                variant="card"
              />

              {historicalWeightedFiles.length > 0 && historicalWeightedFiles.every((f) => uploadedFiles.has(f.name)) && (
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

        {/* Footer */}
        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-gray-600">
            {!isAuto ? (
              <>
                <div className="mb-1">{uploadStatus.message}</div>
                {(activeMonthlyFiles.length > 0 || activeQuarterlyFiles.length > 0 || finalModelFiles.length > 0 || historicalWeightedFiles.length > 0) && (
                  <div className="text-gray-500">Files: {summary}</div>
                )}
              </>
            ) : (
              <>
                <div className="mb-1">Auto mode enabled. Upload is disabled.</div>
                <div className="text-gray-500">Generated/existing files will appear above after Refresh or Generate.</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Workflow picker */}
      <WorkflowPickerModal open={pickerOpen} token={token} onClose={() => setPickerOpen(false)} onSelect={handlePickWorkflow} />
    </div>
  );
}
