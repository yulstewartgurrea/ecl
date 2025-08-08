import { useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";
import { useAppSelector } from "../../../redux_toolkit/hooks";

import { usePivotedConsolidatedRows } from "../../../hooks/usePivotedConsolidatedRows";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import Loader from "../../../components/Loader";

const Step4 = () => {
  const [zoom, setZoom] = useState(0.9);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const authToken = useAppSelector((state) => state.auth.token);
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const { data, error, isLoading } = usePivotedConsolidatedRows(
    directoryPath,
    authToken
  );

  if (isLoading) return <Loader />;
  if (error) return <p>Failed to load pivoted data</p>;

  return (
    <div className="bg-white p-4 rounded-lg mt-7">
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

export default Step4;
