// dataTransformation.ts
// -------------------------------------------------------------
// Orchestrates: POST -> GET -> shape for ExeTable.
// Provides dynamic ColumnNode[] for both "transformations" tables.
//
// Usage in Step3.tsx (example):
// const shaped = await runDataTransformation({ apiBase, token, workflowId: 1 });
// <ExeTable
//   view="transformations"
//   mevData={shaped.independentRows}
//   defaultData={shaped.dependentRows}
//   mevColumns={shaped.independentColumns}
//   defaultColumns={shaped.dependentColumns}
// />
// -------------------------------------------------------------

import type { ColumnNode } from "../components/overlay/development/data_transformation/table/MacroTable";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

// ---- types --------------------------------------------------

export type ApiEnvelope<T> = {
  code: number;
  msg?: string;
  success: boolean;
  data: T;
};

export type DataTransformationResults = {
  independent_data: Array<Record<string, any>>;
  dependent_data: Array<Record<string, any>>;
  independent_columns: string[];
  dependent_columns?: string[]; // optional; some backends only return rows
};

export type DataTransformationStatus = {
  job_id: number;
  workflow_id: number;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  message: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  running_time_seconds: number | null;
  created_at: string | null;
  updated_at: string | null;
};

// The UI-ready payload for ExeTable
export type TransformedUIData = {
  independentRows: Array<Record<string, any>>;
  dependentRows: Array<Record<string, any>>;
  independentColumns: ColumnNode[];
  dependentColumns: ColumnNode[];
  consolidatedColumns?: ColumnNode[]; // optional; reserved for your other view
  meta: { workflowId: number };
};

// ---- tiny helpers -------------------------------------------

function base(apiBase: string): string {
  return apiBase.replace(/\/+$/, ""); // strip trailing slashes
}

export function withAuth(
  token?: string | null,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!(w?.__TAURI__ || w?.__TAURI_IPC__ || (navigator.userAgent || "").includes("Tauri"));
}

// makes fetch work in browser + tauri
async function xfetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauriRuntime()) {
    return (await tauriFetch(input, init as any)) as unknown as Response;
  }
  return fetch(input, init);
}

// ---- API calls ----------------------------------------------

export async function postDataTransformation(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  numCombinations?: number;
}): Promise<ApiEnvelope<unknown>> {
  const { apiBase, token, workflowId, numCombinations } = opts;

  if (!Number.isFinite(workflowId)) {
    throw new Error("workflowId must be a finite number");
  }

  // If your FastAPI endpoint expects JSON, prefer JSON.
  // If your server currently accepts form (as per your last message), keep FormData.
  const url = `${base(apiBase)}/api/overlay/development/data_transformation`;

  const form = new FormData();
  form.append("workflow_id", String(workflowId));
  if (numCombinations !== undefined && Number.isInteger(numCombinations) && numCombinations > 0) {
    form.append("num_combinations", String(numCombinations));
  }

  const res = await xfetch(url, {
    method: "POST",
    headers: withAuth(token, { Accept: "application/json" }), // don't set Content-Type for FormData
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!json?.success) throw new Error(json?.msg || "Transformation failed");
  return json;
}

export async function getDataTransformationStatus(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<DataTransformationStatus>> {
  const { apiBase, token, workflowId } = opts;

  const url = `${base(apiBase)}/api/overlay/development/data_transformation/status/${workflowId}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<DataTransformationStatus>;
  return json;
}

export async function cancelDataTransformation(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<unknown>> {
  const { apiBase, token, workflowId } = opts;

  if (!Number.isFinite(workflowId)) {
    throw new Error("workflowId must be a finite number");
  }

  const url = `${base(apiBase)}/api/overlay/development/data_transformation/cancel/`;

  const form = new FormData();
  form.append("workflow_id", String(workflowId));

  const res = await xfetch(url, {
    method: "POST",
    headers: withAuth(token, { Accept: "application/json" }), // don't set Content-Type for FormData
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!json?.success) throw new Error(json?.msg || "Failed to cancel data transformation");
  return json;
}

export async function getDataTransformationResults(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<DataTransformationResults>> {
  const { apiBase, token, workflowId } = opts;

  const qs = new URLSearchParams({ workflow_id: String(workflowId) });
  const url = `${base(apiBase)}/api/overlay/development/data_transformation_results?${qs.toString()}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<DataTransformationResults>;
  return json;
}


// ---- shaping (dynamic columns for ExeTable) -----------------

type ShapeOpts = {
  includeAllIndependent?: boolean; // default false for a compact table
  maxIndependentCols?: number; // safety cap if includeAllIndependent = true
};

export function shapeTransformationResults(
  server: DataTransformationResults,
  opts?: ShapeOpts
): TransformedUIData {
  const includeAll = !!opts?.includeAllIndependent;
  const maxCols = opts?.maxIndependentCols ?? 120;

  const independentRows = server.independent_data ?? [];
  const dependentRows = server.dependent_data ?? [];

  // ----- build Independent (MEV) columns -----
  const dateKeysPref = ["time", "Time", "year", "month (int)", "month", "quarter", "id"];
  const indepKeys = Array.from(server.independent_columns ?? []);

  const present = (keys: string[]) => keys.filter((k) => indepKeys.includes(k));

  // Date group – only the keys that actually exist in data
  const dateChildren: ColumnNode[] = present(dateKeysPref).map((k) => ({
    key: k,
    header: prettyLabel(k),
    align: k === "year" || k === "month (int)" ? "center" : "left",
    width: k === "year" ? "64px" : k === "month (int)" ? "72px" : undefined,
  }));

  const dateGroup: ColumnNode = {
    header: "Date",
    children: dateChildren.length ? dateChildren : [{ key: "time", header: "time", align: "left" }],
  };

  // The rest of independent columns
  const excludeSet = new Set(dateChildren.map((c) => String(c.key)));
  const remaining = indepKeys.filter((k) => !excludeSet.has(k));

  let metricLeaves: ColumnNode[];

  if (includeAll) {
    // Take 'remaining' as-is, but cap to avoid browser meltdown
    const take = remaining.slice(0, maxCols);
    metricLeaves = take.map((k) => ({
      key: k,
      header: prettyLabel(k),
      align: "right",
    }));
  } else {
    // Compact default: a curated subset if present
    const preferred = [
      "inflation",
      "exch_rate_index_real_yoy",
      "usd_php_eop",
      "sav_depo_rate",
      "bank_ave_lend_rate",
      "lend_rates_hi",
      "lend_rates_lo",
      "t_bill_91",
      "rrp_rate",
      "unemp_rate",
      "gdp_growth_12m",
      "gni_growth_12m",
    ].filter((k) => remaining.includes(k));

    // If backend has different casing/variants, just fall back to the first N
    const fallback = remaining.filter((k) => !preferred.includes(k)).slice(0, 12 - preferred.length);

    const picked = [...preferred, ...fallback];

    metricLeaves = picked.map((k) => ({
      key: k,
      header: prettyLabel(k),
      align: "right",
    }));
  }

  const independentColumns: ColumnNode[] = [
    dateGroup,
    {
      header: includeAll ? "MEVS (auto)" : "Key MEVs",
      children: metricLeaves,
    },
  ];

  // ----- build Dependent (ODR) columns -----
  const depSample = dependentRows[0] ?? {};
  const depKeys = server.dependent_columns ?? Object.keys(depSample ?? {});
  // prefer common date keys
  const depDateKey = ["time", "Time", "date_eom", "date", "period_id"].find((k) => depKeys.includes(k));

  const depDateGroup: ColumnNode = {
    header: "Date",
    children: depDateKey ? [{ key: depDateKey, header: prettyLabel(depDateKey), align: "left" }] : [],
  };

  const depOthers = depKeys.filter((k) => k !== depDateKey);
  // Pick common ODR keys if present; otherwise, dump all (small set expected)
  const odrPreferred = ["odr", "odr.logit", "odr_logit", "odr.log", "odr_ln"].filter((k) =>
    depOthers.includes(k)
  );
  const depPicked = odrPreferred.length ? odrPreferred : depOthers;

  const odrLeaves: ColumnNode[] = depPicked.map((k) => ({
    key: k,
    header: prettyLabel(k),
    align: "right",
  }));

  const dependentColumns: ColumnNode[] = [
    depDateGroup,
    { header: "Observed Default Rate", children: odrLeaves },
  ];

  return {
    independentRows,
    dependentRows,
    independentColumns,
    dependentColumns,
    consolidatedColumns: undefined, // reserved if you later want a consolidated view
    meta: { workflowId: -1 }, // you can fill in outside if needed
  };
}

function prettyLabel(key: string): string {
  // Keep original semantics but slightly prettier headers
  return key
    .replace(/_/g, " ")
    .replace(/\bln\b/g, "ln")
    .replace(/\.ln\b/g, ".ln")
    .replace(/\.GR\b/g, ".GR")
    .replace(/\.Level\b/g, ".Level")
    .replace(/asinh/g, "asinh")
    .replace(/diff_12/g, "diff_12")
    .replace(/lag_(\d+)/g, "lag $1")
    .replace(/\b\(int\)\b/g, "(int)");
}

// ---- Execution API calls ----------------------------------------------

export async function postDataTransformationExecution(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  numCombinations?: number;
  executionInputFile?: string | null;
  finalModelExecutionFile?: boolean;
  historicalWeightedCreditLossRateFile?: boolean;
}): Promise<ApiEnvelope<unknown>> {
  const { apiBase, token, workflowId, numCombinations, executionInputFile, finalModelExecutionFile, historicalWeightedCreditLossRateFile } = opts;

  if (!Number.isFinite(workflowId)) {
    throw new Error("workflowId must be a finite number");
  }

  const url = `${base(apiBase)}/api/overlay/execution/data_transformation/`;

  const form = new FormData();
  form.append("workflow_id", String(workflowId));
  if (numCombinations !== undefined && Number.isInteger(numCombinations) && numCombinations > 0) {
    form.append("num_combinations", String(numCombinations));
  }
  if (executionInputFile) {
    form.append("execution_input_file", executionInputFile);
  }
  if (finalModelExecutionFile) {
    form.append("final_model_execution_file", String(finalModelExecutionFile));
  }
  if (historicalWeightedCreditLossRateFile) {
    form.append("historical_weighted_credit_loss_rate_file", String(historicalWeightedCreditLossRateFile));
  }
  const res = await xfetch(url, {
    method: "POST",
    headers: withAuth(token, { Accept: "application/json" }),
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!json?.success) throw new Error(json?.msg || "Transformation failed");
  return json;
}

export async function getDataTransformationStatusExecution(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<DataTransformationStatus>> {
  const { apiBase, token, workflowId } = opts;

  const url = `${base(apiBase)}/api/overlay/execution/data_transformation/status/${workflowId}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<DataTransformationStatus>;
  return json;
}

export async function cancelDataTransformationExecution(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<unknown>> {
  const { apiBase, token, workflowId } = opts;

  if (!Number.isFinite(workflowId)) {
    throw new Error("workflowId must be a finite number");
  }

  // Using development endpoint as specified by user
  const url = `${base(apiBase)}/api/overlay/development/data_transformation/cancel/`;

  const form = new FormData();
  form.append("workflow_id", String(workflowId));

  const res = await xfetch(url, {
    method: "POST",
    headers: withAuth(token, { Accept: "application/json" }),
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!json?.success) throw new Error(json?.msg || "Failed to cancel data transformation");
  return json;
}

export async function getDataTransformationResultsExecution(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<DataTransformationResults>> {
  const { apiBase, token, workflowId } = opts;

  const qs = new URLSearchParams({ workflow_id: String(workflowId) });
  const url = `${base(apiBase)}/api/overlay/execution/data_transformation_results?${qs.toString()}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<DataTransformationResults>;
  return json;
}

export async function exportDataTransformationExecution(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  fileType?: string;
}): Promise<Blob> {
  const { apiBase, token, workflowId, fileType = "both" } = opts;

  if (!Number.isFinite(workflowId)) {
    throw new Error("workflowId must be a finite number");
  }

  const qs = new URLSearchParams({ 
    workflow_id: String(workflowId),
    file_type: fileType
  });
  const url = `${base(apiBase)}/api/overlay/execution/data_transformation/export?${qs.toString()}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/zip, application/octet-stream" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return await res.blob();
}

// ---- one-call orchestrator ----------------------------------

// services/dataTransformation.ts
export async function runDataTransformation(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  includeAllIndependent?: boolean; // default false
  maxIndependentCols?: number; // default 120
  skipPost?: boolean | undefined;
}): Promise<TransformedUIData> {
  const {
    apiBase,
    token,
    workflowId,
    includeAllIndependent = false,
    maxIndependentCols,
    skipPost = false,
  } = opts;

  if (!skipPost) {
    await postDataTransformation({ apiBase, token, workflowId });
  }

  const resEnvelope = await getDataTransformationResults({ apiBase, token, workflowId });

  if (!resEnvelope?.success || !resEnvelope?.data) {
    throw new Error(resEnvelope?.msg || "Failed to retrieve transformation results");
  }

  const shaped = shapeTransformationResults(resEnvelope.data, {
    includeAllIndependent,
    maxIndependentCols,
  });
  shaped.meta.workflowId = workflowId;
  return shaped;
}
