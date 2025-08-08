import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ArrowDownTrayIcon,
  DocumentPlusIcon,
  XMarkIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import LineGraph from "../../../components/visuals/LineGraph";

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

type OdrRow = {
  Time: string; // MM/DD/YYYY
  ODR: number; // decimal value, e.g. 0.0278
};

const Step11 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [odrData, setOdrData] = useState<OdrRow[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([2021]);
  const [startMonth, setStartMonth] = useState("January");
  const [endMonth, setEndMonth] = useState("December");

  // Load saved ODR data from localStorage once on mount
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
      const odrDec = odrPct / 100;

      return { Time: `${mm}/${dd}/${yyyy}`, ODR: odrDec };
    });

    transformed.sort(
      (a, b) => new Date(a.Time).getTime() - new Date(b.Time).getTime()
    );

    setOdrData(transformed);
  }, []);

  // Toggle selection of a year in filter
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

  // Toggle all years selection
  const handleToggleAllYears = useCallback(() => {
    setSelectedYears((prev) => {
      const allSelected = YEARS.every((y) => prev.includes(y));
      return allSelected ? [Math.min(...YEARS)] : [...YEARS];
    });
  }, []);

  const isAllSelected = YEARS.every((y) => selectedYears.includes(y));

  // Filter ODR data based on selected years and months
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

  // Line graph parameters
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
                  <button
                    onClick={() => setFilterOpen(false)}
                    aria-label="Close Filter"
                  >
                    <XMarkIcon className="w-5 h-5 hover:bg-red-100 rounded" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleAllYears}
                      className="accent-gray-300"
                    />
                    {isAllSelected ? "Unselect All" : "Select All"}
                  </label>

                  {YEARS.map((year) => (
                    <label
                      key={year}
                      className="inline-flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedYears.includes(year)}
                        onChange={() => toggleYear(year)}
                        className="accent-gray-300"
                      />
                      {year}
                    </label>
                  ))}
                </div>

                {/* Month Range Selectors */}
                <div className="border-t pt-2">
                  <p className="font-medium text-xs mb-1">Start Month</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {MONTHS.map((month) => (
                      <label
                        key={month}
                        className="inline-flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={startMonth === month}
                          onChange={() => setStartMonth(month)}
                          className="accent-gray-300"
                        />
                        {month}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-2">
                  <p className="font-medium text-xs mb-1">End Month</p>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {MONTHS.map((month) => (
                      <label
                        key={month}
                        className="inline-flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={endMonth === month}
                          onChange={() => setEndMonth(month)}
                          className="accent-gray-300"
                        />
                        {month}
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
