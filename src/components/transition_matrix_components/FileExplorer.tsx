// src/components/file_explorer/FileExplorer.tsx (adjust path if needed)
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FolderIcon,
  ArrowUpTrayIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useDropzone } from "react-dropzone";
import { invoke } from "@tauri-apps/api/core";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux_toolkit/store";
import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import ApiStatusIndicator from "../ApiStatusIndicators";
import { fetch } from "@tauri-apps/plugin-http";

import WorkflowPickerModal from "../modals/WorkflowPickerModal"; // ✅ align to Step1 import style
import type { Workflow } from "../../services/workflow";

import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWorkflowId,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

interface FileItem {
  name: string;
  is_folder: boolean;
  is_sync?: boolean;
}

interface ValidationError {
  year: string;
  missingMonths: string[];
}

interface YearValidationError {
  type: "missing_years" | "insufficient_years";
  message: string;
  availableYears: string[];
  missingYears?: string[];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const parseFileName = (
  filename: string
): { year: string; month: string } | null => {
  const match = filename.match(/Transactional Report (\w+) (\d{4})\.xlsx$/i);
  if (match) return { month: match[1], year: match[2] };
  return null;
};

const validateMonthlyFiles = (filenames: string[]): ValidationError[] => {
  const yearData: { [year: string]: Set<string> } = {};
  const errors: ValidationError[] = [];

  filenames.forEach((filename) => {
    const parsed = parseFileName(filename);
    if (!parsed) return;
    if (!yearData[parsed.year]) yearData[parsed.year] = new Set();
    yearData[parsed.year].add(parsed.month);
  });

  Object.entries(yearData).forEach(([year, months]) => {
    const missingMonths = MONTHS.filter((m) => !months.has(m));
    if (missingMonths.length > 0) errors.push({ year, missingMonths });
  });

  return errors;
};

const validateConsecutiveYears = (
  filenames: string[]
): YearValidationError | null => {
  const years = new Set<string>();
  filenames.forEach((filename) => {
    const parsed = parseFileName(filename);
    if (parsed) years.add(parsed.year);
  });

  const availableYears = Array.from(years).sort(
    (a, b) => parseInt(a) - parseInt(b)
  );

  if (availableYears.length < 3) {
    return {
      type: "insufficient_years",
      message: `Only ${availableYears.length} year(s) found. Need at least 3 consecutive years.`,
      availableYears,
    };
  }

  const yearNumbers = availableYears.map((y) => parseInt(y));
  const minYear = Math.min(...yearNumbers);
  const maxYear = Math.max(...yearNumbers);

  let maxConsecutive = 0;
  let cur = 0;
  for (let year = minYear; year <= maxYear; year++) {
    if (yearNumbers.includes(year)) {
      cur++;
      maxConsecutive = Math.max(maxConsecutive, cur);
    } else cur = 0;
  }

  if (maxConsecutive < 3) {
    const missingYears: string[] = [];
    for (let year = minYear; year <= maxYear; year++) {
      if (!yearNumbers.includes(year)) missingYears.push(String(year));
    }
    return {
      type: "missing_years",
      message: `Missing years detected. Need at least 3 consecutive years.`,
      availableYears,
      missingYears,
    };
  }

  return null;
};

export default function FileExplorer() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);

  const [currentPath] = useState("ECL_Calculation_Run_1");
  const [contents, setContents] = useState<FileItem[]>([]);
  const [loading, _setLoading] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<{
    [path: string]: { fileName: string };
  }>({});

  const [_importedFiles, setImportedFiles] = useState<{ [key: string]: FileItem[] }>(
    {}
  );

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [statusMessage, setStatusMessage] = useState("");

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const [yearValidationError, setYearValidationError] =
    useState<YearValidationError | null>(null);
  const [showYearValidationError, setShowYearValidationError] = useState(false);

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
    currentPdTransitionMatrixWorkflowId: workflowId,
    selectedPdTransitionMatrixLoanProduct: loanProduct,
    selectedPdTransitionMatrixReportDateStart: reportDateStart,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper as any);

  const workflowPathLabel = useMemo(() => {
    if (!entity || !period || !workflowName) return "No workflow selected";
    return `/${entity}/${period}/${workflowName}`;
  }, [entity, period, workflowName]);

  const handlePickWorkflow = useCallback(
    (w: Workflow) => {
      const nextEntity = (w as any).entity ?? "";
      const nextPeriod =
        (w as any).reporting_period ?? (w as any).reportingPeriod ?? "";
      const nextName = (w as any).workflow_name ?? (w as any).name ?? "";
      const nextId = typeof (w as any).id === "number" ? (w as any).id : null;

      if (nextEntity) dispatch(setPdTransitionMatrixSelectedEntity({ entity: nextEntity }));
      if (nextPeriod) dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: nextPeriod }));
      if (nextName) dispatch(setPdTransitionMatrixWfName({ workflow_name: nextName }));
      dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: nextId }));

      setPickerOpen(false);
    },
    [dispatch, loanProduct, reportDateStart]
  );

  const clearWorkflowUi = useCallback(() => {
    setContents([]);
    setSelectedFiles({});
    setValidationErrors([]);
    setShowValidationErrors(false);
    setYearValidationError(null);
    setShowYearValidationError(false);
  }, []);

  // ✅ clear file UI when workflow changes (like Step1)
  useEffect(() => {
    clearWorkflowUi();
  }, [workflowId, clearWorkflowUi]);

  // Fetch existing Excel files for workflow
  // const fetchExistingFiles = useCallback(async () => {
  //   if (!entity || !period || !workflowName || !token) {
  //     setContents([]);
  //     setStatus("idle");
  //     setStatusMessage("Pick a workflow to load files.");
  //     return;
  //   }

  //   setStatus("loading");
  //   setStatusMessage("Loading files...");
  //   setLoading(true);

  //   try {
  //     const url = new URL(`${API_BASE}/documents/workflows/files`);
  //     url.searchParams.append("entity", entity);
  //     url.searchParams.append("reporting_period", period);
  //     url.searchParams.append("workflow_name", workflowName);

  //     const response = await fetch(url.toString(), {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });

  //     if (!response.ok) {
  //       setStatus("error");
  //       setStatusMessage(`Error ${response.status}: ${response.statusText}`);
  //       return;
  //     }

  //     const files: string[] = await response.json();

  //     const fileItems: FileItem[] = files.map((filename) => ({
  //       name: filename,
  //       is_folder: false,
  //       is_sync: true,
  //     }));

  //     setContents(fileItems);

  //     let vErrors: ValidationError[] = [];
  //     let yError: YearValidationError | null = null;

  //     if (files.length > 0) {
  //       vErrors = validateMonthlyFiles(files);
  //       yError = validateConsecutiveYears(files);
  //     }

  //     setValidationErrors(vErrors);
  //     setYearValidationError(yError);

  //     let msg = "Files loaded successfully";
  //     if (vErrors.length > 0) {
  //       setShowValidationErrors(true);
  //       msg += `. ${vErrors.length} year(s) have missing months`;
  //     }
  //     if (yError) {
  //       setShowYearValidationError(true);
  //       msg += `. ${yError.message}`;
  //     }
  //     if (vErrors.length === 0 && !yError && files.length > 0) {
  //       msg += " - all months and years are complete!";
  //     } else if (files.length > 0) {
  //       msg += " - see details below.";
  //     }

  //     setStatus("success");
  //     setStatusMessage(msg);
  //   } catch (error) {
  //     console.error("Error fetching files:", error);
  //     setStatus("error");
  //     setStatusMessage("Failed to load files");
  //     setContents([]);
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [entity, period, workflowName, token, importedFiles]);

  // useEffect(() => {
  //   if (entity && period && workflowName) fetchExistingFiles();
  // }, [entity, period, workflowName, workflowId, fetchExistingFiles]);

  const handleFileSelect = (path: string, fileName: string) => {
    setSelectedFiles({ [path]: { fileName } });
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  const checkForDuplicates = (files: File[]): string[] => {
    const existing = contents.map((f) => f.name);
    return files.map((f) => f.name).filter((n) => existing.includes(n));
  };

  const processFileUpload = async (filesToUpload: File[]) => {
    if (!entity || !period || !workflowName) {
      setStatus("error");
      setStatusMessage("Missing workflow data. Please switch workflow.");
      return;
    }

    const allFilenames = [...contents.map((f) => f.name), ...filesToUpload.map((f) => f.name)];
    const vErrors = validateMonthlyFiles(allFilenames);
    const yError = validateConsecutiveYears(allFilenames);

    setValidationErrors(vErrors);
    setYearValidationError(yError);
    if (vErrors.length > 0) setShowValidationErrors(true);
    if (yError) setShowYearValidationError(true);

    const workflow_path = `/${entity}/${period}/${workflowName}`;

    try {
      const filesPayload = filesToUpload.map((file) => ({
        filename: file.name,
        workflow_path,
      }));

      const response = await fetch(`${API_BASE}/documents/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(filesPayload),
      });

      if (!response.ok) {
        setStatus("error");
        setStatusMessage(`Error ${response.status}: ${response.statusText}`);
        return;
      }

      await response.json();

      const docUpload = await Promise.all(
        filesToUpload.map(async (file) => ({
          filename: file.name,
          contents_base64: await fileToBase64(file),
        }))
      );

      await invoke<string>("upload_files", {
        entity,
        period,
        workflowName,
        files: docUpload,
      });

      const newFiles = filesToUpload.map((file) => ({
        name: file.name,
        is_folder: false,
        is_sync: true,
      }));

      setImportedFiles((prev: { [key: string]: FileItem[] }) => ({
        ...prev,
        [currentPath]: [...(prev[currentPath] || []), ...newFiles],
      }));
      setContents((prev) => [...prev, ...newFiles]);

      setStatus("success");
      setStatusMessage("Upload successful!");
    } catch (error) {
      console.error("Upload failed:", error);
      setStatus("error");
      setStatusMessage("Upload failed");
    }
  };

  const handleDuplicateConfirmation = async (replaceExisting: boolean) => {
    setShowDuplicateModal(false);

    if (!replaceExisting) {
      const newFiles = pendingFiles.filter((f) => !duplicateFiles.includes(f.name));
      if (newFiles.length > 0) await processFileUpload(newFiles);
    } else {
      await processFileUpload(pendingFiles);
    }

    setPendingFiles([]);
    setDuplicateFiles([]);
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (!entity || !period || !workflowName) {
      setStatus("error");
      setStatusMessage("No workflow selected. Click Switch Workflow first.");
      return;
    }

    const duplicates = checkForDuplicates(acceptedFiles);
    if (duplicates.length > 0) {
      setDuplicateFiles(duplicates);
      setPendingFiles(acceptedFiles);
      setShowDuplicateModal(true);
      return;
    }

    await processFileUpload(acceptedFiles);
  };

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: true,
  });

  const handleRemoveFile = (fileName: string) => {
    setContents((prev) => {
      const next = prev.filter((f) => f.name !== fileName);

      const remainingNames = next.map((f) => f.name);
      const vErrors = validateMonthlyFiles(remainingNames);
      const yError = validateConsecutiveYears(remainingNames);

      setValidationErrors(vErrors);
      setYearValidationError(yError);

      if (vErrors.length === 0 && !yError) {
        setShowValidationErrors(false);
        setShowYearValidationError(false);
        setStatus("success");
        setStatusMessage("All months and years are now complete!");
      } else {
        if (vErrors.length > 0) setShowValidationErrors(true);
        if (yError) setShowYearValidationError(true);
      }

      return next;
    });
  };

  const uploadStatus = useMemo(() => {
    if (loading) return { status: "loading", message: "Loading files..." as const };
    if (!entity || !period || !workflowName) return { status: "empty", message: "Pick a workflow to begin." as const };
    if (validationErrors.length === 0 && !yearValidationError && contents.length > 0) {
      return { status: "success", message: "All months and years are complete!" as const };
    }
    if ((validationErrors.length > 0 || yearValidationError) && contents.length > 0) {
      return { status: "partial", message: "Some requirements are incomplete — see details below." as const };
    }
    return { status: "idle", message: contents.length ? "Files loaded." : "No files found yet." as const };
  }, [loading, entity, period, workflowName, validationErrors.length, yearValidationError, contents.length]);

  return (
    <div className="space-y-4 w-full bg-gray-50 px-4 pt-4 pb-8 rounded-lg border border-gray-200">
      {/* ✅ Header aligned to Step1 */}
      <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">
              Transactional Report Files
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Workflow: <span className="font-mono">{workflowPathLabel}</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Workflow ID: <span className="font-mono">{workflowId ?? "—"}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer"
              title="Pick from completed workflows"
            >
              Switch Workflow
            </button>

            {uploadStatus.status === "success" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                Complete
              </span>
            )}
            {uploadStatus.status === "partial" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Needs Attention
              </span>
            )}
            {uploadStatus.status === "loading" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-b border-gray-100lue-600 border-t-transparent" />
                Loading...
              </span>
            )}
          </div>
        </div>

        {/* Optional small meta row (keeps it “aligned”) */}
        {(loanProduct || reportDateStart) && (
          <div className="px-5 py-3 border-b border-gray-100 bg-white">
            <div className="flex flex-wrap gap-2">
              {loanProduct && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700">
                  Loan Product: {loanProduct}
                </span>
              )}
              {reportDateStart && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700">
                  Report Date Start: {reportDateStart}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="px-5 py-4">
          {/* nav buttons row (kept from your original) */}
          <div className="flex justify-between mb-2">
            <div className="flex items-center space-x-2">
              <button onClick={() => {}} disabled>
                <ArrowLeftIcon className="w-5 h-5 text-gray-300" />
              </button>
              <button onClick={() => {}} disabled>
                <ArrowRightIcon className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          </div>

          {/* Year Validation Errors Display */}
          {showYearValidationError && yearValidationError && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center mb-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 mr-2" />
                <h3 className="text-sm font-semibold text-orange-800">
                  Year Coverage Status
                </h3>
                <button
                  onClick={() => setShowYearValidationError(false)}
                  className="ml-auto text-orange-600 hover:text-orange-800"
                >
                  ×
                </button>
              </div>

              <div className="bg-white p-3 rounded border border-orange-200">
                <div className="font-medium text-orange-800 mb-2">
                  {yearValidationError.message}
                </div>

                <div className="mb-3">
                  <div className="text-sm text-orange-700 mb-2">
                    Available years: {yearValidationError.availableYears.join(", ")}
                  </div>

                  {yearValidationError.missingYears?.length ? (
                    <div className="text-sm text-orange-700 mb-2">
                      Missing years: {yearValidationError.missingYears.join(", ")}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {yearValidationError.availableYears.map((year, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full"
                    >
                      {year}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 text-sm text-orange-700">
                <p className="mt-1">
                  <strong>Requirement:</strong> At least 3 consecutive years of data
                </p>
              </div>
            </div>
          )}

          {/* Validation Errors Display */}
          {showValidationErrors && validationErrors.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center mb-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2" />
                <h3 className="text-sm font-semibold text-yellow-800">
                  Monthly Reports Status
                </h3>
                <button
                  onClick={() => setShowValidationErrors(false)}
                  className="ml-auto text-yellow-600 hover:text-yellow-800"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {validationErrors.map((error, index) => (
                  <div
                    key={index}
                    className="bg-white p-3 rounded border border-yellow-200"
                  >
                    <div className="font-medium text-yellow-800 mb-2">
                      Year {error.year} - Missing {error.missingMonths.length} month(s):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {error.missingMonths.map((month, monthIndex) => (
                        <span
                          key={monthIndex}
                          className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full"
                        >
                          {month}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-sm text-yellow-700">
                <p className="mt-1">
                  <strong>Expected format:</strong> "Transactional Report [Month] [Year].xlsx"
                </p>
              </div>
            </div>
          )}

          {/* main grid - same as your original layout */}
          <div className="grid grid-cols-6 gap-4 mt-4">
            <div className="col-span-1 flex flex-col items-center p-4 ">
              <div className="border border-gray-300 flex flex-col items-center w-full min-h-16 p-2 bg-gray-100">
                <FolderIcon className="w-6 h-6 text-[#d5b527]" />
                <span className="text-xs mt-1">{currentPath}</span>
              </div>
            </div>

            <div
              {...getRootProps()}
              className={clsx(
                "col-span-5 relative flex flex-col w-full min-h-[50vh] p-4 bg-white rounded-md border-2 border-dashed overflow-auto border-gray-400 transition-all",
                {
                  "bg-gray-100 border-b border-gray-100lue-400": isDragActive,
                  "justify-center items-center": loading || contents.length === 0,
                }
              )}
            >
              <input {...getInputProps()} />

              {loading ? (
                <div className="text-center text-gray-600">Loading files...</div>
              ) : contents.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 w-full">
                  {contents.map((file) => (
                    <div
                      key={file.name}
                      className={clsx(
                        "relative p-3 bg-yellow-50 rounded-lg flex flex-col items-center cursor-pointer hover:bg-gray-200 transition",
                        {
                          "bg-yellow-100":
                            selectedFiles[currentPath]?.fileName === file.name,
                        }
                      )}
                      onClick={() => handleFileSelect(currentPath, file.name)}
                    >
                      <div className="w-12 h-12 rounded-md flex items-center justify-center mb-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(file.name);
                          }}
                          className="absolute top-1 right-1 text-gray-600 hover:text-red-600"
                          aria-label={`Remove ${file.name}`}
                        >
                          ×
                        </button>

                        {/* Excel icon */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="60"
                          height="60"
                          viewBox="0 0 48 48"
                        >
                          <defs>
                            <linearGradient
                              id="grad1"
                              x1="6"
                              x2="27"
                              y1="24"
                              y2="24"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop offset="0" stopColor="#21ad64"></stop>
                              <stop offset="1" stopColor="#088242"></stop>
                            </linearGradient>
                          </defs>
                          <path
                            fill="#31c447"
                            d="m41,10h-16v28h16c.55,0,1-.45,1-1V11c0-.55-.45-1-1-1Z"
                          />
                          <path
                            fill="#fff"
                            d="m32,15h7v3h-7v-3Zm0,10h7v3h-7v-3Zm0,5h7v3h-7v-3Zm0-10h7v3h-7v-3Zm-7-5h5v3h-5v-3Zm0,10h5v3h-5v-3Zm0,5h5v3h-5v-3Zm0-10h5v3h-5v-3Z"
                          />
                          <path fill="url(#grad1)" d="m27,42l-21-4V10l21-4v36Z" />
                          <path
                            fill="#fff"
                            d="m19.13,31l-2.41-4.56c-.09-.17-.19-.48-.28-.94h-.04c-.05.22-.15.54-.32.98l-2.42,4.52h-3.76l4.46-7-4.08-7h3.84l2,4.2c.16.33.3.73.42,1.18h.04c.08-.27.22-.68.44-1.22l2.23-4.16h3.51l-4.2,6.94,4.32,7.06h-3.74Z"
                          />
                        </svg>
                      </div>

                      <span className="text-xs text-center break-all">
                        {file.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-600">
                  {isDragActive ? (
                    "Drop files here to upload"
                  ) : (
                    <div className="flex flex-col items-center justify-center pb-12">
                      <CloudArrowDownIcon className="h-24 w-24" />
                      No files found. Drag files here or use the button below.
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={open}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-yellow-300 text-gray-700 inline-flex items-center gap-2 rounded-md text-sm font-semibold cursor-pointer shadow"
                disabled={!entity || !period || !workflowName}
                title={
                  !entity || !period || !workflowName
                    ? "Select a workflow first"
                    : "Select a file"
                }
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
                Select a file
              </button>
            </div>

            <ApiStatusIndicator
              status={status}
              message={statusMessage}
              onHide={() => setStatus("idle")}
            />
          </div>
        </div>
      </div>

      {/* Duplicate Files Confirmation Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-center mb-4 bg-red-100 p-3 rounded-t-lg -m-6 mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 mr-3" />
              <h3 className="text-lg font-semibold text-orange-800">
                Duplicate Files Detected
              </h3>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 mb-3">
                The following files already exist in the current folder:
              </p>
              <div className="bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                {duplicateFiles.map((filename, index) => (
                  <div key={index} className="text-sm text-gray-600 py-1">
                    • {filename}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">What would you like to do?</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => handleDuplicateConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Skip Duplicates
              </button>
              <button
                onClick={() => handleDuplicateConfirmation(true)}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                Replace All
              </button>
            </div>

            <div className="mt-3 text-center">
              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setPendingFiles([]);
                  setDuplicateFiles([]);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Workflow picker modal aligned to Step1 */}
      <WorkflowPickerModal
        open={pickerOpen}
        token={token}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickWorkflow}
      />
    </div>
  );
}

