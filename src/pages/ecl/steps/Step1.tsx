// src/pages/execution/Step1.tsx
import { useMemo, useState, useCallback, useEffect } from "react";
import UploadDropzone from "../../../components/ui/UploadDropzone";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";

import { overlayUploadFile } from "../../../services/upload";

import { useAppDispatch, useAppSelector } from "../../../redux_toolkit/hooks";
import OverlayUploadResultModal, {
  type IssueRow,
} from "../../../components/modals/OverlayUploadResultModal";
import WorkflowPickerModal from "../../../components/modals/WorkflowPickerModal";

import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWorkflowId,
  setPdTransitionMatrixSelectedLoanProduct,
} from "../../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

import type { Workflow } from "../../../services/workflow";

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
   Execution document types (must match backend / Postman)
----------------------------------------------------------- */
const ECL_CLIENT_LOAN_BALANCES = "ECL_CLIENT_LOAN_BALANCES" as const;

type ExecDocType = typeof ECL_CLIENT_LOAN_BALANCES;

/** normalize filename (remove ext, normalize separators/spaces) */
function normalizeFileBase(name: string) {
  const noExt = name.replace(/\.[a-z0-9]+$/i, "");
  return noExt
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lenient inference:
 *  Accept if filename contains:
 *  - "ecl"
 *  - "client loan balance(s)"
 *  - has BOTH "loan" and "balance"
 *
 * If nothing matched  still return ECL_CLIENT_LOAN_BALANCES (NO BLOCKING ERROR)
 */
function inferExecDocTypeFromName(name: string): ExecDocType {
  const base = normalizeFileBase(name);

  const hasEcl = base.includes("ecl");
  const hasClientLoanBalance =
    base.includes("client loan balance") || base.includes("client loan balances");
  const hasLoanAndBalance = base.includes("loan") && base.includes("balance");

  if (hasEcl || hasClientLoanBalance || hasLoanAndBalance) {
    return ECL_CLIENT_LOAN_BALANCES;
  }

  //  default to ECL (no filename blocking)
  return ECL_CLIENT_LOAN_BALANCES;
}

/** Compose the final storage path for this file:
 *  <entity>/<period>/<workflow>/input/ecl/<loanproduct>/<DOCTYPE>
 */
function composeWorkflowPathWithDocType(
  basePath: string,
  docType: ExecDocType
): string {
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
    selectedPdTransitionMatrixLoanProduct: loanproduct,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper as any);
  const token = useAppSelector((state) => state.auth.token);

  // Execution input
  const [eclFiles, setECLFiles] = useState<File[]>([]);

  // Upload state
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [failedFiles, setFailedFiles] = useState<Set<string>>(new Set());

  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [uploadIssues, setUploadIssues] = useState<IssueRow[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [failedFilesForRetry, setFailedFilesForRetry] = useState<File[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);

  //  NEW: modal retry loading state (for Proceed anyway / Force upload)
  const [retrySubmitting, setRetrySubmitting] = useState(false);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  const baseDir = `/${entity}/${period}/${workflowName}`.replace(/^\/+/, "");
  const workflowPathBase = `${baseDir}/input/ecl/${loanproduct}`;

  const effectiveWorkflowId = selectedWorkflowId ?? 1;

  //  helper: add/remove many filenames in uploading set (reuses same loader UI)
  const markUploadingBatch = useCallback((names: string[], on: boolean) => {
    setUploadingFiles((prev) => {
      const ns = new Set(prev);
      for (const n of names) {
        if (on) ns.add(n);
        else ns.delete(n);
      }
      return ns;
    });
  }, []);

  const fetchExistingDocuments = useCallback(async () => {
    if (!selectedWorkflowId || !token) return;

    const documentTypes = [ECL_CLIENT_LOAN_BALANCES].join(",");

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

          const displayName = doc.original_filename || doc.filename;
          const f = new File([], displayName, { type: mime }) as File & {
            isExisting?: boolean;
            documentId?: number | string;
            sizeBytes?: number;
            serverFilename?: string;
          };
          (f as any).isExisting = true;
          (f as any).documentId = doc.id;
          (f as any).sizeBytes = toNumberSafe(
            doc.size_bytes ?? doc.size ?? doc.bytes ?? doc.file_size
          );
          (f as any).serverFilename = doc.filename;
          return f;
        });

        const nextEcl: File[] = [];
        for (const f of existing) {
          const doc = result.data.find((d: any) => d.filename === f.name);
          if (!doc) continue;

          if (doc.document_type === ECL_CLIENT_LOAN_BALANCES) {
            nextEcl.push(f);
            setUploadedFiles((prev) => new Set(prev).add(f.name));
          }
        }

        setECLFiles(nextEcl.slice(0, 1));
      }
    } catch (err) {
      console.error("Failed to fetch execution docs:", err);
    }
  }, [selectedWorkflowId, token]);

  const clearAll = useCallback(() => {
    setECLFiles([]);
    setUploadingFiles(new Set());
    setUploadedFiles(new Set());
    setFailedFiles(new Set());
    setSuccessBanner(null);
    setUploadIssues([]);
    setUploadModalOpen(false);
    setFailedFilesForRetry([]);
    setRetrySubmitting(false);
  }, []);

  useEffect(() => {
    clearAll();
  }, [selectedWorkflowId, clearAll]);

  useEffect(() => {
    if (selectedWorkflowId) fetchExistingDocuments();
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
          moduleVal: "ECL",
          submoduleVal: "DEVELOPMENT",
        });

        if (result.ok) {
          setUploadedFiles((prev) => new Set(prev).add(fileName));
          setFailedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });

          setECLFiles((prev) => {
            if (prev.some((x) => x.name === fileName)) return prev;
            return [...prev, file];
          });

          setSuccessBanner(`${fileName} uploaded successfully!`);
          setUploadModalOpen(false);
        } else {
          setFailedFiles((prev) => new Set(prev).add(fileName));
          setUploadedFiles((prev) => {
            const ns = new Set(prev);
            ns.delete(fileName);
            return ns;
          });

          setECLFiles((prev) => prev.filter((f) => f.name !== fileName));
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
        setECLFiles((prev) => prev.filter((f) => f.name !== fileName));
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
    [API_BASE, token, workflowPathBase, effectiveWorkflowId, uploadedFiles, uploadingFiles]
  );

  // Dropzone handler
  const handleEclFilesChange = useCallback(
    async (files: File[]) => {
      const single = files.slice(-1);
      setECLFiles(single);

      for (const f of single) {
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

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (eclFiles.length) parts.push(`${eclFiles.length} ecl`);
    return parts.join("  ");
  }, [eclFiles.length]);

  const uploadStatus = useMemo(() => {
    const totalFiles = eclFiles.length;
    const uploadedCount = uploadedFiles.size;
    const uploadingCount = uploadingFiles.size;
    const failedCount = failedFiles.size;

    if (totalFiles === 0) return { status: "empty", message: "No files uploaded yet." };
    if (uploadingCount > 0) return { status: "uploading", message: `Uploading ${uploadingCount} file(s)...` };
    if (failedCount > 0) return { status: "error", message: `${failedCount} file(s) failed to upload.` };
    if (uploadedCount === totalFiles) return { status: "success", message: `All ${uploadedCount} file(s) uploaded successfully!` };
    return { status: "partial", message: `${uploadedCount}/${totalFiles} files uploaded.` };
  }, [eclFiles.length, uploadedFiles.size, uploadingFiles.size, failedFiles.size]);

  const handlePickWorkflow = useCallback(
    (w: Workflow) => {
      const nextEntity = (w as any).entity ?? "";
      const nextPeriod =
        (w as any).reporting_period ?? (w as any).reportingPeriod ?? "";
      const nextName = (w as any).workflow_name ?? (w as any).name ?? "";
      const nextId = typeof (w as any).id === "number" ? (w as any).id : null;
      const nextLoanProduct = (w as any).loan_product ?? "";

      if (nextEntity) dispatch(setPdTransitionMatrixSelectedEntity({ entity: nextEntity }));
      if (nextPeriod) dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: nextPeriod }));
      if (nextName) dispatch(setPdTransitionMatrixWfName({ workflow_name: nextName }));
      dispatch(setPdTransitionMatrixSelectedLoanProduct({ loan_product: nextLoanProduct }));
      dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: nextId }));

      setPickerOpen(false);
    },
    [dispatch]
  );

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
              •
            </button>
          </div>
        </div>
      )}

      <OverlayUploadResultModal
        open={uploadModalOpen}
        issues={uploadIssues}
        //  show loader on modal button too
        isSubmitting={retrySubmitting}
        onClose={() => {
          if (retrySubmitting) return; // prevent closing while retrying
          setUploadModalOpen(false);
        }}
        onProceed={async () => {
          const failedNames = Array.from(failedFiles);
          const retryFiles = failedFilesForRetry.filter((f) =>
            failedNames.includes(f.name)
          );
          if (retryFiles.length === 0 || retrySubmitting) return;

          const batchNames = retryFiles.map((f) => f.name);

          setRetrySubmitting(true);
          markUploadingBatch(batchNames, true); //  trigger same top loader

          try {
            for (const file of retryFiles) {
              const docType = inferExecDocTypeFromName(file.name);

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
                override: true, //  force upload / proceed anyway
                moduleVal: "ECL",
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

                setECLFiles((prev) => {
                  if (prev.some((x) => x.name === fileName)) return prev;
                  return [...prev, file];
                });

                setFailedFilesForRetry((prev) =>
                  prev.filter((f) => f.name !== fileName)
                );

                setSuccessBanner(`${fileName} uploaded successfully with override!`);
              } else {
                // keep it as failed (don™t remove from failed set)
                setFailedFiles((prev) => new Set(prev).add(file.name));
              }
            }

            // close modal after the batch finishes
            setUploadModalOpen(false);
          } catch (err) {
            console.error("Retry batch failed:", err);
          } finally {
            markUploadingBatch(batchNames, false);
            setRetrySubmitting(false);
          }
        }}
        proceedDisabledReason={
          uploadIssues.length === 0
            ? "No issues to retry"
            : retrySubmitting
            ? "Retrying..."
            : uploadIssues.some((i) => i.payload?.data?.validation_status === "error")
            ? "Code error detected - cannot retry"
            : undefined
        }
      />

      <div className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 ">
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
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer"
              disabled={uploadingFiles.size > 0 || retrySubmitting}
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
                value={eclFiles}
                onChange={handleEclFilesChange}
                emptyHint="Waiting for ECL file"
                variant="card"
                // optional: block interaction while retrying
                disabled={retrySubmitting}
              />

              {eclFiles.length > 0 && eclFiles.every((f) => uploadedFiles.has(f.name)) && (
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
            {eclFiles.length > 0 && (
              <div className="text-gray-500">Files: {summary}</div>
            )}
          </div>
        </div>
      </div>

      <WorkflowPickerModal
        open={pickerOpen}
        token={token}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickWorkflow}
      />
    </div>
  );
}

