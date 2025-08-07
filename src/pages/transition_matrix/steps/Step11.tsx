import { useState, useMemo, useEffect } from "react";
import {
  ArrowDownTrayIcon,
  DocumentPlusIcon,
  XMarkIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import LineGraph from "../../../components/visuals/LineGraph";

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

type OdrCacheEntry = {
  "Observation point": string; // e.g. "2021-01-31"
  ODR: string; // e.g. "2.78%"
};

type OdrRow = {
  Time: string; // "MM/DD/YYYY"
  ODR: number; // 0.0278 (decimal)
};

const Step11 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [odrData, setOdrData] = useState<OdrRow[]>([]);

  // ① Load saved ODRs from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem("odr_by_point");
    if (!raw) return;

    let cache: OdrCacheEntry[] = [];
    try {
      cache = JSON.parse(raw);
    } catch {
      console.warn("Invalid odr_by_point in storage");
      return;
    }

    // Convert each cache entry to { Time: "MM/DD/YYYY", ODR: decimal }
    const transformed: OdrRow[] = cache.map((e) => {
      // parse "YYYY-MM-DD" into a JS Date
      const [year, month, day] = e["Observation point"].split("-").map(Number);
      const jsDate = new Date(year, month - 1, day);

      // format back to "MM/DD/YYYY"
      const mm = String(jsDate.getMonth() + 1).padStart(2, "0");
      const dd = String(jsDate.getDate()).padStart(2, "0");
      const yy = String(jsDate.getFullYear());

      // strip "%" and convert to decimal
      const odrPct = parseFloat(e.ODR.replace("%", ""));
      const odrDec = odrPct / 100;

      return { Time: `${mm}/${dd}/${yy}`, ODR: odrDec };
    });

    // sort ascending by date
    transformed.sort(
      (a, b) => new Date(a.Time).getTime() - new Date(b.Time).getTime()
    );

    setOdrData(transformed);
  }, []);

  // filter UI state
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([2021]);
  const [startMonth, setStartMonth] = useState("January");
  const [endMonth, setEndMonth] = useState("December");

  const toggleYear = (y: number) => {
    const isSelected = selectedYears.includes(y);
    let newYears = isSelected
      ? selectedYears.filter((v) => v !== y)
      : [...selectedYears, y];
    if (newYears.length === 0) newYears = [Math.min(...YEARS)];
    setSelectedYears(newYears);
  };
  const handleToggleAllYears = () => {
    const all = YEARS.every((y) => selectedYears.includes(y));
    setSelectedYears(all ? [Math.min(...YEARS)] : [...YEARS]);
  };
  const isAllSelected = YEARS.every((y) => selectedYears.includes(y));

  // ② Apply filters to your real ODR data
  const filteredData = useMemo(() => {
    if (!odrData.length) return [];

    const si = MONTHS.indexOf(startMonth);
    const ei = MONTHS.indexOf(endMonth);

    return odrData.filter(({ Time }) => {
      const [mo, da, yr] = Time.split("/").map(Number);
      const mIdx = mo - 1;
      return selectedYears.includes(yr) && mIdx >= si && mIdx <= ei;
    });
  }, [odrData, selectedYears, startMonth, endMonth]);

  // ③ Prepare graph params
  const graphParams = {
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
  };

  return (
    <div className="bg-white rounded-lg flex flex-col items-center w-full">
      <div className="w-full flex justify-end items-center gap-4 mt-6 pl-4">
        <button className="bg-[#fce404] cursor-pointer border border-gray-300 px-4 py-1 rounded-lg inline-flex items-center gap-1">
          <DocumentPlusIcon className="w-5 h-5" />
          Save Progress
        </button>
        <button className="bg-white cursor-pointer border border-gray-300 px-4 py-1 rounded-lg inline-flex items-center gap-1">
          <ArrowDownTrayIcon className="w-5 h-5" />
          Download
        </button>
      </div>

      <div className="w-full flex items-start p-4">
        <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6" />
      </div>

      <div className="grid grid-cols-3 w-full gap-12 p-4">
        {/* Table */}
        <div className="col-span-1 overflow-auto max-h-[560px] border border-gray-300 rounded hide-scrollbar">
          <TableTemplate1
            data={filteredData}
            additionalCss={{
              outerDiv: "overflow-auto max-h-[600px] min-w-full",
            }}
            format="percentage"
            decimalPlaces={2}
            zoomLevel={zoom}
            setZoomLevel={setZoom}
          />
        </div>

        {/* Filters & Graph */}
        <div className="col-span-2 flex flex-col items-start">
          <div className="relative flex items-start w-full">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className="w-24 flex items-center justify-center gap-1 bg-[#fce404] px-3 py-1 rounded-lg"
            >
              <FunnelIcon className="w-4 h-4" /> Filter
            </button>
            {filterOpen && (
              <div className="absolute top-7 left-0 mt-2 w-[360px] bg-white border border-gray-300 rounded shadow-lg z-10 p-4 space-y-2">
                {/* Year Selector */}
                <div className="flex justify-between items-center">
                  <p className="font-medium">Year</p>
                  <button onClick={() => setFilterOpen(false)}>
                    <XMarkIcon className="w-5 h-5 hover:bg-red-100 rounded" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleAllYears}
                      className="accent-gray-300"
                    />
                    {isAllSelected ? "Unselect All" : "Select All"}
                  </label>
                  {YEARS.map((y) => (
                    <label
                      key={y}
                      className="inline-flex items-center gap-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedYears.includes(y)}
                        onChange={() => toggleYear(y)}
                        className="accent-gray-300"
                      />
                      {y}
                    </label>
                  ))}
                </div>
                {/* Month Range */}
                <div className="border-t pt-2">
                  <p className="font-medium text-xs mb-1">Start Month</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {MONTHS.map((m) => (
                      <label key={m} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={startMonth === m}
                          onChange={() => setStartMonth(m)}
                          className="accent-gray-300"
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-2">
                  <p className="font-medium text-xs mb-1">End Month</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {MONTHS.map((m) => (
                      <label key={m} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={endMonth === m}
                          onChange={() => setEndMonth(m)}
                          className="accent-gray-300"
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-11/12 min-h-[500px] border border-gray-300 rounded mt-4">
            <LineGraph {...graphParams} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step11;
