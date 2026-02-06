// src/pages/overlay/development/.../Step4.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Multi_Table, type Row } from "../../../../components/overlay/development/multi_factor/Multi_Table";
import { 
  // getMultiFactorResults, 
  postMultiFactorTrigger,
  getMultiFactorStatus,
  cancelMultiFactorAnalysis,
  getMultiFactorFiles,
  getMultiFactorFile,
  type MultiFactorStatus,
  type MultiFactorFilesData,
} from "../../../../services/multi_factor";
import { useAppSelector } from "../../../../redux_toolkit/hooks";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { selectModuleProgress } from "../../../../redux_toolkit/features/progress/moduleProgressSlice";
import {
  ArrowPathIcon,
  PlayCircleIcon,
  ArrowDownTrayIcon,   //  NEW
  ChevronLeftIcon,     //  NEW (for Prev)
  XCircleIcon,
  FolderIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// NEW: headers storage helper
import { saveHeaders, saveStep3Config } from "../../../../utils/overlay/headersStorage";
import ConfirmCancelModal from "../../../../components/modals/ConfirmCancelModal";


const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type Step4Props = {
  title?: string;
  description?: string;
};

const EXCLUDE_KEYS = new Set(["id", "index", "__rowid__", "_rowIndex"]);

function deriveHeaders(rows: Row[]): string[] {
  const set = new Set<string>();
  for (const r of rows || []) {
    Object.keys(r || {}).forEach((k) => {
      if (!EXCLUDE_KEYS.has(k)) set.add(k);
    });
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// CSV helpers (used if server returns JSON)
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(headers: string[], rows: Row[]): string {
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(",")).join("\n");
  // Add BOM so Excel opens UTF-8 cleanly
  return "\uFEFF" + head + "\n" + body;
}

const Step4: React.FC<Step4Props> = ({
  title = "Multi Factor Analysis",
  description = "",
}) => {
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);
  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Status states
  const [status, setStatus] = useState<MultiFactorStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // server supports page_size

  const [serverRows, setServerRows] = useState<Row[]>([]);
  const [filteredRows, setFilteredRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [pages, setPages] = useState<number | undefined>(undefined);
  
  // File-based data (when files are selected)
  const [fileBasedRows, setFileBasedRows] = useState<Row[]>([]);
  const [fileRowMap, setFileRowMap] = useState<Map<string, Row[]>>(new Map()); // Track rows per file
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const MAX_FILE_ROWS = 100000; // 100k row limit

  const [hasTriggered, setHasTriggered] = useState(false);

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);


  // EXPORT state
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  // Files dropdown state
  const [showFilesDropdown, setShowFilesDropdown] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesData, setFilesData] = useState<MultiFactorFilesData | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Configuration states
  const [showConfig, setShowConfig] = useState(false);
  const contextKey =
    Number.isFinite(Number(selectedWorkflowId)) && Number(selectedWorkflowId) > 0
      ? String(selectedWorkflowId)
      : undefined;
  const overlayProgress = useAppSelector((state: RootState) =>
    selectModuleProgress(state, "overlayDevelopment", contextKey)
  );
  const storedConfig = (overlayProgress?.data as any)?.step3Config as
    | { numOfVars?: number }
    | undefined;
  const numVarsFromConfig = storedConfig?.numOfVars ?? 2;

  const [num_vars_taken, setNum_vars_taken] = useState<number>(numVarsFromConfig);

  const totalPages = useMemo(() => {
    // If files are selected, calculate pages from file-based rows
    if (selectedFiles.size > 0 && fileBasedRows.length > 0) {
      return Math.max(1, Math.ceil(fileBasedRows.length / pageSize));
    }
    
    // Otherwise use server pagination
    if (pages && pages > 0) return pages;
    if (total && pageSize) return Math.max(1, Math.ceil(total / pageSize));
    if (!pages && !total && serverRows?.length) {
      return Math.max(1, Math.ceil(serverRows.length / pageSize));
    }
    return undefined;
  }, [pages, total, pageSize, serverRows, selectedFiles, fileBasedRows]);

  const canPrev = page > 1;

  useEffect(() => {
    if (numVarsFromConfig !== num_vars_taken) {
      setNum_vars_taken(numVarsFromConfig);
    }
  }, [numVarsFromConfig, num_vars_taken]);

  useEffect(() => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) return;
    if (!Number.isFinite(num_vars_taken) || num_vars_taken <= 0) return;
    saveStep3Config(wf, { numOfVars: num_vars_taken });
  }, [selectedWorkflowId, num_vars_taken]);
  const displayRows = useMemo(() => {
    // If files are selected, use file-based rows
    if (selectedFiles.size > 0 && fileBasedRows.length > 0) {
      // Apply pagination to file-based rows
      const start = (page - 1) * pageSize;
      return fileBasedRows.slice(start, start + pageSize);
    }
    
    // Otherwise use server pagination
    const usingServerPaging = Boolean(pages || total);
    if (usingServerPaging) return serverRows;
    const start = (page - 1) * pageSize;
    return serverRows.slice(start, start + pageSize);
  }, [serverRows, page, pageSize, pages, total, selectedFiles, fileBasedRows]);

  // Refresh with status check
  const onRefresh = async () => {
    if (!Number.isFinite(selectedWorkflowId)) {
      setErrMsg("Please select a workflow on Step 1 before refreshing.");
      return;
    }

    setStatusLoading(true);
    setLoading(true);
    setErrMsg(null);
    try {
      // First, check the job status
      const statusResponse = await getMultiFactorStatus({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
      });

      if (statusResponse?.success && statusResponse?.data) {
        setStatus(statusResponse.data);
        
        // If job is still processing, show status but clear table data
        if (statusResponse.data.status === "processing" || statusResponse.data.status === "pending") {
          setErrMsg(
            `Job is ${statusResponse.data.status}. Progress: ${statusResponse.data.progress}% - ${statusResponse.data.message || "Processing..."}`
          );
          // Clear table data when job is not completed
          setServerRows([]);
          setTotal(undefined);
          setPages(undefined);
          setLoading(false);
          setStatusLoading(false);
          return;
        }

        // If job failed, show error and clear table data
        if (statusResponse.data.status === "failed") {
          setErrMsg(
            `Job failed: ${statusResponse.data.error_message || statusResponse.data.message || "Unknown error"}`
          );
          // Clear table data when job is not completed
          setServerRows([]);
          setTotal(undefined);
          setPages(undefined);
          setLoading(false);
          setStatusLoading(false);
          return;
        }

        // If job is cancelled, show message and clear table data
        if (statusResponse.data.status === "cancelled") {
          setErrMsg("Job was cancelled.");
          setLoading(false);
          setStatusLoading(false);
          // Fetch files instead of results (don't open dropdown on refresh)
          await fetchFiles(false);
          return;
        }

        // If job is completed, fetch the files (don't open dropdown on refresh)
        if (statusResponse.data.status === "completed") {
          await fetchFiles(false);
        }
      } else {
        // If status check fails, try to fetch files anyway (might be old data)
        await fetchFiles(false);
      }
    } catch (err: any) {
      setErrMsg(err?.message || "Failed to refresh multifactor analysis");
      setServerRows([]);
      setTotal(undefined);
      setPages(undefined);
    } finally {
      setLoading(false);
      setStatusLoading(false);
    }
  };

  async function runAnalysis() {
    if (!Number.isFinite(selectedWorkflowId)) {
      setErrMsg("Missing or invalid workflowId.");
      return;
    }
    setPosting(true);
    setErrMsg(null);
    
    // Clear table data immediately when starting a new job
    setServerRows([]);
    setTotal(undefined);
    setPages(undefined);
    
    try {
      await postMultiFactorTrigger({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        num_vars_taken: num_vars_taken,
      });
      
      // After starting job, check status instead of fetching results
      const statusResponse = await getMultiFactorStatus({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
      });

      if (statusResponse?.success && statusResponse?.data) {
        setStatus(statusResponse.data);
        // Job will be pending/processing, so show status message
        if (statusResponse.data.status === "processing" || statusResponse.data.status === "pending") {
          setErrMsg(
            `Job is ${statusResponse.data.status}. Progress: ${statusResponse.data.progress}% - ${statusResponse.data.message || "Processing..."}`
          );
        }
      }
    } catch (e: any) {
      setErrMsg(e?.message || "Failed to start analysis.");
    } finally {
      setPosting(false);
    }
  }

  // Fetch files list
  const fetchFiles = async (openDropdown: boolean = true) => {
    if (!Number.isFinite(selectedWorkflowId)) {
      setErrMsg("Please select a workflow on Step 1 before fetching files.");
      return;
    }

    setFilesLoading(true);
    setErrMsg(null);
    try {
      const filesResponse = await getMultiFactorFiles({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
      });

      if (filesResponse?.success && filesResponse?.data) {
        setFilesData(filesResponse.data);
        if (openDropdown) {
          setShowFilesDropdown(true);
        }
      } else {
        setErrMsg(filesResponse?.msg || "Failed to fetch files");
      }
    } catch (err: any) {
      setErrMsg(err?.message || "Failed to fetch files");
    } finally {
      setFilesLoading(false);
    }
  };

  // Toggle file selection and load/unload file data
  const toggleFileSelection = async (filename: string) => {
    const isCurrentlySelected = selectedFiles.has(filename);
    
    if (isCurrentlySelected) {
      // Uncheck: Remove file data from array
      setSelectedFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
      
      // Remove rows from this file
      setFileRowMap((prev) => {
        const newMap = new Map(prev);
        newMap.delete(filename);
        
        // Rebuild fileBasedRows from remaining files
        const remainingRows: Row[] = [];
        newMap.forEach((rows) => {
          remainingRows.push(...rows);
        });
        setFileBasedRows(remainingRows);
        
        return newMap;
      });
    } else {
      // Check: Load file data
      if (!Number.isFinite(selectedWorkflowId)) {
        setErrMsg("Please select a workflow on Step 1 before loading files.");
        return;
      }
      
      // Check if adding this file would exceed the limit
      if (fileBasedRows.length >= MAX_FILE_ROWS) {
        setErrMsg(`Maximum limit of ${MAX_FILE_ROWS.toLocaleString()} rows reached. Please uncheck some files first.`);
        return;
      }
      
      setLoadingFiles((prev) => new Set(prev).add(filename));
      setSelectedFiles((prev) => new Set(prev).add(filename));
      
      try {
        const fileResponse = await getMultiFactorFile({
          apiBase: API_BASE,
          token,
          workflowId: Number(selectedWorkflowId),
          filename: filename,
        });
        
        if (fileResponse?.success && fileResponse?.data) {
          const newRows = fileResponse.data.rows as Row[];
          
          // Check if adding these rows would exceed limit
          const currentTotal = Array.from(fileRowMap.values()).reduce((sum, rows) => sum + rows.length, 0);
          const totalAfterAdd = currentTotal + newRows.length;
          
          if (totalAfterAdd > MAX_FILE_ROWS) {
            // Add only up to the limit
            const rowsToAdd = MAX_FILE_ROWS - currentTotal;
            const rowsToStore = newRows.slice(0, rowsToAdd);
            
            setFileRowMap((prev) => {
              const newMap = new Map(prev);
              newMap.set(filename, rowsToStore);
              return newMap;
            });
            
            setFileBasedRows((prev) => {
              const newTotal = prev.length + rowsToStore.length;
              return newTotal <= MAX_FILE_ROWS ? [...prev, ...rowsToStore] : prev;
            });
            
            setErrMsg(`Added ${rowsToAdd.toLocaleString()} rows (limit of ${MAX_FILE_ROWS.toLocaleString()} reached).`);
          } else {
            // Store rows for this file
            setFileRowMap((prev) => {
              const newMap = new Map(prev);
              newMap.set(filename, newRows);
              return newMap;
            });
            
            setFileBasedRows((prev) => [...prev, ...newRows]);
            setErrMsg(null);
          }
        } else {
          setErrMsg(fileResponse?.msg || "Failed to load file");
          setSelectedFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(filename);
            return newSet;
          });
        }
      } catch (err: any) {
        setErrMsg(err?.message || "Failed to load file");
        setSelectedFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(filename);
          return newSet;
        });
      } finally {
        setLoadingFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(filename);
          return newSet;
        });
      }
    }
  };
  
  // Clear file-based data when no files are selected
  useEffect(() => {
    if (selectedFiles.size === 0) {
      setFileBasedRows([]);
      setFileRowMap(new Map());
    }
  }, [selectedFiles]);

  // Cancel multifactor analysis
const onCancel = async () => {
    if (!Number.isFinite(selectedWorkflowId)) {
      setErrMsg("Please select a workflow on Step 1 before cancelling.");
      return;
    }

    setCancelling(true);
    setErrMsg(null);
    try {
      const cancelResponse = await cancelMultiFactorAnalysis({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
      });

      if (cancelResponse?.success) {
        setErrMsg("Job cancellation requested. The process will stop at the next checkpoint.");
        // Refresh status to update UI
        await onRefresh();
      } else {
        setErrMsg(cancelResponse?.msg || "Failed to cancel multifactor analysis");
      }
    } catch (err: any) {
      setErrMsg(err?.message || "Failed to cancel multifactor analysis");
    } finally {
      setCancelling(false);
    }
  };


  // Enable export once we have data and not loading/posting
  useEffect(() => {
    const ready =
      Number.isFinite(selectedWorkflowId) &&
      !loading &&
      !posting &&
      ((serverRows?.length ?? 0) > 0 || (total ?? 0) > 0 || fileBasedRows.length > 0);
    setExportReady(Boolean(ready));
  }, [selectedWorkflowId, loading, posting, serverRows, total, fileBasedRows.length]);

  // Export the current page via your exact endpoint
  async function exportCurrentPage() {
    if (!Number.isFinite(selectedWorkflowId)) return;
    setExportErr(null);
    setExportMsg(null);
    setExporting(true);
    try {
      if (selectedFiles.size > 0 && fileBasedRows.length > 0) {
        const headers = deriveHeaders(displayRows);
        const csv = toCsv(headers, displayRows);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const filename = `multifactor_results_selected_${selectedWorkflowId}_p${page}_ps${pageSize}.csv`;
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        setExportMsg("Export completed.");
        return;
      }
      const url = new URL(`${API_BASE}/api/overlay/development/multifactor_analysis`);
      url.searchParams.set("workflow_id", String(selectedWorkflowId));
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(pageSize));

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "text/csv,application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        let msg = `Export failed: HTTP ${res.status}`;
        try {
          const t = await res.text();
          if (t) msg = `${msg}  ${t}`;
        } catch {}
        throw new Error(msg);
      }

      const cd = res.headers.get("content-disposition") || "";
      const nameMatch =
        cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i) ||
        cd.match(/filename=["']?([^"']+)["']?/i);
      const fallbackName = `multifactor_results_${selectedWorkflowId}_p${page}_ps${pageSize}`;

       const blob = await res.blob();
        const filename = (nameMatch && decodeURIComponent(nameMatch[1])) || `${fallbackName}.csv`;
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
        setExportMsg("Export completed.");
    } catch (e: any) {
      setExportErr(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!hasTriggered) return;
    // fetchPage(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    setHasTriggered(false);
    setPage(1);
    setServerRows([]);
    setFilteredRows([]);
    setTotal(undefined);
    setPages(undefined);
    setErrMsg(null);
    setStatus(null);
    if (Number.isFinite(selectedWorkflowId)) saveHeaders(Number(selectedWorkflowId), []);
  }, [selectedWorkflowId]);


  useEffect(() => {
    if (!totalPages) return;
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const headerMeta = useMemo(
    () => {
      // If files are selected, use file-based data
      if (selectedFiles.size > 0 && fileBasedRows.length > 0) {
        return {
          total: fileBasedRows.length,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(fileBasedRows.length / pageSize)),
        };
      }
      // Otherwise use server data
      return {
        total: total ?? serverRows.length,
        page,
        pageSize,
        totalPages,
      };
    },
    [total, serverRows.length, page, pageSize, totalPages, selectedFiles, fileBasedRows]
  );

  return (
    <div className="min-h-dvh bg-neutral-50 p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-neutral-600">{description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Configuration Button */}
          {/* <button
            onClick={() => setShowConfig(true)}
            disabled={posting || loading || !Number.isFinite(selectedWorkflowId)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title="Configure multifactor analysis settings"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            Config
          </button> */}

          {/* Run */}
          <button
            onClick={runAnalysis}
            disabled={posting || loading || !Number.isFinite(selectedWorkflowId)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
            title={!selectedWorkflowId ? "Pick a workflow on Step 1" : ""}
          >
            <PlayCircleIcon className="h-4 w-4" />
            {posting ? "Running" : "Run Analysis"}
          </button>

          {/* Refresh (with status check) */}
          <button
            onClick={onRefresh}
            disabled={statusLoading || !Number.isFinite(selectedWorkflowId)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title={!selectedWorkflowId ? "Pick a workflow on Step 1" : "Check status and fetch latest results"}
          >
            <ArrowPathIcon className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} />
            {statusLoading ? "Checking" : "Refresh"}
          </button>

          {/* Cancel (only show when job is pending or processing) */}
          {status && (status.status === "pending" || status.status === "processing") && (
            <button
              onClick={() => setConfirmCancelOpen(true)}
              disabled={cancelling || !Number.isFinite(selectedWorkflowId)}
              className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              title={
                !selectedWorkflowId
                  ? "Pick a workflow on Step 1"
                  : "Cancel the running multifactor analysis job"
              }
            >
              <XCircleIcon
                className={`h-4 w-4 ${cancelling ? "animate-spin" : ""}`}
              />
              {cancelling ? "Cancelling" : "Cancel"}
            </button>

          )}

          {/* Files Button */}
          <button
            onClick={() => {
              if (showFilesDropdown) {
                setShowFilesDropdown(false);
              } else {
                fetchFiles();
              }
            }}
            disabled={filesLoading || !Number.isFinite(selectedWorkflowId)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title={!selectedWorkflowId ? "Pick a workflow on Step 1" : "View available files"}
          >
            <FolderIcon className="h-4 w-4" />
            {filesLoading ? "Loading" : "Files"}
          </button>

        </div>
      </div>
      <ConfirmCancelModal
        open={confirmCancelOpen}
        loading={cancelling}
        title="Cancel Process"
        message="⚠️ This action will cancel the ongoing multifactor analysis process. Any running computation will stop at the next checkpoint. Do you want to continue?"
        confirmText="Yes, cancel process"
        cancelText="No, keep running"
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={async () => {
          setConfirmCancelOpen(false);
          await onCancel();
        }}
      />

      {/* Controls / pagination */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!hasTriggered || loading || !canPrev}
          >
            <ChevronLeftIcon className="h-4 w-4" />
             Prev
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={totalPages ?? undefined}
            value={page}
            onChange={(e) => {
              const n = Math.max(1, Number(e.target.value) || 1);
              setPage(totalPages ? Math.min(n, totalPages) : n);
            }}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1"
            disabled={loading}
          />
          <span>/ {totalPages ?? "?"}</span>
          
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setPageSize(n);
              setPage(1);
            }}
            className="rounded-md border border-neutral-300 px-2 py-1"
            disabled={loading}
          >
            {[10, 20, 50, 100, 1000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
                    {/* Export */}
          <button
            onClick={exportCurrentPage}
            disabled={!exportReady || exporting || !Number.isFinite(selectedWorkflowId)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title={
              !Number.isFinite(selectedWorkflowId)
                ? "Pick a workflow on Step 1"
                : !exportReady
                ? "Load results first"
                : "Download CSV"
            }
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {exporting ? "Exporting" : "Export"}
          </button>
        </div>
      </div>

      {/* Errors */}
      {errMsg && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errMsg}
        </div>
      )}
      {exportErr && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {exportErr}
        </div>
      )}
      {exportMsg && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {exportMsg}
        </div>
      )}
      {status && (status.status === "processing" || status.status === "pending") && (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">
                Job Status: {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                {status.message || "Processing..."}
              </div>
              {status.progress !== null && status.progress !== undefined && (
                <div className="mt-2">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${status.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {status.progress}% complete
                  </div>
                </div>
              )}
              {status.running_time_seconds !== null && (
                <div className="text-xs text-blue-600 mt-1">
                  Running time: {Math.floor(status.running_time_seconds / 60)}m {status.running_time_seconds % 60}s
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {status && status.status === "completed" && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
           Job completed successfully
          {status.running_time_seconds !== null && (
            <span className="ml-2 text-xs">
              (Completed in {Math.floor(status.running_time_seconds / 60)}m {status.running_time_seconds % 60}s)
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <div className="animate-pulse rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm">
              Loading
            </div>
          </div>
        )}

        <Multi_Table
          data={displayRows}
          onFilteredChange={(filtered: any) => setFilteredRows(filtered)}
          emptyMessage={hasTriggered ? "No results" : "Click Run Analysis to fetch results."}
        />
      </div>

      {/* Footer / counts */}
      <p className="mt-3 text-sm text-neutral-600">
        {selectedFiles.size > 0 && fileBasedRows.length > 0 ? (
          <>
            Showing {filteredRows.length} of {fileBasedRows.length.toLocaleString()} rows
            {fileBasedRows.length >= MAX_FILE_ROWS && (
              <span className="ml-2 text-amber-600">(Limit reached)</span>
            )}
            {" "}(page {headerMeta.page} of {headerMeta.totalPages ?? "?"})
          </>
        ) : (
          <>Showing {filteredRows.length} of {headerMeta.total ?? 0} (page {headerMeta.page} of{" "}
          {headerMeta.totalPages ?? "?"}).</>
        )}
      </p>

      {/* Files Modal */}
      {showFilesDropdown && filesData && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFilesDropdown(false)} />

          {/* Modal */}
          <div className="absolute left-1/2 top-1/2 w-[min(100vw-2rem,600px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between  p-4">
              <div>
                <h3 className="text-lg font-semibold">Files</h3>
                <p className="text-xs text-neutral-600 mt-1">{filesData.folder_name}</p>
                <p className="text-xs text-neutral-600">{filesData.total_files} file(s)</p>
              </div>
              <button
                onClick={() => {
                  setShowFilesDropdown(false);
                }}
                className="rounded-md p-2 hover:bg-neutral-100"
                title="Close"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Body (scrollable) */}
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-2">
                {filesData.files.map((file) => {
                  const isSelected = selectedFiles.has(file.filename);
                  const isLoading = loadingFiles.has(file.filename);
                  return (
                    <label
                      key={file.filename}
                      className={`flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer border ${
                        isSelected ? "bg-yellow-50 border-yellow-300" : "border-gray-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFileSelection(file.filename)}
                        disabled={isLoading}
                        className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 disabled:opacity-50"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {file.filename}
                          {isLoading && (
                            <span className="text-xs text-gray-500">Loading...</span>
                          )}
                        </div>
                        {file.size_bytes !== null && (
                          <div className="text-xs text-gray-500 mt-1">
                            {(file.size_bytes / 1024).toFixed(2)} KB
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            {selectedFiles.size > 0 && (
              <div className="flex items-center justify-between border-t p-4 bg-gray-50">
                <div>
                  <p className="text-sm text-gray-700">
                    {selectedFiles.size} file(s) selected
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {fileBasedRows.length.toLocaleString()} / {MAX_FILE_ROWS.toLocaleString()} rows loaded
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFiles(new Set());
                    setFileBasedRows([]);
                    setFileRowMap(new Map());
                  }}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfig(false)} />
          
          {/* Dialog */}
          <div className="absolute left-1/2 top-1/2 w-[min(100vw-2rem,500px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between  p-4">
              <div>
                <h3 className="text-lg font-semibold">Configuration</h3>
                <p className="text-xs text-neutral-600">
                  Configure the number of variables per combination for multifactor analysis.
                </p>
              </div>
              <button
                onClick={() => setShowConfig(false)}
                className="rounded-md p-2 hover:bg-neutral-100"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <div>
                  <label htmlFor="num_vars_taken" className="block text-sm font-medium text-gray-700 mb-2">
                    Number of variables per combination
                  </label>
                  <input
                    id="num_vars_taken"
                    type="number"
                    min="1"
                    step="1"
                    value={num_vars_taken}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow positive integers
                      if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                        setNum_vars_taken(value === "" ? 2 : Number(value));
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent decimal point, negative sign, and 'e' key
                      if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                        e.preventDefault();
                      }
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Enter number of variables per combination"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be a positive integer (default: 2)
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t p-4">
              <button
                onClick={() => setShowConfig(false)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (num_vars_taken > 0 && Number.isInteger(num_vars_taken)) {
                    setShowConfig(false);
                  }
                }}
                disabled={!Number.isInteger(num_vars_taken) || num_vars_taken <= 0}
                className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step4;
