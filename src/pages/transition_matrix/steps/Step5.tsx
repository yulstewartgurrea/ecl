import { useEffect, useState } from "react";

//components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import DpdTable from "../../../components/DpdTable";

import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";
import { useAppSelector } from "../../../redux_toolkit/hooks";

const Step5 = () => {
  const [data, setData] = useState<any[]>([]);
  const [zoom, setZoom] = useState(0.9);
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);
  const directoryPath = `/${entity}/${period}/${workflowName}`;
  const authToken = useAppSelector((state) => state.auth.token);
  useEffect(() => {
    const fetchData = async () => {
      try {
        // First fetch: consolidated rows
        const response = await fetch(
          `http://localhost:8000/documents/consolidated-rows?workflow_path=${directoryPath}`,
          {
            method: "GET", // ⬅️ Include this for clarity
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch consolidated rows");
        }

        const result = await response.json();
        const payload = {
          workflow_path: directoryPath,
          row: result,
        };
        // Second fetch: bucket the data via POST
        const response_pivot = await fetch(
          "http://localhost:8000/documents/bucket-dpd",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response_pivot.ok) {
          throw new Error("Failed to fetch pivoted data");
        }

        const result_pivot = await response_pivot.json();
        setData(result_pivot);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);
  return (
    <>
      <DpdTable />
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
    </>
  );
};

export default Step5;
