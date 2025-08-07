import { useEffect, useState } from "react";

// components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";

import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";

const Step3 = () => {
  const [data, setData] = useState<any[]>([]);
  const [zoom, setZoom] = useState(0.9);
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);
  const directoryPath = `/${entity}/${period}/${workflowName}`;
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/documents/valid-rows?workflow_path=${directoryPath}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch data");
        }

        const result = await response.json();

        setData(result);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="bg-white p-4 rounded-lg mt-12">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
      <TableTemplate1 data={data} zoomLevel={zoom} setZoomLevel={setZoom} />
    </div>
  );
};

export default Step3;
