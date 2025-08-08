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

  if (isLoading) return <Loader />;
  if (error) return <p>Failed to fetch data</p>;

  return (
    <div className="bg-white p-4 rounded-lg mt-12">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
      <TableTemplate1 data={data} zoomLevel={zoom} setZoomLevel={setZoom} />
    </div>
  );
};

export default Step3Consolidation;
