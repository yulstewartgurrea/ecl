import { useEffect, useMemo, useState } from "react"; // ⬅️ add useMemo
import { TmDefaultRateAbout } from "../../../components/about/TransitionMatrixAbout";
import { useSelector } from "react-redux";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import type { RootState } from "../../../redux_toolkit/store";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";

import { useStep7ProcessedData } from "../../../hooks/useStep7ProcessedData";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcel } from "../../../services/documents";
import SkeletonTable from "../../../components/SkeletonTable";

const Step7 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

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
  console.log("step 7: ", data)

  // ⛔ filter-out (deep): remove keys anywhere in the payload
  const safeData = useMemo(() => {
    if (!data) return null;
    const DROP = new Set([
      "economic_activity_breakdown",
      "branch_breakdown",
      "monthly_income_range_breakdown",
      "age_breakdown",
    ]);

    const strip = (v: any): any => {
      if (Array.isArray(v)) return v.map(strip);
      if (v && typeof v === "object") {
        const out: any = {};
        for (const [k, val] of Object.entries(v)) {
          if (DROP.has(k)) continue; // drop these fields
          out[k] = strip(val);
        }
        return out;
      }
      return v;
    };

    return strip(data);
  }, [data]);

  // Track API status using filtered data
  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      setStatusMessage("Fetching default rate data...");
    } else if (error) {
      setStatus("error");
      setStatusMessage("Failed to fetch default rate data.");
    } else if (safeData) {
      setStatus("success");
      setStatusMessage("Default rate data loaded successfully.");
    }
  }, [isLoading, error, safeData]);

  // Download handler (use filtered)
  const handleDownload = async () => {
    if (!safeData) return;
    try {
      setStatus("loading");
      setStatusMessage("Downloading file...");
      await downloadValidRowsExcel(safeData, "default_rate", authToken); // ✅ filtered
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch {
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-6">
      <div className="max-w-[1400px] ">
        <ApiStatusIndicator status={status} message={statusMessage} onHide={() => setStatus("idle")} />

        <div className="flex items-start justify-between gap-4 b-10">
          <div>
            <div className="mb-3">
              <TmDefaultRateAbout rows={Array.isArray(safeData) ? safeData : []} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">{entity || "—"}</span>
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">{period || "—"}</span>
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">{workflowName || "—"}</span>
            </div>
          </div>

          <div className="flex justify-end items-center gap-4  pl-4">
            <button
              onClick={handleDownload}
              className="bg-white cursor-pointer border border-gray-300 px-4 py-1 rounded-lg inline-flex items-center gap-1"
              disabled={isLoading || !safeData}
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Download
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white p-4 rounded-lg border border-gray-300 mt-6">
          <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-4" />

          {!error && safeData && (
            <div>
              {isLoading ? (
                <SkeletonTable
                  title="Loading Results"
                  rows={10}
                  cols={7}
                  showHeader
                  showIndexCol
                  heightClass="max-h-[70vh]"
                />
              ) : (
                <TableTemplate1
                  data={safeData}              // ✅ filtered payload
                  format="decimal"
                  decimalPlaces={0}
                  zoomLevel={zoom}
                  setZoomLevel={setZoom}
                  enablePagination={true}
                  itemsPerPage={100}
                  showPaginationInfo={true}
                />
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 p-4">
              Failed to fetch default rate data.
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm mt-6">
          <h4 className="text-sm font-semibold text-gray-700">Notes</h4>
          <ul className="text-xs text-gray-500 mt-2 list-disc list-inside space-y-1">
            <li>
              The <span className="font-medium">Default Rate Table</span> shows
              the percentage of accounts that default over time.
            </li>
            <li>
              Use <span className="font-medium">Ctrl + Mouse Wheel</span> to adjust zoom.
            </li>
            <li>
              Data may vary depending on the selected entity, reporting period, and workflow.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Step7;
