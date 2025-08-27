import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ArrowDownTrayIcon,
  DocumentPlusIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import LineGraph from "../../../components/visuals/LineGraph";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";

import { fetchOdrFromLocalStorage } from "../../../services/documents";

const YEARS = [2021, 2022, 2023, 2024, 2025];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type OdrRow = { Time: string; ODR: number };

const Step11 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [odrData, setOdrData] = useState<OdrRow[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([2021]);
  const [startMonth, setStartMonth] = useState("January");
  const [endMonth, setEndMonth] = useState("December");

  // status feedback
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  // Filter states
  const [selectedIncome, setSelectedIncome] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(false);
  const [selectedAge, setSelectedAge] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(false);

  const toggleIncome = () => setSelectedIncome((prev) => !prev);
  const toggleIndustry = () => setSelectedIndustry((prev) => !prev);
  const toggleAge = () => setSelectedAge((prev) => !prev);
  const toggleBranch = () => setSelectedBranch((prev) => !prev);

  const FILTER_FIELDS = [
    { label: "Income Class", selected: selectedIncome, toggle: toggleIncome },
    { label: "Industry", selected: selectedIndustry, toggle: toggleIndustry },
    { label: "Age", selected: selectedAge, toggle: toggleAge },
    { label: "Branch", selected: selectedBranch, toggle: toggleBranch },
  ];
  useEffect(() => {
    const cache = fetchOdrFromLocalStorage();
    if (!cache) return;

    const transformed: OdrRow[] = cache.map((e) => {
      const [year, month, day] = e["Observation point"].split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const yyyy = String(date.getFullYear());
      const odrPct = parseFloat(e.ODR.replace("%", ""));
      return { Time: `${mm}/${dd}/${yyyy}`, ODR: odrPct / 100 };
    });

    transformed.sort(
      (a, b) => new Date(a.Time).getTime() - new Date(b.Time).getTime()
    );
    setOdrData(transformed);
  }, []);

  // toggle year
  const toggleYear = useCallback((year: number) => {
    setSelectedYears((prev) => {
      const isSelected = prev.includes(year);
      let updated = isSelected
        ? prev.filter((y) => y !== year)
        : [...prev, year];
      if (updated.length === 0) updated = [Math.min(...YEARS)];
      return updated;
    });
  }, []);

  // toggle all
  const handleToggleAllYears = useCallback(() => {
    setSelectedYears((prev) =>
      YEARS.every((y) => prev.includes(y)) ? [Math.min(...YEARS)] : [...YEARS]
    );
  }, []);
  const isAllSelected = YEARS.every((y) => selectedYears.includes(y));

  // filter
  const filteredData = useMemo(() => {
    if (!odrData.length) return [];
    const startIdx = MONTHS.indexOf(startMonth);
    const endIdx = MONTHS.indexOf(endMonth);
    return odrData.filter(({ Time }) => {
      const [mo, , yr] = Time.split("/").map(Number);
      const monthIndex = mo - 1;
      return (
        selectedYears.includes(yr) &&
        monthIndex >= startIdx &&
        monthIndex <= endIdx
      );
    });
  }, [odrData, selectedYears, startMonth, endMonth]);

  // chart
  const graphParams = useMemo(
    () => ({
      xValues: filteredData.map((d) => d.Time),
      yValues: [
        {
          label: "ODR",
          data: filteredData.map((d) => d.ODR),
          borderColor: "rgba(255,205,86,1)",
          backgroundColor: "rgba(255,205,86,0.2)",
          fill: false,
          tension: 0.1,
        },
      ],
      dataLabel: "ODR",
      xAxisLabel: "Month",
      yAxisLabel: "ODR (%)",
      format: "percent" as const,
      yAxisLabelFormat: "percent" as const,
      decimalPlaces: 2,
      showGrid: true,
      showYLabels: true,
      showPointLabels: false,
      title: "Historical Default Rate",
      chartAreaBackgroundColor: "#f9fafb",
    }),
    [filteredData]
  );

  // save progress
  const handleSaveProgress = () => {
    try {
      setStatus("loading");
      setStatusMessage("Saving progress...");
      localStorage.setItem("step11_odr_saved", JSON.stringify(odrData));
      setStatus("success");
      setStatusMessage("Progress saved.");
      setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 1500);
    } catch {
      setStatus("error");
      setStatusMessage("Failed to save.");
    }
  };

  // download CSV
  const handleDownload = () => {
    try {
      setStatus("loading");
      setStatusMessage("Preparing download...");
      const headers = ["Time", "ODR"];
      const csv = [
        headers.join(","),
        ...filteredData.map((r) => `${r.Time},${r.ODR}`),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", "odr.csv");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("success");
      setStatusMessage("Download ready.");
      setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 1500);
    } catch {
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 mt-1">
              Filter by year and month range, view historical ODR trends.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ApiStatusIndicator
              status={status}
              message={statusMessage}
              onHide={() => {
                setStatus("idle");
                setStatusMessage("");
              }}
            />
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm font-medium bg-white border border-gray-300 hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Download
            </button>
          </div>
        </div>

        {/* Zoom */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="w-1/3">
            <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-full" />
          </div>
          <div className="text-sm text-gray-600">
            Zoom: <span className="font-medium">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Table + Notes */}
          <div className="col-span-2 space-y-4">
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">
                  ODR Table
                </div>
                <div className="text-xs text-gray-500">
                  {filteredData?.length ?? 0} rows
                </div>
              </div>
              <TableTemplate1
                data={filteredData}
                format="percentage"
                decimalPlaces={2}
                zoomLevel={zoom}
                setZoomLevel={setZoom}
              />
            </div>

            {/* Notes */}
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700">Notes</h4>
              <p className="text-xs text-gray-500 mt-2">
                Observed Default Rate (ODR) is the realized default percentage
                at a given observation point. You can filter by year and
                restrict months to focus analysis.
              </p>
            </div>
          </div>

          <div className="col-span-3 space-y-4">
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FunnelIcon className="w-4 h-4" /> Filters
              </h4>
              {/* Years */}
              <div className="mb-3">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleAllYears}
                      className="accent-gray-400"
                    />
                    {isAllSelected ? "Unselect All" : "Select All"}
                  </label>
                  {YEARS.map((year) => (
                    <label
                      key={year}
                      className="flex items-center gap-1 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedYears.includes(year)}
                        onChange={() => toggleYear(year)}
                        className="accent-gray-400"
                      />
                      {year}
                    </label>
                  ))}
                </div>
              </div>
              {/* Months */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium mb-1">Start Month</p>
                  <select
                    className="w-full border border-gray-300 rounded p-1 text-xs"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                  >
                    {MONTHS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">End Month</p>
                  <select
                    className="w-full border border-gray-300 rounded p-1 text-xs"
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                  >
                    {MONTHS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                {FILTER_FIELDS.map((filter) => (
                  <div key={filter.label} className="mb-3">
                    <label className="flex items-center gap-1 cursor-pointer text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={filter.selected}
                        onChange={filter.toggle}
                        className="accent-gray-400"
                      />
                      {filter.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            {/* Chart */}
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">
                  ODR Chart
                </div>
                <div className="text-xs text-gray-500">Filtered range</div>
              </div>
              <div className="w-full h-[460px]">
                <LineGraph {...graphParams} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: Use filters above to adjust year and month range for ODR
          analysis.
        </div>
      </div>
    </div>
  );
};

export default Step11;
