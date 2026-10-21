import { useEffect, useState, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";

// hooks
import { useValidRows } from "../../../hooks/useValidRows";

// components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcel } from "../../../services/documents";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import SkeletonTable from "../../../components/SkeletonTable";


const Step3 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);
  const authToken = useSelector((state: RootState) => state.auth.token);

  const directoryPath = `/${entity}/${period}/${workflowName}`;
  const { data, isLoading,  error } = useValidRows(directoryPath);
  
  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      setStatusMessage("Fetching valid rows...");
    } else if (error) {
      console.log(searchTerm)
      setStatus("error");
      setStatusMessage(
        error?.response?.status === 401
          ? "Unauthorized. Please log in again."
          : "Failed to fetch data."
      );
    } else if (data) {
      setStatus("success");
      setStatusMessage("Data loaded successfully.");
    }
  }, [isLoading, error, data]);

  const handleDownload = async () => {
    if (!data) return;
    try {
      setStatus("loading");
      setStatusMessage("Downloading file...");
      await downloadValidRowsExcel(data, "valid_file", authToken);
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch {
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  const toggleFilter = useCallback((field: string) => {
    setSelectedFilters((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }, []);

  // Memoized filtered fields based on search
  // const filteredFields = useMemo(() => {
  //   if (!searchTerm) return FILTER_FIELDS;
    
  //   return FILTER_FIELDS.filter(field =>
  //     field.toLowerCase().includes(searchTerm.toLowerCase())
  //   );
  // }, [searchTerm]);

  // Memoized filtered data
  // const filteredData = useMemo(() => {
  //   if (!data || selectedFilters.length === 0) return data || [];
    
  //   return data.filter((row: any) => {
  //     return selectedFilters.some(filter => 
  //       row[filter] !== undefined && row[filter] !== null && row[filter] !== ''
  //     );
  //   });
  // }, [data, selectedFilters]);



  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchTerm(""); // Clear search when closing
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-[1400px] mx-auto relative">
        {/* API Status Indicator */}
        <ApiStatusIndicator
          status={status}
          message={statusMessage}
          onHide={() => setStatus("idle")}
        />

        {/* Loader overlay */}
        {/* {isLoading && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
            <div className="rounded-lg bg-white p-6 shadow-lg flex items-center gap-4">
              <Loader />
              <div>
                <div className="text-sm font-medium text-gray-700">
                  Loading valid rows data
                </div>
                <div className="text-xs text-gray-500">
                  This may take a moment depending on dataset size.
                </div>
              </div>
            </div>
          </div>
        )} */}

        {/* Header */}
        <div className="mb-6">
          <div>
            <p className="text-sm text-gray-500 mt-1">
              Average and month-by-month transition matrices.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">
                {entity || "—"}
              </span>
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">
                {period || "—"}
              </span>
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">
                {workflowName || "—"}
              </span>
            </div>
          </div>
        </div>


        {/* Error */}
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-4">
            Failed to fetch data.
          </div>
        )}



        {/* Content */}
        { !error && (
          <div className="bg-[#f3f0ea] w-full min-h-screen border border-gray-300 rounded-b-md border-t-0 px-6 py-4 relative">
            {/* Taskbar inside the card */}
            <div className="flex gap-2 my-4 flex-wrap justify-between items-center">
              {/* Left: Filter Controls and Zoom */}
              <div className="flex gap-4 flex-wrap items-center">
                {/* <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 bg-gray-200 text-gray-800 hover:bg-[#ad8a49] hover:text-white transition-colors"
                  >
                    <FunnelIcon className="w-4 h-4" />
                    {selectedFilters.length > 0 
                      ? `${selectedFilters.length} filter${selectedFilters.length > 1 ? 's' : ''} selected`
                      : 'Select Filters'
                    }
                    <span className={`ml-1 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {/* {isDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[300px] max-h-64 overflow-hidden">
                    
                      <div className="p-3 border-b border-gray-100">
                        <input
                          type="text"
                          placeholder="Search filters..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      
                      Filter List 
                      <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        {filteredFields.length > 0 ? (
                          filteredFields.map((field) => (
                        <div
                          key={field}
                          onClick={() => toggleFilter(field)}
                          className={`
                            px-4 py-2 cursor-pointer hover:bg-gray-100 text-xs border-b border-gray-100 last:border-b border-gray-100-0
                            ${selectedFilters.includes(field) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="accent-blue-500"
                              checked={selectedFilters.includes(field)}
                              readOnly
                            />
                              {field}
                            </div>
                          </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            No filters found matching "{searchTerm}"
                          </div>
                        )}
                      </div>
                    </div>
                  )} 
                </div> */}

                {/* Zoom Control */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-sm font-medium">Zoom:</span>
                  <ZoomSlider 
                    zoom={zoom} 
                    setZoom={setZoom} 
                    className="w-32" 
                  />
                  <span className="text-xs text-gray-500 min-w-[3rem]">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
                
                {/* Selected Filters Display */}
                {selectedFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedFilters.map((filter) => (
                      <span
                        key={filter}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-[#ad8a49] text-white text-xs rounded-full"
                      >
                        {filter}
                        <button
                          onClick={() => toggleFilter(filter)}
                          className="ml-1 text-white hover:text-gray-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => setSelectedFilters([])}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Download Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="bg-white cursor-pointer border border-gray-300 px-4 py-1 rounded-lg inline-flex items-center gap-1"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="mt-6">
              {isLoading ? (
                <SkeletonTable
                  title="Loading Results"
                  rows={10}
                  cols={7}
                  showHeader
                  showIndexCol
                  heightClass="max-h-[70vh]"
                />
              ) : (
                <TableTemplate1
                  data={data}
                  zoomLevel={zoom}
                  setZoomLevel={setZoom}
                  enablePagination={true}
                  itemsPerPage={100}
                  showPaginationInfo={true}
                />
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step3;

