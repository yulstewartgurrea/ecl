// src/pages/.../Step1.tsx
import { useMemo, useState, useCallback, useEffect } from "react";
import UploadDropzone from "../../../../components/ui/UploadDropzone";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { useLocation } from "react-router-dom";

import {
  inferOverlayDocumentType,
  overlayUploadFile,
} from "../../../../services/upload";

import { useAppDispatch, useAppSelector } from "../../../../redux_toolkit/hooks";
import OverlayUploadResultModal, { type IssueRow } from "../../../../components/modals/OverlayUploadResultModal";
import WorkflowPickerModal from "../../../../components/modals/WorkflowPickerModal";

// ✅ make sure these actions/selectors exist in your slice
import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWorkflowId, // <— ensure this action exists
} from "../../../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

// (optional) if you exported the TS type from services
import type { Workflow } from "../../../../services/workflow";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function Step1() {
  const dispatch = useAppDispatch();
  const location = useLocation();

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
    // ⬇️ make sure your slice stores this
    currentPdTransitionMatrixWorkflowId: selectedWorkflowId,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper as any);
  console.log('selectedWorkflowId: ', selectedWorkflowId)
  const token = useAppSelector((state) => state.auth.token);

  // Determine submodule based on URL tab parameter
  const getSubmodule = useCallback(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    return tab === "execution" ? "EXECUTION" : "DEVELOPMENT";
  }, [location.search]);

  const [monthlyFiles, setMonthlyFiles] = useState<File[]>([]);
  const [quarterlyFiles, setQuarterlyFiles] = useState<File[]>([]);
  const [historicalFiles, setHistoricalFiles] = useState<File[]>([]);
  
  // Individual file upload states
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

  // Function to fetch existing documents and populate dropzones
  const fetchExistingDocuments = useCallback(async () => {
    if (!selectedWorkflowId || !token) return;

    try {
      const documentTypes = [
        "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV",
        "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV", 
        "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE"
      ].join(",");

      const response = await fetch(
        `${API_BASE}/documents/workflow-documents/?workflow_id=${selectedWorkflowId}&document_types=${documentTypes}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Create File objects from the existing documents
          const existingFiles: File[] = [];
          
          result.data.forEach((doc: any) => {
            // Create a File object with the filename
            const file = new File([], doc.filename, {
              type: doc.filename.endsWith('.csv') ? 'text/csv' : 
                    doc.filename.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                    'application/vnd.ms-excel'
            });
            
            // Add metadata to track it's an existing file
            (file as any).isExisting = true;
            (file as any).documentId = doc.id;
            
            existingFiles.push(file);
          });

          // Group files by document type and populate appropriate arrays
          const monthlyFiles: File[] = [];
          const quarterlyFiles: File[] = [];
          const historicalFiles: File[] = [];

          existingFiles.forEach(file => {
            const doc = result.data.find((d: any) => d.filename === file.name);
            if (doc) {
              switch (doc.document_type) {
                case "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV":
                  monthlyFiles.push(file);
                  setUploadedFiles(prev => new Set(prev).add(file.name));
                  break;
                case "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV":
                  quarterlyFiles.push(file);
                  setUploadedFiles(prev => new Set(prev).add(file.name));
                  break;
                case "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE":
                  historicalFiles.push(file);
                  setUploadedFiles(prev => new Set(prev).add(file.name));
                  break;
              }
            }
          });

          // Set the files in their respective arrays
          setMonthlyFiles(monthlyFiles);
          setQuarterlyFiles(quarterlyFiles);
          setHistoricalFiles(historicalFiles);
        }
      }
    } catch (error) {
      console.error("Failed to fetch existing documents:", error);
    }
  }, [selectedWorkflowId, token]);

  // Fetch existing documents when workflow changes
  useEffect(() => {
    if (selectedWorkflowId) {
      fetchExistingDocuments();
    }
  }, [selectedWorkflowId, fetchExistingDocuments]);

  // Build the workflow path → <entity>/<period>/<wfName>/input/overlay/<submodule>
  const baseDir = `/${entity}/${period}/${workflowName}`.replace(/^\/+/, "");
  const submodule = getSubmodule().toLowerCase();
  const workflowPath = `${baseDir}/input/overlay/${submodule}`;

  // 👉 use the selected workflow id; if missing, you can fallback (but better to enforce selection)
  const effectiveWorkflowId = selectedWorkflowId ?? 1;

  // Individual file upload handler
  const uploadIndividualFile = useCallback(async (file: File) => {
    const fileName = file.name;
    
    // Check if already uploaded or uploading
    if (uploadedFiles.has(fileName) || uploadingFiles.has(fileName)) {
      return;
    }

    // Add to uploading set
    setUploadingFiles(prev => new Set(prev).add(fileName));
    
    try {
      const docType = inferOverlayDocumentType(fileName);
        if (!docType) {
        throw new Error("Filename not recognized. Expected: monthly_historical_mev, quarterly_historical_mev, or historical_default_mev.");
      }

      const result = await overlayUploadFile({
          baseUrl: API_BASE,
          token,
        file,
          workflowPath,
          documentType: docType,
        workflowId: effectiveWorkflowId,
          override: false,
        moduleVal: "OVERLAY",
        submoduleVal: getSubmodule()
      });

      // Store the result and show API response
      
      if (result.ok) {
        setUploadedFiles(prev => new Set(prev).add(fileName));
        setFailedFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(fileName);
          return newSet;
        });
        
        // Add successful file to appropriate array
        const docType = inferOverlayDocumentType(fileName);
        if (docType === "monthly_historical_mev") {
          setMonthlyFiles(prev => [...prev, file]);
        } else if (docType === "quarterly_historical_mev") {
          setQuarterlyFiles(prev => [...prev, file]);
        } else if (docType === "historical_default_mev") {
          setHistoricalFiles(prev => [...prev, file]);
        }
        
        setSuccessBanner(`${fileName} uploaded successfully!`);
        setUploadModalOpen(false);
      } else {
        setFailedFiles(prev => new Set(prev).add(fileName));
        setUploadedFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(fileName);
          return newSet;
        });
        
        // Remove failed file from appropriate array
        const docType = inferOverlayDocumentType(fileName);
        if (docType === "monthly_historical_mev") {
          setMonthlyFiles(prev => prev.filter(f => f.name !== fileName));
        } else if (docType === "quarterly_historical_mev") {
          setQuarterlyFiles(prev => prev.filter(f => f.name !== fileName));
        } else if (docType === "historical_default_mev") {
          setHistoricalFiles(prev => prev.filter(f => f.name !== fileName));
        }
        
        // Store failed file for retry
        setFailedFilesForRetry(prev => [...prev, file]);
        
        // Create issue row for the existing modal
        // Determine if this is a validation failure (can retry) or code error (cannot retry)
        const validationStatus = result.data?.validation_status;
        const issueKind = validationStatus === "failed" ? "conflict" : "error";
        
        const issue: IssueRow = {
          fileName: fileName,
          status: result.status || 0,
          ok: result.ok,
          kind: issueKind,
          payload: {
            error: result.error,
            data: result.data,
            fullResponse: result,
            validationStatus: validationStatus
          }
        };
        
        setUploadIssues([issue]);
        setUploadModalOpen(true);
        setSuccessBanner(null);
      }
    } catch (error: any) {
      console.error(`Upload failed for ${fileName}:`, error);
      setFailedFiles(prev => new Set(prev).add(fileName));
      
      // Remove failed file from appropriate array
      const docType = inferOverlayDocumentType(fileName);
      if (docType === "monthly_historical_mev") {
        setMonthlyFiles(prev => prev.filter(f => f.name !== fileName));
      } else if (docType === "quarterly_historical_mev") {
        setQuarterlyFiles(prev => prev.filter(f => f.name !== fileName));
      } else if (docType === "historical_default_mev") {
        setHistoricalFiles(prev => prev.filter(f => f.name !== fileName));
      }
      
      // Store failed file for retry
      setFailedFilesForRetry(prev => [...prev, file]);
      
      // Show error modal for caught errors
      const issue: IssueRow = {
        fileName: fileName,
        status: 0,
        ok: false,
        kind: "error", // Caught errors are always code errors
        payload: {
          error: error.message || "Upload failed",
          caughtError: error,
          stack: error.stack,
          validationStatus: "error" // Mark as code error
        }
      };
      
      setUploadIssues([issue]);
      setUploadModalOpen(true);
      setSuccessBanner(null);
    } finally {
      // Remove from uploading set
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
    }
  }, [token, workflowPath, effectiveWorkflowId, getSubmodule, uploadedFiles, uploadingFiles]);

  // File change handlers that trigger individual uploads
  const handleMonthlyFilesChange = useCallback(async (files: File[]) => {
    // Set all files first, then upload new ones
    setMonthlyFiles(files);
    
    // Upload new files individually (skip existing files)
    for (const file of files) {
      if (!uploadedFiles.has(file.name) && !uploadingFiles.has(file.name) && !(file as any).isExisting) {
        await uploadIndividualFile(file);
      }
    }
  }, [uploadIndividualFile, uploadedFiles, uploadingFiles]);

  const handleQuarterlyFilesChange = useCallback(async (files: File[]) => {
    // Set all files first, then upload new ones
    setQuarterlyFiles(files);
    
    // Upload new files individually (skip existing files)
    for (const file of files) {
      if (!uploadedFiles.has(file.name) && !uploadingFiles.has(file.name) && !(file as any).isExisting) {
        await uploadIndividualFile(file);
      }
    }
  }, [uploadIndividualFile, uploadedFiles, uploadingFiles]);

  const handleHistoricalFilesChange = useCallback(async (files: File[]) => {
    // Set all files first, then upload new ones
    setHistoricalFiles(files);
    
    // Upload new files individually (skip existing files)
    for (const file of files) {
      if (!uploadedFiles.has(file.name) && !uploadingFiles.has(file.name) && !(file as any).isExisting) {
        await uploadIndividualFile(file);
      }
    }
  }, [uploadIndividualFile, uploadedFiles, uploadingFiles]);


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

  // Clear all files when workflow changes
  useEffect(() => {
    clearAll();
  }, [selectedWorkflowId, clearAll]);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (monthlyFiles.length) parts.push(`${monthlyFiles.length} monthly`);
    if (quarterlyFiles.length) parts.push(`${quarterlyFiles.length} quarterly`);
    if (historicalFiles.length) parts.push(`${historicalFiles.length} historical`);
    return parts.join(" • ");
  }, [monthlyFiles.length, quarterlyFiles.length, historicalFiles.length]);

  // Upload status summary
  const uploadStatus = useMemo(() => {
    const totalFiles = monthlyFiles.length + quarterlyFiles.length + historicalFiles.length;
    const uploadedCount = uploadedFiles.size;
    const uploadingCount = uploadingFiles.size;
    const failedCount = failedFiles.size;
    
    if (totalFiles === 0) return { status: "empty", message: "No files uploaded yet." };
    if (uploadingCount > 0) return { status: "uploading", message: `Uploading ${uploadingCount} file(s)...` };
    if (failedCount > 0) return { status: "error", message: `${failedCount} file(s) failed to upload.` };
    if (uploadedCount === totalFiles) return { status: "success", message: `All ${uploadedCount} file(s) uploaded successfully!` };
    return { status: "partial", message: `${uploadedCount}/${totalFiles} files uploaded.` };
  }, [monthlyFiles.length, quarterlyFiles.length, historicalFiles.length, uploadedFiles.size, uploadingFiles.size, failedFiles.size]);

  // When a workflow is picked (modal already filters status === "done")
  const handlePickWorkflow = useCallback(
    (w: Workflow) => {
      const nextEntity =
        (w as any).entity ?? "";
      const nextPeriod =
        (w as any).reporting_period ?? (w as any).reportingPeriod ?? "";
      const nextName =
        (w as any).workflow_name ?? (w as any).name ?? "";
      const nextId =
        typeof (w as any).id === "number" ? (w as any).id : null;

      // Console log when workflow is selected
      console.log(`🎯 WORKFLOW SELECTED: ID=${nextId}, Name='${nextName}', Entity='${nextEntity}', Period='${nextPeriod}'`);

      if (nextEntity) {
        dispatch(setPdTransitionMatrixSelectedEntity({ entity: nextEntity }));
      }
      if (nextPeriod) {
        dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: nextPeriod }));
      }
      if (nextName) {
        dispatch(setPdTransitionMatrixWfName({ workflow_name: nextName }));
      }
      // ✅ expects { workflow_id: number | null }
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

      {/* Upload Results Modal */}
      <OverlayUploadResultModal
        open={uploadModalOpen}
        title="Upload Error"
        issues={uploadIssues}
        isSubmitting={false}
        onClose={() => setUploadModalOpen(false)}
        onProceed={async () => {
          // Retry failed uploads with override
          const failedFileNames = Array.from(failedFiles);
          const filesToRetry = failedFilesForRetry.filter(f => failedFileNames.includes(f.name));
          
          for (const file of filesToRetry) {
            const docType = inferOverlayDocumentType(file.name);
            if (docType) {
              try {
                const result = await overlayUploadFile({
                  baseUrl: API_BASE,
                  token,
                  file,
                  workflowPath,
                  documentType: docType,
                  workflowId: effectiveWorkflowId,
                  override: true, // Use override for validation failures
                  moduleVal: "OVERLAY",
                  submoduleVal: getSubmodule()
                });
                
                // If retry succeeds, add file back to appropriate array and update states
                if (result.ok) {
                  const fileName = file.name;
                  
                  // Add to uploaded files set
                  setUploadedFiles(prev => new Set(prev).add(fileName));
                  
                  // Remove from failed files set
                  setFailedFiles(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(fileName);
                    return newSet;
                  });
                  
                  // Add file back to appropriate array
                  if (docType === "monthly_historical_mev") {
                    setMonthlyFiles(prev => [...prev, file]);
                  } else if (docType === "quarterly_historical_mev") {
                    setQuarterlyFiles(prev => [...prev, file]);
                  } else if (docType === "historical_default_mev") {
                    setHistoricalFiles(prev => [...prev, file]);
                  }
                  
                  // Remove from failed files for retry
                  setFailedFilesForRetry(prev => prev.filter(f => f.name !== fileName));
                  
                  // Show success message
                  setSuccessBanner(`${fileName} uploaded successfully with override!`);
                }
              } catch (error) {
                console.error(`Retry failed for ${file.name}:`, error);
              }
            }
          }
          
          setUploadModalOpen(false);
        }}
        proceedDisabledReason={
          uploadIssues.length === 0 
            ? "No issues to retry" 
            : uploadIssues.some(issue => issue.payload?.data?.validation_status === "error")
              ? "Code error detected - cannot retry"
              : undefined
        }
      />

      <div className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">Input Files</h3>
            <p className="text-xs text-gray-500">
              Upload your datasets. Accepted types: <span className="font-medium">{accept}</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Target path: <span className="font-mono">{workflowPath}</span>
            </p>
            {/* Show which id is active (handy while testing) */}
            <p className="text-[11px] text-gray-400 mt-1">
              Workflow ID: <span className="font-mono">{selectedWorkflowId ?? "—"}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch Workflow */}
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50  cursor-pointer"
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
                label="Monthly Historical MEVs"
            description="CSV or Excel. Name like: monthly_historical_mev.*"
            required
            accept={accept}
            maxSizeMB={maxSizeMB}
            maxFiles={3}
            value={monthlyFiles}
                onChange={handleMonthlyFilesChange}
            emptyHint="Waiting for monthly file(s)…"
            variant="card"
          />
              {/* Success indicator beside the label */}
              {monthlyFiles.length > 0 && monthlyFiles.every(file => uploadedFiles.has(file.name)) && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircleIcon className="h-3 w-3" />
                    Uploaded
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="relative">
          <UploadDropzone
            label="Quarterly Historical MEVs"
            description="CSV or Excel. Name like: quarterly_historical_mev.*"
            required
            accept={accept}
            maxSizeMB={maxSizeMB}
            maxFiles={3}
            value={quarterlyFiles}
                onChange={handleQuarterlyFilesChange}
            emptyHint="Waiting for quarterly file(s)…"
            variant="card"
          />
              {/* Success indicator beside the label */}
              {quarterlyFiles.length > 0 && quarterlyFiles.every(file => uploadedFiles.has(file.name)) && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                    <CheckCircleIcon className="h-3 w-3" />
                    Uploaded
                  </span>
                </div>
              )}
            </div>
            {/* Upload status for quarterly files - only show successful uploads */}
          </div>
          
          <div className="space-y-2">
            <div className="relative">
          <UploadDropzone
            label="Historical Default Rate"
            description="CSV or Excel. Name like: historical_default_mev.* or historical_default_rate.*"
            required
            accept={accept}
            maxSizeMB={maxSizeMB}
            maxFiles={3}
            value={historicalFiles}
                onChange={handleHistoricalFilesChange}
            emptyHint="Waiting for historical file(s)…"
            variant="card"
          />
              {/* Success indicator beside the label */}
              {historicalFiles.length > 0 && historicalFiles.every(file => uploadedFiles.has(file.name)) && (
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
            <div className="mb-1">
              {uploadStatus.message}
            </div>
            {monthlyFiles.length > 0 || quarterlyFiles.length > 0 || historicalFiles.length > 0 && (
              <div className="text-gray-500">
                Files: {summary}
          </div>
            )}
          </div>
        </div>
      </div>


      {/* Workflow picker modal (shows only status=done) */}
      <WorkflowPickerModal
        open={pickerOpen}
        token={token}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickWorkflow}
      />
    </div>
  );
}