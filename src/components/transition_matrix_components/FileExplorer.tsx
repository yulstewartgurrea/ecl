import { useState, useEffect } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FolderIcon,
  ArrowUpTrayIcon,
  CloudArrowDownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useDropzone } from "react-dropzone";
import { invoke } from "@tauri-apps/api/core";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux_toolkit/store";
import { useAppSelector } from "../../redux_toolkit/hooks";
import ApiStatusIndicator from "../ApiStatusIndicators";
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
  type: 'missing_years' | 'insufficient_years';
  message: string;
  availableYears: string[];
  missingYears?: string[];
}

// Month validation utilities
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const parseFileName = (filename: string): { year: string; month: string } | null => {
  // Expected format: "Transactional Report [Month] [Year].xlsx"
  const match = filename.match(/Transactional Report (\w+) (\d{4})\.xlsx$/i);
  if (match) {
    return {
      month: match[1],
      year: match[2]
    };
  }
  return null;
};

const validateMonthlyFiles = (filenames: string[]): ValidationError[] => {
  const yearData: { [year: string]: Set<string> } = {};
  const errors: ValidationError[] = [];

  // Parse all filenames and group by year
  filenames.forEach(filename => {
    const parsed = parseFileName(filename);
    if (parsed) {
      if (!yearData[parsed.year]) {
        yearData[parsed.year] = new Set();
      }
      yearData[parsed.year].add(parsed.month);
    }
  });

  // Check each year for completeness
  Object.entries(yearData).forEach(([year, months]) => {
    const missingMonths = MONTHS.filter(month => !months.has(month));
    if (missingMonths.length > 0) {
      errors.push({
        year,
        missingMonths
      });
    }
  });

  return errors;
};

const validateConsecutiveYears = (filenames: string[]): YearValidationError | null => {
  const years = new Set<string>();
  
  // Extract all years from filenames
  filenames.forEach(filename => {
    const parsed = parseFileName(filename);
    if (parsed) {
      years.add(parsed.year);
    }
  });

  const availableYears = Array.from(years).sort((a, b) => parseInt(a) - parseInt(b));
  
  if (availableYears.length < 3) {
    return {
      type: 'insufficient_years',
      message: `Only ${availableYears.length} year(s) found. Need at least 3 consecutive years.`,
      availableYears
    };
  }

  // Check for consecutive years
  const yearNumbers = availableYears.map(y => parseInt(y));
  const minYear = Math.min(...yearNumbers);
  const maxYear = Math.max(...yearNumbers);
  
  // Check if we have at least 3 consecutive years
  let consecutiveCount = 0;
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  
  for (let year = minYear; year <= maxYear; year++) {
    if (yearNumbers.includes(year)) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }
  
  if (maxConsecutive < 3) {
    // Find missing years in the range
    const missingYears: string[] = [];
    for (let year = minYear; year <= maxYear; year++) {
      if (!yearNumbers.includes(year)) {
        missingYears.push(year.toString());
      }
    }
    
    return {
      type: 'missing_years',
      message: `Missing years detected. Need at least 3 consecutive years.`,
      availableYears,
      missingYears
    };
  }

  return null; // No errors
};

const FileExplorer = () => {
  const [currentPath] = useState("ECL_Calculation_Run_1");
  const [contents, setContents] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{
    [path: string]: { fileName: string };
  }>({});
  const [importedFiles, setImportedFiles] = useState<{
    [key: string]: FileItem[];
  }>({});
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [yearValidationError, setYearValidationError] = useState<YearValidationError | null>(null);
  const [showYearValidationError, setShowYearValidationError] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const authToken = useAppSelector((state) => state.auth.token);
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  // Fetch existing Excel files for workflow
  useEffect(() => {
    setStatus("loading");
    setStatusMessage("Loading files...");
    async function fetchExistingFiles() {
      if (!entity || !period || !workflowName) {
        setContents([]);
        return;
      }

      setLoading(true);
      try {
        const url = new URL("http://127.0.0.1:8000/documents/workflows/files");
        url.searchParams.append("entity", entity);
        url.searchParams.append("reporting_period", period);
        url.searchParams.append("workflow_name", workflowName);

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          // Reflect error with specific message
          console.log(importedFiles)
          setStatus("error");
          setStatusMessage(`Error ${response.status}: ${response.statusText}`);
          return;
        }

        const files: string[] = await response.json();

        const fileItems: FileItem[] = files.map((filename) => ({
          name: filename,
          is_folder: false,
          is_sync: true,
        }));

        setContents(fileItems);
        
        // Validate existing files for completeness (only if there are files)
        let existingValidationErrors: ValidationError[] = [];
        let existingYearValidationError: YearValidationError | null = null;
        
        if (files.length > 0) {
          existingValidationErrors = validateMonthlyFiles(files);
          existingYearValidationError = validateConsecutiveYears(files);
        }
        
        setValidationErrors(existingValidationErrors);
        setYearValidationError(existingYearValidationError);
        
        let statusMessage = "Files loaded successfully";
        if (existingValidationErrors.length > 0) {
          setShowValidationErrors(true);
          statusMessage += `. ${existingValidationErrors.length} year(s) have missing months`;
        }
        if (existingYearValidationError) {
          setShowYearValidationError(true);
          statusMessage += `. ${existingYearValidationError.message}`;
        }
        if (existingValidationErrors.length === 0 && !existingYearValidationError) {
          if (files.length > 0) {
            statusMessage += " - all months and years are complete!";
          }
        } else if (files.length > 0) {
          statusMessage += " - see details below.";
        }
        
        setStatus("success");
        setStatusMessage(statusMessage);
      } catch (error) {
        console.error("Error fetching files:", error);
        setStatus("error");
        setStatusMessage("Failed to load files");
        setContents([]);
      } finally {
        setLoading(false);
      }
    }

    fetchExistingFiles();
    console.log('useEffect')
  }, [entity, period, workflowName, authToken]);

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
    const existingFilenames = contents.map(f => f.name);
    return files
      .map(f => f.name)
      .filter(filename => existingFilenames.includes(filename));
  };

  const handleDuplicateConfirmation = async (replaceExisting: boolean) => {
    setShowDuplicateModal(false);
    
    if (!replaceExisting) {
      // Filter out duplicate files and only upload new ones
      const newFiles = pendingFiles.filter(file => !duplicateFiles.includes(file.name));
      if (newFiles.length > 0) {
        await processFileUpload(newFiles);
      }
    } else {
      // Upload all files (including duplicates)
      await processFileUpload(pendingFiles);
    }
    
    // Clear pending state
    setPendingFiles([]);
    setDuplicateFiles([]);
  };

  const processFileUpload = async (filesToUpload: File[]) => {
    if (!entity || !period || !workflowName) {
      console.error("Missing workflow data from Redux state");
      return;
    }

    // Validate files for complete months (but don't block upload)
    const allFilenames = [...contents.map(f => f.name), ...filesToUpload.map(f => f.name)];
    const validationErrors = validateMonthlyFiles(allFilenames);
    const yearValidationError = validateConsecutiveYears(allFilenames);
    
    // Update validation errors but don't block upload
    setValidationErrors(validationErrors);
    setYearValidationError(yearValidationError);
    
    if (validationErrors.length > 0) {
      setShowValidationErrors(true);
    }
    if (yearValidationError) {
      setShowYearValidationError(true);
    }

    const workflow_path = `/${entity}/${period}/${workflowName}`;

    try {
      // Prepare payload for backend document creation API
      const filesPayload = filesToUpload.map((file) => ({
        filename: file.name,
        workflow_path: workflow_path,
      }));

      const response = await fetch("http://127.0.0.1:8000/documents/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(filesPayload),
      });

      if (!response.ok) {
        // Reflect error with specific message
        setStatus("error");
        setStatusMessage(`Error ${response.status}: ${response.statusText}`);
        return;
      }

      const data = await response.json();
      console.log("Upload successful:", data);

      // Convert files to base64 for Tauri upload
      const docUpload = await Promise.all(
        filesToUpload.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            filename: file.name,
            contents_base64: base64,
          };
        })
      );

      const result = await invoke<string>("upload_files", {
        entity,
        period,
        workflowName,
        files: docUpload,
      });

      console.log("Upload result:", result);

      // Update local UI state with new files
      const newFiles = filesToUpload.map((file) => ({
        name: file.name,
        is_folder: false,
        is_sync: true,
      }));

      setImportedFiles((prev) => ({
        ...prev,
        [currentPath]: [...(prev[currentPath] || []), ...newFiles],
      }));

      // Also update contents to include new files immediately
      setContents((prev) => [...prev, ...newFiles]);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (!entity || !period || !workflowName) {
      console.error("Missing workflow data from Redux state");
      return;
    }

    // Check for duplicate files
    const duplicates = checkForDuplicates(acceptedFiles);
    
    if (duplicates.length > 0) {
      // Show modal for duplicate confirmation
      setDuplicateFiles(duplicates);
      setPendingFiles(acceptedFiles);
      setShowDuplicateModal(true);
      return;
    }

    // No duplicates, proceed with upload
    await processFileUpload(acceptedFiles);
  };

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: true,
  });
  const handleRemoveFile = (fileName: string) => {
    setContents((prev) => {
      const newContents = prev.filter((file) => file.name !== fileName);
      
      // Re-validate after removing a file
      const remainingFilenames = newContents.map(f => f.name);
      const newValidationErrors = validateMonthlyFiles(remainingFilenames);
      const newYearValidationError = validateConsecutiveYears(remainingFilenames);
      
      setValidationErrors(newValidationErrors);
      setYearValidationError(newYearValidationError);
      
      if (newValidationErrors.length === 0 && !newYearValidationError) {
        setShowValidationErrors(false);
        setShowYearValidationError(false);
        setStatus("success");
        setStatusMessage("All months and years are now complete!");
      } else {
        if (newValidationErrors.length > 0) {
          setShowValidationErrors(true);
        }
        if (newYearValidationError) {
          setShowYearValidationError(true);
        }
      }
      
      return newContents;
    });
  };

  return (
    <div className="space-y-4 w-full bg-gray-50 px-4 pt-4 pb-8 rounded-lg border border-gray-200">
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
                Available years: {yearValidationError.availableYears.join(', ')}
              </div>
              
              {yearValidationError.missingYears && yearValidationError.missingYears.length > 0 && (
                <div className="text-sm text-orange-700 mb-2">
                  Missing years: {yearValidationError.missingYears.join(', ')}
                </div>
              )}
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
            {/* <p>You can still upload files, but consider adding data for consecutive years for complete analysis coverage.</p> */}
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
              <div key={index} className="bg-white p-3 rounded border border-yellow-200">
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
            {/* <p>You can still upload files, but consider adding the missing months for complete data coverage.</p> */}
            <p className="mt-1">
              <strong>Expected format:</strong> "Transactional Report [Month] [Year].xlsx"
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-1 flex flex-col items-center p-4 ">
          <div className="border border-gray-300 flex flex-col items-center w-full min-h-16 p-2 bg-gray-100">
            <FolderIcon className="w-6 h-6 text-[#d5b527]" />
            <span className="text-xs mt-1">ECL_Calculation_Run_1</span>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={clsx(
            "col-span-5 relative flex flex-col w-full min-h-[50vh] p-4 bg-white rounded-md border-2 border-dashed overflow-auto border-gray-400 transition-all",
            {
              "bg-gray-100 border-blue-400": isDragActive,
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
                  {/* Excel File Icon */}
                  <div className="w-12 h-12 rounded-md flex items-center justify-center mb-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering file select
                        handleRemoveFile(file.name);
                      }}
                      className="absolute top-1 right-1 text-gray-600 hover:text-red-600"
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                    {/* Excel icon SVG omitted for brevity */}
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
              <p className="text-sm text-gray-600">
                What would you like to do?
              </p>
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
      
    </div>
  );
};

export default FileExplorer;
