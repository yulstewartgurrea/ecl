import { useState, useEffect } from "react";
import ZoomSlider from "../../../components/ZoomSlider";
import TableTemplate2 from "../../../components/TableTemplate2";

import { useSelector } from "react-redux";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import type { RootState } from "../../../redux_toolkit/store";

import { useStep9MigrationMatrix } from "../../../hooks/useStep9MigrationMatrix";

const Step9 = () => {
  const [zoom, setZoom] = useState(0.9);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const authToken = useAppSelector((state) => state.auth.token);
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const { data, error, isLoading } = useStep9MigrationMatrix(
    directoryPath || null,
    authToken || null
  );

  const { migrationMatrixAverage, matrixByMonth } = data;

  // Store Month 12 bucket 4 values in localStorage on change
  useEffect(() => {
    const month12Arr = matrixByMonth["Month 12"];
    if (!Array.isArray(month12Arr)) return;

    const dpd4Values = month12Arr.map((r) => r["91+ DPD_4"]);
    localStorage.setItem("month12_bucket4", JSON.stringify(dpd4Values));
  }, [matrixByMonth]);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error loading migration data</p>;

  return (
    <div className="bg-white pr-4 py-4 rounded-lg mt-6 min-w-full max-w-full">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
      <div className="grid grid-cols-2 gap-1 overflow-auto max-h-[750px] mt-4">
        <div className="w-full flex flex-col px-4 col-span-1">
          <h3 className="font-semibold mb-4">Average Transition Matrix</h3>
          <TableTemplate2
            data={migrationMatrixAverage}
            headersParams={[
              "Bucket",
              "0 DPD_0",
              "1-30 DPD_1",
              "31-60 DPD_2",
              "61-90 DPD_3",
              "91+ DPD_4",
              "Total",
            ]}
            format="percentage"
            decimalPlaces={2}
            zoomLevel={zoom}
            setZoomLevel={setZoom}
          />
        </div>
        <div className="w-full flex flex-col px-4 col-span-1">
          <h3 className="font-semibold mb-4">Matrix Multiplication</h3>
          {Object.keys(matrixByMonth).map((monthKey) => (
            <div key={monthKey} className="mb-6">
              <div className="flex flex-row w-full justify-between gap-2">
                <span className="text-nowrap">{monthKey}</span>
                <TableTemplate2
                  data={matrixByMonth[monthKey]}
                  headersParams={[
                    "Bucket",
                    "0 DPD_0",
                    "1-30 DPD_1",
                    "31-60 DPD_2",
                    "61-90 DPD_3",
                    "91+ DPD_4",
                    "Total",
                  ]}
                  format="percentage"
                  decimalPlaces={2}
                  zoomLevel={zoom}
                  setZoomLevel={setZoom}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Step9;
