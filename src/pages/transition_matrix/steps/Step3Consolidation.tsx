import { useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";
import { useAppSelector } from "../../../redux_toolkit/hooks";

// hooks
import { useConsolidatedRows } from "../../../hooks/useConsolidatedRows";

// components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import Loader from "../../../components/Loader";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcel } from "../../../services/documents";

const Step3Consolidation = () => {
  const [zoom, setZoom] = useState(0.9);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const authToken = useAppSelector((state) => state.auth.token);
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const { data, error, isLoading } = useConsolidatedRows(
    directoryPath,
    authToken
  );
  // 🔹 Download handler
  const handleDownload = async () => {
    if (!data) return;
    await downloadValidRowsExcel(data, "consolidate_file");
  };

  return (
    <div className="w-full min-h-screen bg-[#f3f0ea] border border-gray-300 rounded-b-md border-t-0 px-6 py-4 relative">
      {/* Loader overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f3f0ea]/50 z-10">
          <Loader />
        </div>
      )}
      <div className="flex justify-end items-center gap-4 mt-6 pl-4">
        <button
          onClick={handleDownload}
          className="bg-white cursor-pointer border border-gray-300 font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1"
        >
          <ArrowDownTrayIcon className="w-5 h-5 font-normal" />
          Download
        </button>
      </div>
      {error && <p>Failed to fetch data</p>}

      {!isLoading && !error && (
        <>
          <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
          <TableTemplate1 data={data} zoomLevel={zoom} setZoomLevel={setZoom} />
        </>
      )}
    </div>
  );
};

export default Step3Consolidation;
