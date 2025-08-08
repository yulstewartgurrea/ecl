import { useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";

// hooks
import { useValidRows } from "../../../hooks/useValidRows";

// components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import Loader from "../../../components/Loader";

const Step3 = () => {
  const [zoom, setZoom] = useState(0.9);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const { data, isLoading, error } = useValidRows(directoryPath);

  return (
    <div className="bg-white p-4 rounded-lg mt-12">
      {isLoading && <Loader />}
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

export default Step3;
