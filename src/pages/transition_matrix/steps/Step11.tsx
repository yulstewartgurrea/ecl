import { useState, useMemo, useEffect, useCallback } from "react";
import { TmHistoricalDefaultRateAbout } from "../../../components/about/TransitionMatrixAbout";
import { ArrowDownTrayIcon, FunnelIcon } from "@heroicons/react/24/outline";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import LineGraph from "../../../components/visuals/LineGraph";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "../../../redux_toolkit/hooks";
import { resetModuleWorkflow } from "../../../redux_toolkit/features/workflow/workflowSlice";
import type { RootState } from "../../../redux_toolkit/store";
import {
  findWorkflowIdByDirectoryPath,
  updateWorkflowStatus,
} from "../../../services/workflow";

type OdrPoint = { Time: string; ODR: number };

type BreakdownRow = {
  [k: string]: any; // label fields like age | branch | economic_activity | monthly_income_range
  "Number of Good": number;
  "Number of Good that turned Bad": number;
  ODR?: string; // ignored for calc
};

type RawItem = {
  ["End of performance window"]: string;
  ODR?: string; // overall month ODR
  economic_activity_breakdown?: BreakdownRow[];
  branch_breakdown?: BreakdownRow[];
  monthly_income_range_breakdown?: BreakdownRow[];
  age_breakdown?: BreakdownRow[];
};

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

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const Step11 = () => {
  const dispatch = useAppDispatch();
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);
  const authToken = useAppSelector((state) => state.auth.token);
  const odrCache = useAppSelector(
    (state) =>
      (state as any).workflow?.modules?.transitionMatrix?.data?.odrByPoint ??
      [],
  );
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const [zoom, setZoom] = useState(0.9);

  // data
  const [rawItems, setRawItems] = useState<RawItem[]>([]);

  // dynamic years
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [startMonth, setStartMonth] = useState("January");
  const [endMonth, setEndMonth] = useState("December");

  // selections (persist independently)
  const [selIndustry, setSelIndustry] = useState<string[]>([]);
  const [selBranch, setSelBranch] = useState<string[]>([]);
  const [selIncome, setSelIncome] = useState<string[]>([]);
  const [selAge, setSelAge] = useState<string[]>([]);

  // which group drives the chart/table (last interacted with)
  const [activeGroupKey, setActiveGroupKey] = useState<
    "industry" | "branch" | "income" | "age" | null
  >(null);

  // available categories (union across months)
  const [catsIndustry, setCatsIndustry] = useState<string[]>([]);
  const [catsBranch, setCatsBranch] = useState<string[]>([]);
  const [catsIncome, setCatsIncome] = useState<string[]>([]);
  const [catsAge, setCatsAge] = useState<string[]>([]);

  // status
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const bumpWorkflowStatusByDirectoryPath = useCallback(
    async (newStatus: string) => {
      try {
        const wfId = await findWorkflowIdByDirectoryPath(
          API_BASE,
          authToken,
          directoryPath,
        );
        if (!wfId) return;
        await updateWorkflowStatus(API_BASE, wfId, newStatus, authToken);
      } catch (err) {
        console.error("Failed to update workflow status:", err);
      }
    },
    [authToken, directoryPath],
  );

  const formatMMDDYYYY = (iso: string) => {
    const [yyyy, mm, dd] = iso.split("-").map(Number);
    const d = new Date(yyyy, (mm || 1) - 1, dd || 1);
    const MMM = String(d.getMonth() + 1).padStart(2, "0");
    const D = String(d.getDate()).padStart(2, "0");
    const Y = String(d.getFullYear());
    return `${MMM}/${D}/${Y}`;
  };

  // load from Redux cache
  useEffect(() => {
    const cache = Array.isArray(odrCache) ? (odrCache as RawItem[]) : [];
    if (!cache.length) return;

    const sorted = [...cache].sort(
      (a, b) =>
        new Date(a["End of performance window"]).getTime() -
        new Date(b["End of performance window"]).getTime(),
    );

    // dynamic years from data
    const yearsSet = new Set<number>();
    sorted.forEach((e) => {
      const endWindow = e["End of performance window"];
      if (endWindow && typeof endWindow === "string") {
        const [y] = endWindow.split("-").map(Number);
        if (!Number.isNaN(y)) yearsSet.add(y);
      }
    });
    const years = Array.from(yearsSet).sort((a, b) => a - b);

    // collect category lists (union)
    const setFrom = (key: keyof RawItem, labelKey: string) => {
      const s = new Set<string>();
      for (const it of sorted) {
        const arr = (it[key] || []) as BreakdownRow[];
        arr.forEach((r) => {
          const v = r?.[labelKey];
          if (v !== undefined && v !== null && String(v).trim() !== "")
            s.add(String(v));
        });
      }
      return Array.from(s).sort((a, b) => a.localeCompare(b));
    };

    setCatsIndustry(
      setFrom("economic_activity_breakdown", "economic_activity"),
    );
    setCatsBranch(setFrom("branch_breakdown", "branch"));
    setCatsIncome(
      setFrom("monthly_income_range_breakdown", "monthly_income_range"),
    );
    setCatsAge(setFrom("age_breakdown", "age"));

    setRawItems(sorted);
    setAvailableYears(years);
    setSelectedYears(years);
    if (sorted.length > 0) bumpWorkflowStatusByDirectoryPath("Done");
  }, [bumpWorkflowStatusByDirectoryPath, odrCache]);

  // year controls
  const isAllYearsSelected = useMemo(
    () =>
      availableYears.length > 0 &&
      availableYears.every((y) => selectedYears.includes(y)),
    [availableYears, selectedYears],
  );

  const toggleYear = useCallback(
    (year: number) => {
      setSelectedYears((prev) => {
        const isSelected = prev.includes(year);
        const next = isSelected
          ? prev.filter((y) => y !== year)
          : [...prev, year];
        return next.length ? next : [Math.min(...availableYears)];
      });
    },
    [availableYears],
  );

  const handleToggleAllYears = useCallback(() => {
    setSelectedYears((prev) =>
      availableYears.every((y) => prev.includes(y))
        ? [Math.min(...availableYears)]
        : [...availableYears],
    );
  }, [availableYears]);

  // helper: choose a fallback active group if current gets cleared
  const pickFirstNonEmpty = useCallback(():
    | "industry"
    | "branch"
    | "income"
    | "age"
    | null => {
    if (selIndustry.length) return "industry";
    if (selBranch.length) return "branch";
    if (selIncome.length) return "income";
    if (selAge.length) return "age";
    return null;
  }, [selIndustry.length, selBranch.length, selIncome.length, selAge.length]);

  // toggles that DO NOT clear other groups. Active group = last interacted.
  const toggleCat = (
    value: string,
    group: "industry" | "branch" | "income" | "age",
  ) => {
    if (group === "industry") {
      setSelIndustry((prev) => {
        const next = prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value];
        // manage active group
        if (next.length) setActiveGroupKey("industry");
        else if (activeGroupKey === "industry")
          setActiveGroupKey(pickFirstNonEmpty());
        return next;
      });
    } else if (group === "branch") {
      setSelBranch((prev) => {
        const next = prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value];
        if (next.length) setActiveGroupKey("branch");
        else if (activeGroupKey === "branch")
          setActiveGroupKey(pickFirstNonEmpty());
        return next;
      });
    } else if (group === "income") {
      setSelIncome((prev) => {
        const next = prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value];
        if (next.length) setActiveGroupKey("income");
        else if (activeGroupKey === "income")
          setActiveGroupKey(pickFirstNonEmpty());
        return next;
      });
    } else {
      setSelAge((prev) => {
        const next = prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value];
        if (next.length) setActiveGroupKey("age");
        else if (activeGroupKey === "age")
          setActiveGroupKey(pickFirstNonEmpty());
        return next;
      });
    }
  };

  const toggleAllCats = (group: "industry" | "branch" | "income" | "age") => {
    const pick = (
      all: string[],
      selected: string[],
      set: (v: string[] | ((prev: string[]) => string[])) => void,
      key: "industry" | "branch" | "income" | "age",
    ) => {
      const allSelected = all.length && all.every((c) => selected.includes(c));
      const next = allSelected ? [] : [...all];
      set(next);
      if (next.length) setActiveGroupKey(key);
      else if (activeGroupKey === key) setActiveGroupKey(pickFirstNonEmpty());
    };

    if (group === "industry")
      pick(catsIndustry, selIndustry, setSelIndustry, "industry");
    else if (group === "branch")
      pick(catsBranch, selBranch, setSelBranch, "branch");
    else if (group === "income")
      pick(catsIncome, selIncome, setSelIncome, "income");
    else pick(catsAge, selAge, setSelAge, "age");
  };

  // resolve the active group -> mapping to raw keys
  const activeGroup = useMemo(() => {
    const map = {
      industry: {
        key: "economic_activity_breakdown" as const,
        labelKey: "economic_activity",
        selected: selIndustry,
      },
      branch: {
        key: "branch_breakdown" as const,
        labelKey: "branch",
        selected: selBranch,
      },
      income: {
        key: "monthly_income_range_breakdown" as const,
        labelKey: "monthly_income_range",
        selected: selIncome,
      },
      age: { key: "age_breakdown" as const, labelKey: "age", selected: selAge },
    };

    // if user cleared the active group, fall back to first non-empty
    const fallback =
      activeGroupKey ??
      (selIndustry.length
        ? "industry"
        : selBranch.length
          ? "branch"
          : selIncome.length
            ? "income"
            : selAge.length
              ? "age"
              : null);

    if (!fallback)
      return { key: undefined, labelKey: undefined, selected: [] as string[] };
    return map[fallback];
  }, [activeGroupKey, selIndustry, selBranch, selIncome, selAge]);

  // compute filtered ODR time series
  const filteredData: OdrPoint[] = useMemo(() => {
    if (!rawItems.length) return [];

    const startIdx = MONTHS.indexOf(startMonth);
    const endIdx = MONTHS.indexOf(endMonth);

    const out: OdrPoint[] = [];

    for (const item of rawItems) {
      const iso = item["End of performance window"];
      const d = new Date(iso);
      const yr = d.getFullYear();
      const monthIndex = d.getMonth();

      if (!selectedYears.includes(yr)) continue;
      if (monthIndex < startIdx || monthIndex > endIdx) continue;

      // Overall ODR (no group active)
      if (
        !activeGroup.key ||
        !activeGroup.labelKey ||
        activeGroup.selected.length === 0
      ) {
        const pct =
          typeof item.ODR === "string"
            ? parseFloat(item.ODR.replace("%", ""))
            : 0;
        const odrDecimal = Number.isFinite(pct) ? pct / 100 : 0;
        out.push({ Time: formatMMDDYYYY(iso), ODR: odrDecimal });
        continue;
      }

      // Weighted ODR for the active group's selected categories (ΣBad / ΣGood)
      const rows = (item[activeGroup.key] || []) as BreakdownRow[];
      let goodSum = 0;
      let badSum = 0;

      for (const cat of activeGroup.selected) {
        const m = rows.find((r) => String(r?.[activeGroup.labelKey!]) === cat);
        if (m) {
          goodSum += Number(m["Number of Good"]) || 0;
          badSum += Number(m["Number of Good that turned Bad"]) || 0;
        }
      }

      const odrDecimal = goodSum > 0 ? badSum / goodSum : 0;
      out.push({ Time: formatMMDDYYYY(iso), ODR: odrDecimal });
    }

    return out.sort(
      (a, b) => new Date(a.Time).getTime() - new Date(b.Time).getTime(),
    );
  }, [
    rawItems,
    selectedYears,
    startMonth,
    endMonth,
    activeGroup.key,
    activeGroup.labelKey,
    activeGroup.selected,
  ]);

  const graphParams = useMemo(
    () => ({
      xValues: filteredData.map((d) => d.Time),
      yValues: [
        {
          label:
            activeGroup.key === "economic_activity_breakdown"
              ? "ODR – Industry"
              : activeGroup.key === "branch_breakdown"
                ? "ODR – Branch"
                : activeGroup.key === "monthly_income_range_breakdown"
                  ? "ODR – Income Class"
                  : activeGroup.key === "age_breakdown"
                    ? "ODR – Age"
                    : "ODR – Overall",
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
    [filteredData, activeGroup.key],
  );

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

  // group UI block
  const Group = ({
    title,
    cats,
    selected,
    onToggle,
    onToggleAll,
    active,
  }: {
    title: string;
    cats: string[];
    selected: string[];
    onToggle: (v: string) => void;
    onToggleAll: () => void;
    active: boolean;
  }) => {
    const allSelected =
      cats.length > 0 && cats.every((c) => selected.includes(c));
    return (
      <div
        className={`rounded border ${
          active
            ? "border-indigo-300 bg-indigo-50/40"
            : "border-gray-200 bg-gray-50"
        } p-3`}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-2">
            {title}
            {active && (
              <span className="text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                Active
              </span>
            )}
          </p>
          <button
            onClick={onToggleAll}
            type="button"
            className="text-[11px] text-indigo-600 hover:underline"
          >
            {allSelected ? "Clear All" : "Select All"}
          </button>
        </div>
        <div className="max-h-40 overflow-auto rounded bg-white border border-gray-200 p-2 text-xs">
          {cats.length === 0 ? (
            <div className="text-gray-400">No categories.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {cats.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-gray-400"
                    checked={selected.includes(c)}
                    onChange={() => onToggle(c)}
                  />
                  <span title={c} className="truncate">
                    {c}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3">
              <TmHistoricalDefaultRateAbout />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Filter by year/month. Select categories in any groups. The chart
              reflects the{" "}
              <span className="font-medium">
                last group you interacted with
              </span>
              .
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

            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700">Notes</h4>
              <p className="text-xs text-gray-500 mt-2">
                We compute filtered ODR as weighted ΣBad / ΣGood using the
                selected group’s breakdown. Selections in other groups are
                preserved but don’t affect the chart until that group is the
                last interacted one.
              </p>
            </div>
          </div>

          {/* Filters + Chart */}
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
                      checked={isAllYearsSelected}
                      onChange={handleToggleAllYears}
                      className="accent-gray-400"
                    />
                    {isAllYearsSelected
                      ? "Unselect All Years"
                      : "Select All Years"}
                  </label>
                  {availableYears.map((year) => (
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
              <div className="grid grid-cols-2 gap-4 mb-4">
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
              </div>

              {/* Separated groups */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Group
                  title="Industry"
                  cats={catsIndustry}
                  selected={selIndustry}
                  onToggle={(v) => {
                    toggleCat(v, "industry");
                  }}
                  onToggleAll={() => toggleAllCats("industry")}
                  active={activeGroupKey === "industry"}
                />
                <Group
                  title="Branch"
                  cats={catsBranch}
                  selected={selBranch}
                  onToggle={(v) => {
                    toggleCat(v, "branch");
                  }}
                  onToggleAll={() => toggleAllCats("branch")}
                  active={activeGroupKey === "branch"}
                />
                <Group
                  title="Income Class"
                  cats={catsIncome}
                  selected={selIncome}
                  onToggle={(v) => {
                    toggleCat(v, "income");
                  }}
                  onToggleAll={() => toggleAllCats("income")}
                  active={activeGroupKey === "income"}
                />
                <Group
                  title="Age"
                  cats={catsAge}
                  selected={selAge}
                  onToggle={(v) => {
                    toggleCat(v, "age");
                  }}
                  onToggleAll={() => toggleAllCats("age")}
                  active={activeGroupKey === "age"}
                />
              </div>

              <div className="mt-2 text-[11px] text-gray-500">
                Tip: Selections in all groups are remembered. The chart shows
                the <span className="font-medium">last edited group</span>.
                Clear that group to fall back to others or Overall.
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

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-500">
            Choose categories in any groups. Your selections persist; the last
            group you touched controls the slice shown.
          </div>
          <button
            type="button"
            onClick={() =>
              dispatch(resetModuleWorkflow({ moduleId: "transitionMatrix" }))
            }
            className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step11;
