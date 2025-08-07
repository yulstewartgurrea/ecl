import { useEffect, useState } from "react";

// components
import ZoomSlider from "../../../components/ZoomSlider";
import TableTemplate2 from "../../../components/TableTemplate2";

// redux
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";
import { useAppSelector } from "../../../redux_toolkit/hooks";

const Step9 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [migrationMatrixAverage, setMigrationMatrixAverageData] = useState<
    any[]
  >([]);
  const [get12Month, set12Month] = useState<Record<string, any[]>>({});
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

    const fetchData = async () => {
      try {
        const migrationMatrixAverage = await fetchWithAuth(
          `http://localhost:8000/documents/get-migration-matrix-average?workflow_path=${directoryPath}`
        );
        setMigrationMatrixAverageData(migrationMatrixAverage);
        const payload = {
          workflow_path: directoryPath,
          row: migrationMatrixAverage,
        };
        const get12MonthResponse = await postData(
          "http://localhost:8000/documents/migration-matrix-12months",
          payload
        );
        const groupedByMonth = get12MonthResponse.reduce(
          (acc: any, row: any) => {
            const month = row.Month;
            if (!acc[month]) acc[month] = [];
            acc[month].push(row);
            return acc;
          },
          {} as Record<string, typeof get12MonthResponse>
        );
        set12Month(groupedByMonth);
      } catch (error) {
        console.error("Error fetching matrix data:", error);
      }
    };

    fetchData();
  }, [authToken, directoryPath]);
  useEffect(() => {
    const month12Arr = get12Month["Month 12"];
    if (!Array.isArray(month12Arr)) return;

    // ① extract every 91+ DPD_4 value
    const dpd4Values = month12Arr.map((r) => r["91+ DPD_4"]);

    // ② debug to console
    console.log("Month 12 – all 91+ DPD_4 values:", dpd4Values);
    //    → [0.1749, 0.3525, 0.4021, 0.7687, 1]

    // ③ save them as JSON in localStorage
    localStorage.setItem("month12_bucket4", JSON.stringify(dpd4Values));
  }, [get12Month]);

  return (
    <div className="bg-white pr-4 py-4 rounded-lg mt-6 min-w-full max-w-full">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
      <div className=" grid grid-cols-2 gap-1 overflow-auto max-h-[750px] mt-4">
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
          {Object.keys(get12Month).map((monthKey) => (
            <div key={monthKey} className="mb-6">
              <div className="flex flex-row w-full justify-between gap-2">
                <span className="text-nowrap">{monthKey}</span>
                <TableTemplate2
                  data={get12Month[monthKey]}
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
