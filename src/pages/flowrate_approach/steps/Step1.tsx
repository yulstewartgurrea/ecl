import { useMemo, useState } from "react";
import UploadDropzone from "../../../components/ui/UploadDropzone";
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon, DocumentIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";

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
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResults, setUploadResults] = useState<{[key: string]: any}>({});
  const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
  const [errorData, setErrorData] = useState<any>(null);

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
    setUploadResults({});
  };

  const getCategoryName = (category: string): string => {
    switch (category) {
      case "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS": return "List of Write Off Accounts";
      case "FLOWRATE_APPROACH_AGING_REPORT": return "Aging Report";
      case "FLOWRATE_APPROACH_COLLECTION_RATE": return "Collection Rate";
      case "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT": return "Detailed by Product";
      case "FLOWRATE_APPROACH_FS_CURRENT_BALANCE": return "FS Current Balance";
      case "FLOWRATE_APPROACH_MIS_DATA": return "MIS Data";
      case "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS": return "Reports Generated and Extracted in CAMS";
      default: return "";
    }
  };

  const uploadFiles = async () => {
    setUploading(true);
    const results: {[key: string]: any} = {};

    try {
      // Upload files for each category
      const categories = [
        { key: "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS", files: writeOffFiles },
        { key: "FLOWRATE_APPROACH_AGING_REPORT", files: agingFiles },
        { key: "FLOWRATE_APPROACH_COLLECTION_RATE", files: collectionRateFiles },
        { key: "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT", files: detailedProductFiles },
        { key: "FLOWRATE_APPROACH_FS_CURRENT_BALANCE", files: fsBalanceFiles },
        { key: "FLOWRATE_APPROACH_MIS_DATA", files: misDataFiles },
        { key: "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS", files: camsFiles }
      ];

      for (const category of categories) {
        if (category.files.length > 0) {
          results[category.key] = [];
          
          for (const file of category.files) {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('workflow_path', 'Entity 1/Monthly/wf3/input/flowrate_approach');
              formData.append('document_type', category.key);
              formData.append('workflow_id', '1');
              formData.append('override', 'false');
              formData.append('module', 'FLOWRATE_APPROACH');
              formData.append('submodule', '');

              // Console log the payload
              console.log('Upload Payload:', {
                filename: file.name,
                workflow_path: 'Entity 1/Monthly/wf3/input/flowrate_approach',
                document_type: category.key,
                workflow_id: '1',
                override: 'false',
                module: 'FLOWRATE_APPROACH',
                submodule: '',
                file_size: file.size,
                file_type: file.type
              });

              const response = await fetch('http://localhost:8000/api/document/upload', {
                method: 'POST',
                body: formData,
              });

              const result = await response.json();
              results[category.key].push({
                filename: file.name,
                success: result.success,
                data: result.data,
                msg: result.msg
              });
            } catch (error) {
              results[category.key].push({
                filename: file.name,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }
      }

      setUploadResults(results);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
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
      case "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS": return writeOffFiles;
      case "FLOWRATE_APPROACH_AGING_REPORT": return agingFiles;
      case "FLOWRATE_APPROACH_COLLECTION_RATE": return collectionRateFiles;
      case "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT": return detailedProductFiles;
      case "FLOWRATE_APPROACH_FS_CURRENT_BALANCE": return fsBalanceFiles;
      case "FLOWRATE_APPROACH_MIS_DATA": return misDataFiles;
      case "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS": return camsFiles;
      default: return [];
    }
  };

  const getSuccessfulFiles = () => {
    const uploadResultsForCategory = uploadResults[selectedCategory] || [];
    const allFiles = getSelectedFiles();
    
    // Filter files to only show successful uploads
    return allFiles.filter((file, index) => {
      const result = uploadResultsForCategory[index];
      return result && result.success;
    });
  };

  const getDisplayName = () => {
    return getCategoryName(selectedCategory);
  };

  const removeFile = (fileToRemove: File) => {
    switch (selectedCategory) {
      case "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS": setWriteOffFiles(prev => prev.filter(file => file !== fileToRemove)); break;
      case "FLOWRATE_APPROACH_AGING_REPORT": setAgingFiles(prev => prev.filter(file => file !== fileToRemove)); break;
      case "FLOWRATE_APPROACH_COLLECTION_RATE": setCollectionRateFiles(prev => prev.filter(file => file !== fileToRemove)); break;
      case "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT": setDetailedProductFiles(prev => prev.filter(file => file !== fileToRemove)); break;
      case "FLOWRATE_APPROACH_FS_CURRENT_BALANCE": setFsBalanceFiles(prev => prev.filter(file => file !== fileToRemove)); break;
      case "FLOWRATE_APPROACH_MIS_DATA": setMisDataFiles(prev => prev.filter(file => file !== fileToRemove)); break;
      case "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS": setCamsFiles(prev => prev.filter(file => file !== fileToRemove)); break;
    }
  };

  const handleFileUpload = async (category: string, files: File[]) => {
    // Set the files for the specific category
    switch (category) {
      case "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS": setWriteOffFiles(files); break;
      case "FLOWRATE_APPROACH_AGING_REPORT": setAgingFiles(files); break;
      case "FLOWRATE_APPROACH_COLLECTION_RATE": setCollectionRateFiles(files); break;
      case "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT": setDetailedProductFiles(files); break;
      case "FLOWRATE_APPROACH_FS_CURRENT_BALANCE": setFsBalanceFiles(files); break;
      case "FLOWRATE_APPROACH_MIS_DATA": setMisDataFiles(files); break;
      case "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS": setCamsFiles(files); break;
    }
    
    // Automatically switch to the uploaded category
    setSelectedCategory(category);
    
    // Upload files immediately
    if (files.length > 0) {
      await uploadSingleCategory(category, files);
    }
  };

  const forceUploadFiles = async () => {
    if (!errorData) return;
    
    // Close modal immediately for better UX
    setShowErrorModal(false);
    
    // Get the files that failed
    const failedFiles = errorData.results
      .filter((result: any) => !result.success)
      .map((result: any) => {
        // Find the original file object
        const allFiles = getSelectedFiles();
        return allFiles.find(file => file.name === result.filename);
      })
      .filter((file: any) => file !== undefined);
    
    if (failedFiles.length > 0) {
      await uploadSingleCategory(errorData.category, failedFiles, true);
    }
  };

  const uploadSingleCategory = async (category: string, files: File[], override: boolean = false) => {
    setUploading(true);
    
    try {
      const results: any[] = [];
      
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('workflow_path', 'Entity 1/Monthly/wf3/input/flowrate_approach');
          formData.append('document_type', category);
          formData.append('workflow_id', '1');
          formData.append('override', override.toString());
          formData.append('module', 'FLOWRATE_APPROACH');
          formData.append('submodule', '');

          // Console log the payload
          console.log('Upload Payload:', {
            filename: file.name,
            workflow_path: 'Entity 1/Monthly/wf3/input/flowrate_approach',
            document_type: category,
            workflow_id: '1',
            override: override.toString(),
            module: 'FLOWRATE_APPROACH',
            submodule: '',
            file_size: file.size,
            file_type: file.type
          });

          // Get auth token from localStorage or wherever you store it
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          
          const response = await fetch('http://localhost:8000/api/document/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData,
          });

          const result = await response.json();
          results.push({
            filename: file.name,
            success: result.success,
            data: result.data,
            msg: result.msg
          });
        } catch (error) {
          results.push({
            filename: file.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Update upload results for this category
      setUploadResults(prev => ({
        ...prev,
        [category]: results
      }));

      // Check if there are any errors and show modal (only if not overriding)
      const hasErrors = results.some(result => !result.success);
      if (hasErrors && !override) {
        setErrorData({
          category: category,
          results: results,
          categoryName: getCategoryName(category)
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
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
          <div className="flex items-center gap-3">
            {uploading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <ArrowUpTrayIcon className="h-4 w-4" />
                Uploading...
              </span>
            )}
            {validated === "ok" && !uploading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircleIcon className="h-4 w-4" />
                Ready
              </span>
            )}
            {validated === "error" && !uploading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Missing required files
              </span>
            )}
          </div>
        </div>

        <div className="flex p-5 gap-5">
          {/* File Viewer Box - Left Side */}
          <div className="flex-1">
            <div className="sticky top-20 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 min-h-[500px] max-h-[calc(100vh-8rem)] overflow-y-auto">
              {/* File Viewer Header */}
              <div className="flex items-center gap-3 mb-4">
                <DocumentIcon className="h-5 w-5 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900">
                  {selectedCategory 
                    ? `${getDisplayName()} (` 
                    : "File Viewer ("
                  }
                  <span className="text-gray-500">
                    {selectedCategory 
                      ? "Click on upload categories to view uploaded files)" 
                      : "Select a category to view uploaded files)"
                    }
                  </span>
                </h3>
              </div>
              
              <div className="text-center">
                
                {selectedCategory && getSuccessfulFiles().length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xs font-medium text-gray-700 text-left mb-3">Successfully Uploaded Files:</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {getSuccessfulFiles().map((file, index) => (
                        <div key={index} className="relative bg-white rounded-md p-2 border hover:shadow-sm transition-shadow duration-200">
                          <div className="flex flex-col items-center text-center">
                            <DocumentIcon className="h-6 w-6 text-gray-400 mb-1" />
                            <p className="text-xs font-medium text-gray-900 mb-1 break-words" title={file.name}>
                              {file.name.length > 15 ? `${file.name.substring(0, 15)}...` : file.name}
                            </p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          </div>
                          <button
                            onClick={() => removeFile(file)}
                            className="absolute top-1 right-1 text-red-500 hover:text-red-700 p-0.5 rounded-full hover:bg-red-50 transition-colors duration-200"
                            title="Remove file"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedCategory && getSuccessfulFiles().length === 0 && (
                  <div className="mt-6">
                    <p className="text-sm text-gray-500">No files successfully uploaded for this category yet.</p>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Upload Categories - Right Side */}
          <div className="flex flex-col gap-5 w-80">
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS")}
          >
            <UploadDropzone
              label="List of Write Off Accounts"
              description="CSV or Excel. Write-off account data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={writeOffFiles}
              onChange={(files) => handleFileUpload("FLOWRATE_APPROACH_WRITE_OFF_ACCOUNTS", files)}
              emptyHint="Waiting for write-off files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "FLOWRATE_APPROACH_AGING_REPORT" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("FLOWRATE_APPROACH_AGING_REPORT")}
          >
            <UploadDropzone
              label="Aging Report"
              description="CSV or Excel. Upload your aging report data."
              required
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={agingFiles}
              onChange={(files) => handleFileUpload("FLOWRATE_APPROACH_AGING_REPORT", files)}
              emptyHint="Waiting for aging report file…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "FLOWRATE_APPROACH_COLLECTION_RATE" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("FLOWRATE_APPROACH_COLLECTION_RATE")}
          >
            <UploadDropzone
              label="Collection Rate"
              description="CSV or Excel. Collection rate data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={collectionRateFiles}
              onChange={(files) => handleFileUpload("FLOWRATE_APPROACH_COLLECTION_RATE", files)}
              emptyHint="Waiting for collection rate files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "FLOWRATE_APPROACH_DETAILED_BY_PRODUCT" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("FLOWRATE_APPROACH_DETAILED_BY_PRODUCT")}
          >
            <UploadDropzone
              label="Detailed by Product"
              description="CSV or Excel. Product-specific detailed data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={detailedProductFiles}
              onChange={(files) => handleFileUpload("FLOWRATE_APPROACH_DETAILED_BY_PRODUCT", files)}
              emptyHint="Waiting for detailed product files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "FLOWRATE_APPROACH_FS_CURRENT_BALANCE" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("FLOWRATE_APPROACH_FS_CURRENT_BALANCE")}
          >
            <UploadDropzone
              label="FS Current Balance"
              description="CSV or Excel. Financial statement current balance data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={fsBalanceFiles}
              onChange={(files) => handleFileUpload("FLOWRATE_APPROACH_FS_CURRENT_BALANCE", files)}
              emptyHint="Waiting for FS balance files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "FLOWRATE_APPROACH_MIS_DATA" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("FLOWRATE_APPROACH_MIS_DATA")}
          >
            <UploadDropzone
              label="MIS Data"
              description="CSV or Excel. Management information system data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={misDataFiles}
              onChange={(files) => handleFileUpload("FLOWRATE_APPROACH_MIS_DATA", files)}
              emptyHint="Waiting for MIS data files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          
          <div 
            className={`cursor-pointer transition-all duration-200 ${selectedCategory === "FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS" ? "ring-2 ring-[#EA8024] ring-opacity-50" : ""}`}
            onClick={() => setSelectedCategory("FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS")}
          >
            <UploadDropzone
              label="Reports Generated and Extracted in CAMS"
              description="CSV or Excel. CAMS generated reports and extracted data."
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={3}
              value={camsFiles}
              onChange={(files) => handleFileUpload("FLOWRATE_APPROACH_REPORTS_GENERATED_EXTRACTED_CAMS", files)}
              emptyHint="Waiting for CAMS files…"
              variant="card"
              hideFileList={true}
            />
          </div>
          </div>
        </div>

      </div>

      {/* Error Modal */}
      {showErrorModal && errorData && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Upload Failed</h3>
                  <p className="text-sm text-gray-500">{errorData.categoryName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowErrorModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Error List */}
            <div className="space-y-4 mb-6">
              {errorData.results.map((result: any, index: number) => (
                !result.success && (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border-l-4 border-red-400">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-red-600">!</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 mb-1 truncate">
                          {result.filename}
                        </h4>
                        <div className="text-sm text-gray-600 space-y-2">
                          {result.error && (
                            <p className="break-words"><span className="font-medium">Error:</span> {result.error}</p>
                          )}
                          {result.msg && (
                            <p className="break-words"><span className="font-medium">Message:</span> {result.msg}</p>
                          )}
                          {result.data && (
                            <div className="mt-2">
                              <p className="font-medium text-gray-700 mb-1">Response Data:</p>
                              <div className="bg-gray-100 rounded-md p-3 text-xs font-mono text-gray-800 overflow-x-auto">
                                <pre className="whitespace-pre-wrap">{JSON.stringify(result.data, null, 2)}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>

            {/* Action */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowErrorModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={forceUploadFiles}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
              >
                Force Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
