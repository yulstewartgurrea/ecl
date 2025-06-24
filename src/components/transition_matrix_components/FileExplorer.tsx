import { useState, useEffect } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FolderIcon,
  ArrowUpTrayIcon,
  CloudArrowDownIcon
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useDropzone } from "react-dropzone";

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

  // Simulate loading; initial folder is empty
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setContents(importedFiles[currentPath] || []);
      setLoading(false);
    }, 300);
  }, [currentPath, importedFiles]);

  const handleFileSelect = (path: string, fileName: string) => {
    setSelectedFiles({ [path]: { fileName } });
  };

  const onDrop = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      name: file.name,
      is_folder: false,
      is_sync: true,
    }));
    setImportedFiles((prev) => ({
      ...prev,
      [currentPath]: [...(prev[currentPath] || []), ...newFiles],
    }));
  };

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: true, // disable click on dropzone to preserve manual button
  });

  return (
    <div className="space-y-4 w-full bg-gray-50 px-4 pt-4 pb-8 rounded-lg border border-gray-200">
      <div className="flex justify-between mb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              /* no-back for now */
            }}
            disabled
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-300" />
          </button>
          <button
            onClick={() => {
              /* no-forward for now */
            }}
            disabled
          >
            <ArrowRightIcon className="w-5 h-5 text-gray-300" />
          </button>
        </div>
        {/* <div className="px-4 py-2 h-10 bg-white rounded-md border border-gray-300 flex items-center">
          <span>{currentPath}</span>
        </div> */}
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
          {contents.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 w-full">
              {contents.map((file) => (
                <div
                  key={file.name}
                  className={clsx(
                    "p-3 bg-yellow-50 rounded-lg flex flex-col items-center cursor-pointer hover:bg-gray-200 transition",
                    {
                      "bg-yellow-100":
                        selectedFiles[currentPath]?.fileName === file.name,
                    }
                  )}
                  onClick={() => handleFileSelect(currentPath, file.name)}
                >
                  {/* Excel File Icon (replace with SVG or an icon if needed) */}
                  <div className="w-12 h-12  rounded-md flex items-center justify-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="60" height="60" viewBox="0 0 48 48">
                      <defs><linearGradient id="G7C1BuhajJQaEWHVlNUzHa_BEMhRoRy403e_gr1" x1="6" x2="27" y1="24" y2="24" data-name="ÐÐµÐ·ÑÐ¼ÑÐ½Ð½ÑÐ¹ Ð³ÑÐ°Ð´Ð¸ÐµÐ½Ñ 10" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21ad64"></stop><stop offset="1" stop-color="#088242"></stop></linearGradient></defs><path fill="#31c447" d="m41,10h-16v28h16c.55,0,1-.45,1-1V11c0-.55-.45-1-1-1Z"></path><path fill="#fff" d="m32,15h7v3h-7v-3Zm0,10h7v3h-7v-3Zm0,5h7v3h-7v-3Zm0-10h7v3h-7v-3Zm-7-5h5v3h-5v-3Zm0,10h5v3h-5v-3Zm0,5h5v3h-5v-3Zm0-10h5v3h-5v-3Z"></path><path fill="url(#G7C1BuhajJQaEWHVlNUzHa_BEMhRoRy403e_gr1)" d="m27,42l-21-4V10l21-4v36Z"></path><path fill="#fff" d="m19.13,31l-2.41-4.56c-.09-.17-.19-.48-.28-.94h-.04c-.05.22-.15.54-.32.98l-2.42,4.52h-3.76l4.46-7-4.08-7h3.84l2,4.2c.16.33.3.73.42,1.18h.04c.08-.27.22-.68.44-1.22l2.23-4.16h3.51l-4.2,6.94,4.32,7.06h-3.74Z"></path>
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
              {isDragActive
                ? "Drop files here to upload"
                : (
                  <div className="flex flex-col items-center justify-center pb-12">
                    <CloudArrowDownIcon className="h-24 w-24"/>
                        "No files found. Drag files here or use the button below."
                  </div>

                  )}
            </div>
          )}

          {/* Manual file select button */}
          <button
            type="button"
            onClick={open}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-yellow-300 text-gray-700 inline-flex items-center gap-2 rounded-md text-sm font-semibold cursor-pointer shadow"
          >
            <ArrowUpTrayIcon className="w-5 h-5" />
            Select a file
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
