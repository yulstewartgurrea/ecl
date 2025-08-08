import { useState } from "react";
import ZoomSlider from "../../../components/ZoomSlider";
import TransitionMatrixPercentageCountTable from "../../../components/transition_matrix_components/TransitionMatrixPercentageCountTable";
import TableTemplate2 from "../../../components/TableTemplate2";

import { useSelector } from "react-redux";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import type { RootState } from "../../../redux_toolkit/store";

import { useStep8MigrationData } from "../../../hooks/useStep8MigrationData";

const Step8 = () => {
  const [zoom, setZoom] = useState(0.9);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const authToken = useAppSelector((state) => state.auth.token);
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const { data, error, isLoading } = useStep8MigrationData(
    directoryPath || null,
    authToken || null
  );

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error loading migration data</p>;

  const {
    migrationMatrixData,
    migrationMatrixPercentage,
    migrationMatrixAverage,
  } = data;

  return (
    <div className="flex flex-col w-full mt-6">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-1" />
      <div className="px-4 py-1 min-w-full min-h-full overflow-auto">
        <div className="w-full flex flex-row space-x-16">
          {[
            "Transition Matrix - Count",
            "Transition Matrix - Percentage",
            "Average Transition Matrix",
          ].map((title, typeIndex) => (
            <div key={typeIndex}>
              <div className="w-full flex flex-row justify-start items-center space-x-12">
                <h1 className="text-xl font-bold mb-4">{typeIndex + 1}</h1>
                <h1 className="text-xl font-bold mb-4">{title}</h1>
              </div>
              <div className="w-full flex flex-col space-y-4">
                {typeIndex === 0 ? (
                  migrationMatrixData.map((data: any, monthIndex: any) => (
                    <TransitionMatrixPercentageCountTable
                      key={`${typeIndex}-${monthIndex}`}
                      data={data}
                      format="number"
                      decimalPlaces={0}
                      zoomLevel={zoom}
                      setZoomLevel={setZoom}
                    />
                  ))
                ) : typeIndex === 1 ? (
                  migrationMatrixPercentage.map(
                    (data: any, monthIndex: any) => (
                      <TransitionMatrixPercentageCountTable
                        key={`${typeIndex}-${monthIndex}`}
                        data={data}
                        format="percentage"
                        decimalPlaces={2}
                        zoomLevel={zoom}
                        setZoomLevel={setZoom}
                      />
                    )
                  )
                ) : (
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
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Step8;
