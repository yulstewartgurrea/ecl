// src/pages/overlay/execution/OverlayExecutionPage3.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { useAppSelector } from "../../../../redux_toolkit/hooks";

import ScenarioConfigModalTable, {
  type ScenarioRow,
} from "../../../../components/overlay/execution/mev/ConfigModal";
import ForecastedMEVDynamicTable from "../../../../components/overlay/execution/mev/ForecastedMEVTable";

import {
  overrideGetForcasted,
  overrideGetInput,
  overridePostForecastedMevs,
  transformForecastedMevs,
  getTransformedForecastedMevs,
  checkTransformForecastedMevs,
} from "../../../../services/overlayExecution";

import {
  Cog6ToothIcon,
  PlayCircleIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

export default function OverlayExecutionPage3() {
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);
  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const [configOpen, setConfigOpen] = useState(false);

  // values you edit/save in the modal
  const [overrideRows, setOverrideRows] = useState<ScenarioRow[] | null>(null);

  // transformed rows returned by the "Run" flow (POST+GET transform)
  const [transformedRows, setTransformedRows] = useState<ScenarioRow[] | null>(null);

  const [periods, setPeriods] = useState<string[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [prefillRows, setPrefillRows] = useState<ScenarioRow[] | null>(null);

  const [loadingCfg, setLoadingCfg] = useState(false);
  const [running, setRunning] = useState(false);

  // for Inline actions
  const [loading, setLoading] = useState(false); // Refresh (GET)
  const [exporting, setExporting] = useState(false); // Export CSV
  const [exportReady, setExportReady] = useState(false);

  const canRun = !!overrideRows && !!selectedWorkflowId;

  // normalize period outgoing (MM/DD/YYYY -> YYYY-MM-DD)
  const normalizePeriodOut = (p: string) => {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(p)) {
      const [mm, dd, yyyy] = p.split("/");
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    return p;
  };

  // 1) Load shape (periods, variables) -> calls input endpoint
  useEffect(() => {
    const boot = async () => {
      if (!selectedWorkflowId) return;
      setLoadingCfg(true);
      try {
        const { periods, variables } = await overrideGetInput(
          selectedWorkflowId,
          token
        );
        setPeriods(periods);
        setVariables(variables);
      } catch (err) {
        console.error(err);
        alert("Failed to load periods/variables for overrides.");
      } finally {
        setLoadingCfg(false);
      }
    };
    boot();
  }, [selectedWorkflowId, token]);

  // 2) Prefill modal with existing override values (if any)
  useEffect(() => {
    const boot = async () => {
      if (!selectedWorkflowId) return;
      try {
        const { rows } = await overrideGetForcasted(selectedWorkflowId, token);
        setPrefillRows(rows ?? null);
        // Also pre-populate the "last saved" rows so Run can be enabled
        if (rows?.length) {
          setOverrideRows(rows);
        }
      } catch (err) {
        console.error(err);
      }
    };
    boot();
  }, [selectedWorkflowId, token]);

  // Load transformed forecasted MEVs on page visit to check if data exists
  useEffect(() => {
    const loadTransformedData = async () => {
      if (!selectedWorkflowId) {
        setTransformedRows(null);
        return;
      }
      if (!variables.length) {
        // Wait for variables to load first
        return;
      }
      try {
        setLoading(true);
        // Always check for existing transformed data when visiting the page
        const rows = await getTransformedForecastedMevs(
          selectedWorkflowId,
          variables,
          token
        );
        setTransformedRows(rows);
      } catch (err) {
        console.error("Failed to load transformed forecasted MEVs:", err);
        // Don't show alert on initial load, just silently fail
        setTransformedRows(null);
      } finally {
        setLoading(false);
      }
    };

    void loadTransformedData();
  }, [selectedWorkflowId, variables, token]);

  const handleOpenConfig = useCallback(() => {
    if (!selectedWorkflowId) return;
    if (!periods.length || !variables.length) {
      alert("No periods/variables returned by the server.");
      return;
    }
    setConfigOpen(true);
  }, [selectedWorkflowId, periods.length, variables.length]);

  // GET transformed rows only (for Refresh / Inline actions)
  const fetchInterpolation = useCallback(async () => {
    if (!selectedWorkflowId) return;
    if (!variables.length) {
      alert("No variables found. Load configuration first.");
      return;
    }
    setLoading(true);
    try {
      const rows = await getTransformedForecastedMevs(
        selectedWorkflowId,
        variables,
        token
      );
      setTransformedRows(rows);
    } catch (err) {
      console.error(err);
      alert("Failed to load transformed forecasted MEVs.");
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId, variables, token]);

  // 3) Run flow: POST transform then GET transform, then display (manual button)
  const handleRun = useCallback(
    async () => {
      if (!selectedWorkflowId || !overrideRows) return;
      if (!variables.length) {
        return;
      }
      setRunning(true);
      setTransformedRows(null);
      try {
        // POST: perform transformation on backend
        await transformForecastedMevs(selectedWorkflowId, token);
        // GET: read transformed results
        await fetchInterpolation();
      } catch (err) {
        console.error(err);
      } finally {
        setRunning(false);
      }
    },
    [selectedWorkflowId, overrideRows, variables, token, fetchInterpolation]
  );

  // ---- NEW: Auto-sequence (no button) ----
  const autoSequenceRef = useRef(false);

  // Reset auto sequence when workflow changes
  useEffect(() => {
    autoSequenceRef.current = false;
  }, [selectedWorkflowId]);

  useEffect(() => {
    if (!selectedWorkflowId) return;
    if (!variables.length) return;
    if (!prefillRows || !prefillRows.length) return;
    if (autoSequenceRef.current) return;

    const KEY_VARS = ["lend_rates_lo", "gni_growth_12m"];

    // Step 2: check if may value ang lend_rates_lo at gni_growth_12m
    const hasImportantValues = prefillRows.some((row) =>
      KEY_VARS.some((k) => {
        const upsideVal = row.upside?.[k];
        const baseVal = row.base?.[k];
        const downsideVal = row.downside?.[k];
        return (
          (upsideVal && String(upsideVal).trim() !== "") ||
          (baseVal && String(baseVal).trim() !== "") ||
          (downsideVal && String(downsideVal).trim() !== "")
        );
      })
    );

    if (!hasImportantValues) {
      // Walang value sa lend_rates_lo / gni_growth_12m  huwag mag-POST at huwag mag-transform.
      return;
    }

    autoSequenceRef.current = true;

    (async () => {
      try {
        // 2b. May value  i-POST mo yung value (override)
        const payload = prefillRows.map((r) => ({
          period: normalizePeriodOut(r.period),
          upside: r.upside,
          base: r.base,
          downside: r.downside,
        }));

        await overridePostForecastedMevs(selectedWorkflowId, payload, token);
        setOverrideRows(prefillRows);
        setTransformedRows(null);

        // 3. Check /transform_forecasted_mevs (GET, no workflow_id)
        const rawTransformRows = await checkTransformForecastedMevs(token);
        if (!Array.isArray(rawTransformRows) || rawTransformRows.length === 0) {
          console.warn(
            "No data in /transform_forecasted_mevs, skipping auto transform."
          );
          return;
        }

        // Merong laman  call POST /transform_forecasted_mevs/?workflow_id=...
        await transformForecastedMevs(selectedWorkflowId, token);

        // Then GET transformed data for this workflow and display
        const transformed = await getTransformedForecastedMevs(
          selectedWorkflowId,
          variables,
          token
        );
        setTransformedRows(transformed);
      } catch (err) {
        console.error("Auto MEV override/transform sequence failed:", err);
      }
    })();
  }, [selectedWorkflowId, variables, prefillRows, token]);

  // Keep export flag accurate
  useEffect(() => {
    setExportReady(
      !!selectedWorkflowId &&
        !!transformedRows &&
        transformedRows.length > 0
    );
  }, [selectedWorkflowId, transformedRows]);

  // Export CSV of transformed rows (client-side)
  const exportCsv = useCallback(() => {
    if (!transformedRows || transformedRows.length === 0) return;

    setExporting(true);
    try {
      const rows = transformedRows;
      const headers = Object.keys(rows[0] as Record<string, unknown>);

      const escape = (val: unknown) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes('"') || s.includes(",") || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          headers
            .map((h) => escape((row as any)[h]))
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mev_transformed_${selectedWorkflowId ?? "export"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  }, [transformedRows, selectedWorkflowId]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Page header */}
      <header className="backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              MEV Override Forecast
            </h1>
            <p className="text-sm text-gray-600">
              Configure Best / Base / Worst per period, save, then run to generate the
              transformed table used by the next steps.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleOpenConfig}
              disabled={!selectedWorkflowId || loadingCfg}
              className="cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : "Open configuration"
              }
            >
              <Cog6ToothIcon className="h-4 w-4" />
              <span>{loadingCfg ? "Loading" : "Configuration"}</span>
            </button>

            <button
              onClick={handleRun}
              disabled={!canRun || running}
              className="cursor-pointer rounded-xl bg-gray-100 text-gray-900 border border-gray-200 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : !overrideRows
                  ? "Save configuration first"
                  : "Run transformation"
              }
            >
              <PlayCircleIcon className="h-4 w-4" />
              <span>{running ? "Running" : "Run forecasted MEVs"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto px-4 md:px-6 py-6 md:py-2">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Card header / toolbar */}
          <div className="flex flex-col gap-3 border-gray-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                {transformedRows
                  ? `${transformedRows.length.toLocaleString()} rows in transformed forecast.`
                  : overrideRows
                  ? "Overrides saved. Run the transformation to see the table."
                  : "No overrides yet. Configure and save MEV scenarios to begin."}
              </p>
            </div>

            {/* Inline actions */}
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={fetchInterpolation}
                disabled={loading || !selectedWorkflowId}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
                title={
                  !selectedWorkflowId
                    ? "Select a workflow on Step 1 first"
                    : "Refresh (GET)"
                }
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                <span>{loading ? "Refreshing" : "Refresh"}</span>
              </button>
              <button
                onClick={exportCsv}
                disabled={!exportReady || exporting || !selectedWorkflowId}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
                title={
                  !selectedWorkflowId
                    ? "Select a workflow on Step 1 first"
                    : !exportReady
                    ? "Load data first (GET)"
                    : "Download CSV"
                }
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                <span>{exporting ? "Exporting" : "Export"}</span>
              </button>
              <span className="hidden text-xs text-gray-500 md:inline">
                Sticky header
              </span>
            </div>
          </div>

          {/* Card body */}
          <div className="px-4 py-2 md:px-5 md:py-2">
            {transformedRows ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3 md:p-4">
                <div className="h-[800px] overflow-hidden rounded-xl bg-white">
                  <div className="h-full overflow-auto">
                    <ForecastedMEVDynamicTable
                      rows={transformedRows}
                      variables={variables}
                    />
                  </div>
                </div>
              </div>
            ) : overrideRows ? (
              <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-6 text-center">
                <p className="text-sm font-medium text-amber-900">
                  Overrides are saved, but the transformation hasn™t been run yet.
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Click <span className="font-semibold">Run forecasted MEVs</span> to
                  generate the transformed forecast table.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-800">
                  No MEV overrides configured yet.
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Click <span className="font-semibold">Configuration</span>, fill{" "}
                  <span className="font-semibold">Best / Base / Worst</span> per period,
                  then <span className="font-semibold">Save</span>. Afterwards hit{" "}
                  <span className="font-semibold">Run forecasted MEVs</span> to see the
                  transformed table here.
                </p>
              </div>
            )}
          </div>
        </div>

        <ScenarioConfigModalTable
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          periods={periods}
          variables={variables}
          initialRows={prefillRows ?? undefined}
          onSave={async (rows) => {
            // normalize period format for POST
            const payload = rows.map((r) => ({
              period: normalizePeriodOut(r.period),
              upside: r.upside,
              base: r.base,
              downside: r.downside,
            }));

            if (!selectedWorkflowId) return;

            try {
              await overridePostForecastedMevs(selectedWorkflowId, payload, token);
              setOverrideRows(rows); // keep the pretty version the user sees
              setTransformedRows(null); // force a fresh Run to regenerate transform
              setConfigOpen(false);

              // refresh modal prefill from server so it reopens with latest values
              const { rows: latest } = await overrideGetForcasted(
                selectedWorkflowId,
                token
              );
              setPrefillRows(latest ?? null);

              // optionally auto-run after save (manual flow still uses handleRun)
              await handleRun();
            } catch (err) {
              console.error(err);
            }
          }}
        />
      </main>
    </div>
  );
}
