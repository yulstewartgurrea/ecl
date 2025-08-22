import { useState, useEffect } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FolderIcon,
  ArrowUpTrayIcon,
  CloudArrowDownIcon,
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
        setStatus("success");
        setStatusMessage("Files loaded successfully");
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

  const onDrop = async (acceptedFiles: File[]) => {
    if (!entity || !period || !workflowName) {
      console.error("Missing workflow data from Redux state");
      return;
    }

    const workflow_path = `/${entity}/${period}/${workflowName}`;

    try {
      // Prepare payload for backend document creation API
      const filesPayload = acceptedFiles.map((file) => ({
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
        acceptedFiles.map(async (file) => {
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
      const newFiles = acceptedFiles.map((file) => ({
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

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: true,
  });
  const handleRemoveFile = (fileName: string) => {
    setContents((prev) => prev.filter((file) => file.name !== fileName));
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
    </div>
  );
};

export default FileExplorer;
