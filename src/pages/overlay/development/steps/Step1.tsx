// src/pages/execution/Step1.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { OdInputsAbout } from "../../../../components/about/OverlayDevelopmentAbout";
import UploadDropzone from "../../../../components/ui/UploadDropzone";
import OverlayUploadResultModal, { type IssueRow } from "../../../../components/modals/OverlayUploadResultModal";
import WorkflowPickerModal from "../../../../components/modals/WorkflowPickerModal";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useAppDispatch, useAppSelector } from "../../../../redux_toolkit/hooks";
import { setModuleProgress } from "../../../../redux_toolkit/features/progress/moduleProgressSlice";
import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWorkflowId,
  setPdTransitionMatrixSelectedLoanProduct,
  setPdTransitionMatrixWorkflowData,
} from "../../../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
import { overlayUploadFile } from "../../../../services/upload";
import { normalizeUploadError } from "../../../../utils/uploadErrorNormalizer";
import type { Workflow } from "../../../../services/workflow";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/* -----------------------------------------------------------
   Document types
----------------------------------------------------------- */
const DOC_MONTHLY = "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV" as const;
const DOC_QUARTERLY = "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV" as const;
const DOC_HISTORICAL = "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE" as const;

type ExecDocType = typeof DOC_MONTHLY | typeof DOC_QUARTERLY | typeof DOC_HISTORICAL;

const mimeFromName = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/vnd.ms-excel";
};

const toNumberSafe = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
const uniqueFiles = (files: File[]) => Array.from(new Map(files.map((f) => [fileKey(f), f])).values());

/* -----------------------------------------------------------
   Existing document interface
----------------------------------------------------------- */
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
  const token = useAppSelector((s) => s.auth.token);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
    currentPdTransitionMatrixWorkflowId: selectedWorkflowId,
    selectedPdTransitionMatrixLoanProduct: loanProduct,
  } = useAppSelector((s) => s.pdTransitionMatrixWfHelper as any);

  const [monthlyFiles, setMonthlyFiles] = useState<ExistingDocFile[]>([]);
  const [quarterlyFiles, setQuarterlyFiles] = useState<ExistingDocFile[]>([]);
  const [historicalFiles, setHistoricalFiles] = useState<ExistingDocFile[]>([]);

  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [failedFiles, setFailedFiles] = useState<Set<string>>(new Set());
  const [failedFilesForRetry, setFailedFilesForRetry] = useState<File[]>([]);
  const [uploadIssues, setUploadIssues] = useState<IssueRow[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [skipFetchExisting, setSkipFetchExisting] = useState(false);
  
  // Store AbortController to cancel in-flight requests when workflow changes
  const abortControllerRef = useRef<AbortController | null>(null);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  const workflowPathBase = `/${entity}/${period}/${workflowName}/input/overlay/development/${loanProduct}`.replace(/^\/+/, "");
  const hasWorkflow = Number.isFinite(selectedWorkflowId);

  const effectiveWorkflowId = selectedWorkflowId;
  const hasSelectedWorkflow = Boolean(effectiveWorkflowId || workflowName);
  /* -----------------------------------------------------------
     Fetch existing documents
  ----------------------------------------------------------- */
  const fetchExistingDocuments = useCallback(async () => {
    if (!selectedWorkflowId || !token) {
      // Clear files when there's no workflow
      setMonthlyFiles([]);
      setQuarterlyFiles([]);
      setHistoricalFiles([]);
      setUploadedFiles(new Set());
      return;
    }
    
    // Skip fetching if we just uploaded a new file (to prevent overwriting the new upload)
    if (skipFetchExisting) {
      return;
    }

    // Cancel any previous in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const url = `${API_BASE}/documents/workflow-documents/?workflow_id=${selectedWorkflowId}&document_types=${[DOC_MONTHLY, DOC_QUARTERLY, DOC_HISTORICAL].join(",")}`;

    try {
      const response = await fetch(url, { 
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        // Clear files on error
        setMonthlyFiles([]);
        setQuarterlyFiles([]);
        setHistoricalFiles([]);
        setUploadedFiles(new Set());
        return;
      }
      
      const result = await response.json();
      if (!result?.success || !Array.isArray(result.data)) {
        // Clear files if response is invalid
        setMonthlyFiles([]);
        setQuarterlyFiles([]);
        setHistoricalFiles([]);
        setUploadedFiles(new Set());
        return;
      }

      const nextMonthly: ExistingDocFile[] = [];
      const nextQuarterly: ExistingDocFile[] = [];
      const nextHistorical: ExistingDocFile[] = [];
      const nextUploadedNames = new Set<string>();

      for (const doc of result.data as any[]) {
        const docType = doc.document_type as ExecDocType | undefined;
        if (!docType) continue;

        const displayName = doc.original_filename || doc.filename;
        const f = new File([], displayName, { type: mimeFromName(displayName) }) as ExistingDocFile;
        f.isExisting = true;
        f.documentId = doc.id;
        f.sizeBytes = toNumberSafe(doc.size_bytes ?? doc.size ?? doc.bytes ?? doc.file_size);
        f.serverFilename = doc.filename;
        f.documentType = docType;
        f.createdAt = doc.created_at;

        nextUploadedNames.add(displayName);

        if (docType === DOC_MONTHLY) nextMonthly.push(f);
        if (docType === DOC_QUARTERLY) nextQuarterly.push(f);
        if (docType === DOC_HISTORICAL) nextHistorical.push(f);
      }

      setMonthlyFiles(nextMonthly.slice(0, 1));
      setQuarterlyFiles(nextQuarterly.slice(0, 1));
      setHistoricalFiles(nextHistorical.slice(0, 1));
      setUploadedFiles(nextUploadedNames);
    } catch (err: any) {
      // Only log if it's not an abort error
      if (err.name !== 'AbortError') {
        console.error("Failed to fetch overlay docs:", err);
      }
    }
  }, [selectedWorkflowId, token, skipFetchExisting]);

  useEffect(() => {
    if (selectedWorkflowId) fetchExistingDocuments();
    
    // Cleanup: cancel in-flight requests when component unmounts or workflow changes
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedWorkflowId, fetchExistingDocuments]);

  /* -----------------------------------------------------------
     Upload function
  ----------------------------------------------------------- */
  const uploadFile = useCallback(
    async (file: File, docType: ExecDocType, override: boolean = false) => {
      if (!hasWorkflow) {
        console.warn("Upload blocked: no workflow selected");
        return;
      }

      const fileName = file.name;
      if (!token) return;

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
          // Prevent fetchExistingDocuments from overwriting the newly uploaded file
          setSkipFetchExisting(true);
          // Reset the skip flag after a delay to allow future fetches
          setTimeout(() => setSkipFetchExisting(false), 2000);
          return;
        }

        setFailedFiles((prev) => new Set(prev).add(fileName));
        setUploadedFiles((prev) => {
          const ns = new Set(prev);
          ns.delete(fileName);
          return ns;
        });
        // Preserve documentType when adding to failedFilesForRetry
        const fileWithDocType = file as ExistingDocFile;
        fileWithDocType.documentType = docType;
        setFailedFilesForRetry((prev) => [...prev, fileWithDocType]);

        const issue: IssueRow = {
          fileName,
          status: result.status || 0,
          ok: result.ok,
          kind: result.data?.validation_status === "failed" ? "conflict" : "error",
          payload: result.data ?? result,
          normalized: normalizeUploadError(result.data ?? result),
        };
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
        // Preserve documentType when adding to failedFilesForRetry
        const fileWithDocType = file as ExistingDocFile;
        fileWithDocType.documentType = docType;
        setFailedFilesForRetry((prev) => [...prev, fileWithDocType]);
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
    [token, uploadedFiles, uploadingFiles, workflowPathBase, effectiveWorkflowId]
  );

  const handleFilesChange = useCallback(
    async (files: File[], docType: ExecDocType, setFiles: (f: File[]) => void) => {
      if (!hasWorkflow) {
        setPickerOpen(true);
        return;
      }

      const single = uniqueFiles(files).slice(-1);
      setFiles(single);

      // Reset skip flag when user selects a new file
      setSkipFetchExisting(false);

      const f = single[0];
      if (!f) return;
      
      // Remove from uploadedFiles, failedFiles, and uploadingFiles to allow re-uploading
      // Use functional updates to ensure we're working with the latest state
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
      
      await uploadFile(f, docType);
    },
    [uploadFile]
  );

  /* -----------------------------------------------------------
     Upload status
  ----------------------------------------------------------- */
  const uploadStatus = useMemo(() => {
    const allFiles = [...monthlyFiles, ...quarterlyFiles, ...historicalFiles];
    const total = allFiles.length;
    const uploaded = allFiles.filter((f) => uploadedFiles.has(f.name)).length;
    const uploading = allFiles.filter((f) => uploadingFiles.has(f.name)).length;
    const failed = allFiles.filter((f) => failedFiles.has(f.name)).length;

    if (total === 0) return { status: "empty" as const, message: "No files uploaded yet." };
    if (uploading > 0) return { status: "uploading" as const, message: `Uploading ${uploading} file(s)...` };
    if (failed > 0) return { status: "error" as const, message: `${failed} file(s) failed.` };
    if (uploaded === total) return { status: "success" as const, message: "All files uploaded successfully!" };
    return { status: "partial" as const, message: `${uploaded}/${total} files uploaded.` };
  }, [monthlyFiles, quarterlyFiles, historicalFiles, uploadedFiles, uploadingFiles, failedFiles]);

  /* -----------------------------------------------------------
     Step 1 progress
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!Number.isFinite(selectedWorkflowId)) return;
    dispatch(setModuleProgress({ moduleKey: "overlayDevelopment", contextKey: String(selectedWorkflowId), data: { step1Valid: uploadStatus.status === "success" } }));
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
  const handleReset = () => {
    setMonthlyFiles([])
    setQuarterlyFiles([])
    setHistoricalFiles([])
    setUploadingFiles(new Set());
    setUploadedFiles(new Set());
    setFailedFiles(new Set());
    setFailedFilesForRetry([]);
    setSuccessBanner(null);
    setPickerOpen(false)
    setUploadModalOpen(false)
  };

  /* -----------------------------------------------------------
     UI
  ----------------------------------------------------------- */
  return (
    <div className="mx-auto max-w-8xl">
      <div className="mb-4">
        <OdInputsAbout />
      </div>
      {successBanner && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex items-center justify-between">
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)} className="ml-2 text-emerald-600 hover:text-emerald-800" title="Dismiss" type="button">×</button>
          </div>
        </div>
      )}

      <OverlayUploadResultModal
        open={uploadModalOpen}
        issues={uploadIssues}
        isSubmitting={false}
        onClose={() => handleReset()}
        onProceed={async () => {
          for (const f of failedFilesForRetry) {
            const docType = (f as ExistingDocFile).documentType ?? DOC_MONTHLY;
            await uploadFile(f, docType, true); // Pass override: true when retrying
          }
          setUploadModalOpen(false);
        }}
      />

      <div className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">Inputs</h3>
            <p className="mt-1 text-xs text-gray-600">Workflow: {workflowName || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              disabled={uploadingFiles.size > 0}
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Switch Workflow
            </button>
            {!hasSelectedWorkflow && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-400">
                Please select a workflow to upload
              </span>
            )}
            {uploadStatus.status === "success" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" /> All Uploaded
              </span>
            )}
            {uploadStatus.status === "uploading" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /> Uploading...
              </span>
            )}
            {uploadStatus.status === "error" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <ExclamationTriangleIcon className="h-4 w-4" /> Upload Failed
              </span>
            )}
            {uploadStatus.status === "partial" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                <ExclamationTriangleIcon className="h-4 w-4" /> Partial Upload
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-2">
          {/* Monthly */}
          <UploadDropzone
            label="Monthly MEV"
            description="CSV or Excel"
            required
            accept={accept}
            maxSizeMB={maxSizeMB}
            maxFiles={1}
            multiple={false}
            value={monthlyFiles}
            onChange={(f) => handleFilesChange(f, DOC_MONTHLY, setMonthlyFiles)}
          />
          {/* Quarterly */}
          <UploadDropzone
            label="Quarterly MEV"
            description="CSV or Excel"
            required
            accept={accept}
            maxSizeMB={maxSizeMB}
            maxFiles={1}
            multiple={false}
            value={quarterlyFiles}
            onChange={(f) => handleFilesChange(f, DOC_QUARTERLY, setQuarterlyFiles)}
          />
          {/* Historical */}
          <UploadDropzone
            label="Historical Default Rate"
            description="CSV or Excel"
            required
            accept={accept}
            maxSizeMB={maxSizeMB}
            maxFiles={1}
            multiple={false}
            value={historicalFiles}
            onChange={(f) => handleFilesChange(f, DOC_HISTORICAL, setHistoricalFiles)}
          />
        </div>
      </div>

      <WorkflowPickerModal
        open={pickerOpen}
        token={token}
        onClose={() => handleReset()}
        onSelect={handlePickWorkflow}
      />
    </div>
  );
}
