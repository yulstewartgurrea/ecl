import { useEffect, useState } from "react";

// components
import ZoomSlider from "../../../components/ZoomSlider";
import TransitionMatrixPercentageCountTable from "../../../components/transition_matrix_components/TransitionMatrixPercentageCountTable";
import TableTemplate2 from "../../../components/TableTemplate2";
import {
  generateTransitionMatrixDummyData,
  generateTransitionMatrixPercentageDummyData,
} from "../../../utils/CommonHelper";
// redux
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";
import { useAppSelector } from "../../../redux_toolkit/hooks";

type MigrationMatrixEntry = {
  From_Date: string;
  To_Date: string;
  From_Bucket: string;
  [key: string]: string | number;
};

type MigrationMatrixPercentageEntry = {
  [key: string]: string | number | null;
};

interface Props {
  migrationMatrix: MigrationMatrixEntry[];
  migrationMatrixPercentage: MigrationMatrixPercentageEntry[];
}

const Step8 = () => {
  const [zoom, setZoom] = useState(0.9);

  const [migrationMatrix, setMigrationMatrixData] = useState<any[]>([]);
  const [migrationMatrixPercentage, setMigrationMatrixPercentageData] =
    useState<any[]>([]);
  const [migrationMatrixAverage, setMigrationMatrixAverageData] = useState<
    any[]
  >([]);

  const authToken = useAppSelector((state) => state.auth.token);
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const directoryPath = `/${entity}/${period}/${workflowName}`;

  useEffect(() => {
    const fetchWithAuth = async (url: string) => {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error(`GET ${url} failed`);
      return response.json();
    };

    const postData = async (url: string, data: any) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`POST ${url} failed`);
      return response.json();
    };

    // Helper: Convert "YYYY-MM-DD" → "MM/DD/YYYY"
    const formatDateKey = (dateStr: string) => {
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    };

    // Helper: transform object keys for each row item
    const transformKeys = (obj: Record<string, any>) => {
      const newObj: Record<string, any> = {};
      Object.entries(obj).forEach(([key, value]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
          // e.g. "2021-01-31"
          newObj[formatDateKey(key)] = value;
        } else if (/^\d{4}-\d{2}-\d{2}_Bucket$/.test(key)) {
          // e.g. "2021-02-28_Bucket"
          const datePart = key.split("_")[0];
          newObj[formatDateKey(datePart) + "_Bucket"] = value;
        } else {
          newObj[key] = value;
        }
      });
      return newObj;
    };

    const fetchData = async () => {
      try {
        const consolidatedRows = await fetchWithAuth(
          `http://localhost:8000/documents/consolidated-rows?workflow_path=${directoryPath}`
        );

        const payload = {
          workflow_path: directoryPath,
          row: consolidatedRows,
        };

        // Step 1: Bucket DPD Everbad
        const resultEverbad = await postData(
          "http://localhost:8000/documents/bucket-dpd-everbad",
          payload
        );

        // Step 2: Migration Matrix (Count)
        const migrationMatrixData = await postData(
          "http://localhost:8000/documents/migration-matrix",
          {
            workflow_path: directoryPath,
            row: resultEverbad,
          }
        );

        setMigrationMatrixData(migrationMatrixData);

        // Step 3: Migration Matrix (Percentage)
        const migrationMatrixPercentage = await postData(
          "http://localhost:8000/documents/migration-matrix-percentage",
          {
            workflow_path: directoryPath,
            row: resultEverbad,
          }
        );

        setMigrationMatrixPercentageData(migrationMatrixPercentage);

        const flattenedRows = migrationMatrixPercentage.flat();

        const payload1 = {
          workflow_path: directoryPath,
          row: flattenedRows,
        };

        console.log("payload1:", payload1);

        // Step 4: Migration Matrix (Average)
        const migrationMatrixAverage = await postData(
          "http://localhost:8000/documents/migration-matrix-average-final",
          payload1
        );

        setMigrationMatrixAverageData(migrationMatrixAverage);
      } catch (error) {
        console.error("Error fetching matrix data:", error);
      }
    };

    fetchData();
  }, [authToken, directoryPath]);

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
                  migrationMatrix.map((data, monthIndex) => (
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
                  migrationMatrixPercentage.map((data, monthIndex) => (
                    <TransitionMatrixPercentageCountTable
                      key={`${typeIndex}-${monthIndex}`}
                      data={data}
                      format="percentage"
                      decimalPlaces={2}
                      zoomLevel={zoom}
                      setZoomLevel={setZoom}
                    />
                  ))
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
