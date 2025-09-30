import { useMemo, useState } from "react";
import UploadDropzone from "../../../components/ui/UploadDropzone";
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon, DocumentIcon } from "@heroicons/react/24/outline";

export default function Step1() {
  const [writeOffFiles, setWriteOffFiles] = useState<File[]>([]);
  const [agingFiles, setAgingFiles] = useState<File[]>([]);
  const [collectionRateFiles, setCollectionRateFiles] = useState<File[]>([]);
  const [detailedProductFiles, setDetailedProductFiles] = useState<File[]>([]);
  const [fsBalanceFiles, setFsBalanceFiles] = useState<File[]>([]);
  const [misDataFiles, setMisDataFiles] = useState<File[]>([]);
  const [camsFiles, setCamsFiles] = useState<File[]>([]);
  const [validated, setValidated] = useState<null | "ok" | "error">(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  const validate = () => {
    const ok = agingFiles.length > 0; // At minimum, aging report is required
    setValidated(ok ? "ok" : "error");
  };
  
  const clearAll = () => {
    setWriteOffFiles([]);
    setAgingFiles([]);
    setCollectionRateFiles([]);
    setDetailedProductFiles([]);
    setFsBalanceFiles([]);
    setMisDataFiles([]);
    setCamsFiles([]);
    setValidated(null);
  };

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (writeOffFiles.length) parts.push(`${writeOffFiles.length} write-off`);
    if (agingFiles.length) parts.push(`${agingFiles.length} aging`);
    if (collectionRateFiles.length) parts.push(`${collectionRateFiles.length} collection rate`);
    if (detailedProductFiles.length) parts.push(`${detailedProductFiles.length} detailed product`);
    if (fsBalanceFiles.length) parts.push(`${fsBalanceFiles.length} FS balance`);
    if (misDataFiles.length) parts.push(`${misDataFiles.length} MIS data`);
    if (camsFiles.length) parts.push(`${camsFiles.length} CAMS`);
    return parts.join(" • ");
  }, [writeOffFiles.length, agingFiles.length, collectionRateFiles.length, detailedProductFiles.length, fsBalanceFiles.length, misDataFiles.length, camsFiles.length]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSelectedFiles = () => {
    switch (selectedCategory) {
      case "writeOff": return writeOffFiles;
      case "aging": return agingFiles;
      case "collectionRate": return collectionRateFiles;
      case "detailedProduct": return detailedProductFiles;
      case "fsBalance": return fsBalanceFiles;
      case "misData": return misDataFiles;
      case "cams": return camsFiles;
      default: return [];
    }
  };

  const getCategoryName = () => {
    switch (selectedCategory) {
      case "writeOff": return "List of Write Off Accounts";
      case "aging": return "Aging Report";
      case "collectionRate": return "Collection Rate";
      case "detailedProduct": return "Detailed by Product";
      case "fsBalance": return "FS Current Balance";
      case "misData": return "MIS Data";
      case "cams": return "Reports Generated and Extracted in CAMS";
      default: return "";
    }
  };

  const removeFile = (index: number) => {
    switch (selectedCategory) {
      case "writeOff": setWriteOffFiles(prev => prev.filter((_, i) => i !== index)); break;
      case "aging": setAgingFiles(prev => prev.filter((_, i) => i !== index)); break;
      case "collectionRate": setCollectionRateFiles(prev => prev.filter((_, i) => i !== index)); break;
      case "detailedProduct": setDetailedProductFiles(prev => prev.filter((_, i) => i !== index)); break;
      case "fsBalance": setFsBalanceFiles(prev => prev.filter((_, i) => i !== index)); break;
      case "misData": setMisDataFiles(prev => prev.filter((_, i) => i !== index)); break;
      case "cams": setCamsFiles(prev => prev.filter((_, i) => i !== index)); break;
    }
  };

  const handleFileUpload = (category: string, files: File[]) => {
    // Set the files for the specific category
    switch (category) {
      case "writeOff": setWriteOffFiles(files); break;
      case "aging": setAgingFiles(files); break;
      case "collectionRate": setCollectionRateFiles(files); break;
      case "detailedProduct": setDetailedProductFiles(files); break;
      case "fsBalance": setFsBalanceFiles(files); break;
      case "misData": setMisDataFiles(files); break;
      case "cams": setCamsFiles(files); break;
    }
    
    // Automatically switch to the uploaded category
    setSelectedCategory(category);
  };

  return (
    <div className="mx-auto max-w-8xl">
      <div className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm relative">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">Input Files</h3>
            <p className="text-xs text-gray-500">
              Upload your datasets. Accepted types: <span className="font-medium">{accept}</span>
            </p>
          </div>
          {validated === "ok" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircleIcon className="h-4 w-4" />
              Ready
            </span>
          )}
          {validated === "error" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              <ExclamationTriangleIcon className="h-4 w-4" />
              Missing required files
            </span>
          )}
        </div>

        <div className="flex p-5 gap-5">
          {/* File Viewer Box - Left Side */}
          <div className="flex-1">
            <div className="sticky top-20 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 min-h-[500px] max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="text-center">
                <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {selectedCategory ? getCategoryName() : "File Viewer"}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {selectedCategory 
                    ? `Click on upload categories to view uploaded files` 
                    : "Select a category to view uploaded files"
                  }
                </p>
                
                {selectedCategory && getSelectedFiles().length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-700 text-left mb-4">Uploaded Files:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {getSelectedFiles().map((file, index) => (
                        <div key={index} className="relative bg-white rounded-lg p-4 border hover:shadow-md transition-shadow duration-200">
                          <div className="flex flex-col items-center text-center">
                            <DocumentIcon className="h-12 w-12 text-gray-400 mb-2" />
                            <p className="text-xs font-medium text-gray-900 mb-1 break-words" title={file.name}>
                              {file.name.length > 20 ? `${file.name.substring(0, 20)}...` : file.name}
                            </p>
                            <p className="text-xs text-gray-500 mb-2">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors duration-200"
                            title="Remove file"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedCategory && getSelectedFiles().length === 0 && (
                  <div className="mt-6">
                    <p className="text-sm text-gray-500">No files uploaded for this category yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upload Categories - Right Side */}
          <div className="flex flex-col gap-5 w-80">
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "writeOff" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("writeOff")}
          >
            <UploadDropzone
              label="List of Write Off Accounts"
              description="CSV or Excel. Write-off account data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={writeOffFiles}
              onChange={(files) => handleFileUpload("writeOff", files)}
              emptyHint="Waiting for write-off files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "aging" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("aging")}
          >
            <UploadDropzone
              label="Aging Report"
              description="CSV or Excel. Upload your aging report data."
              required
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={agingFiles}
              onChange={(files) => handleFileUpload("aging", files)}
              emptyHint="Waiting for aging report file…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "collectionRate" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("collectionRate")}
          >
            <UploadDropzone
              label="Collection Rate"
              description="CSV or Excel. Collection rate data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={collectionRateFiles}
              onChange={(files) => handleFileUpload("collectionRate", files)}
              emptyHint="Waiting for collection rate files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "detailedProduct" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("detailedProduct")}
          >
            <UploadDropzone
              label="Detailed by Product"
              description="CSV or Excel. Product-specific detailed data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={detailedProductFiles}
              onChange={(files) => handleFileUpload("detailedProduct", files)}
              emptyHint="Waiting for detailed product files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "fsBalance" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("fsBalance")}
          >
            <UploadDropzone
              label="FS Current Balance"
              description="CSV or Excel. Financial statement current balance data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={fsBalanceFiles}
              onChange={(files) => handleFileUpload("fsBalance", files)}
              emptyHint="Waiting for FS balance files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "misData" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("misData")}
          >
            <UploadDropzone
              label="MIS Data"
              description="CSV or Excel. Management information system data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={misDataFiles}
              onChange={(files) => handleFileUpload("misData", files)}
              emptyHint="Waiting for MIS data files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "cams" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("cams")}
          >
            <UploadDropzone
              label="Reports Generated and Extracted in CAMS"
              description="CSV or Excel. CAMS generated reports and extracted data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={camsFiles}
              onChange={(files) => handleFileUpload("cams", files)}
              emptyHint="Waiting for CAMS files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          </div>
        </div>

      </div>
    </div>
  );
}
