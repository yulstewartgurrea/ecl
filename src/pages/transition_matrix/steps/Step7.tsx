import { useState } from "react";
import { useSelector } from "react-redux";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import type { RootState } from "../../../redux_toolkit/store";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";

import { useStep7ProcessedData } from "../../../hooks/useStep7ProcessedData";

const Step7 = () => {
  const [zoom, setZoom] = useState(0.9);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const authToken = useAppSelector((state) => state.auth.token);
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const { data, error, isLoading } = useStep7ProcessedData(
    directoryPath || null,
    authToken || null
  );

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error loading data</p>;

  return (
    <div className="bg-white p-4 rounded-lg mt-12">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
      <TableTemplate1
        data={data}
        format="decimal"
        decimalPlaces={0}
        zoomLevel={zoom}
        setZoomLevel={setZoom}
      />
    </div>
  );
};

export default Step7;
