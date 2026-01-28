// src/services/overlayExecution.ts
import type { ScenarioRow } from "../components/overlay/execution/mev/ConfigModal";

export type OverrideGetResponse = {
  periods: string[];
  variables: string[];
  default_values?: Array<Record<string, any>>;
};

export type OverrideGetForcastedResponse = {
  rows?: ScenarioRow[];
};

export type OverrideDataTransformationResponse = {
  rows?: ScenarioRow[];
  periods?: string[];
  variables?: string[];
  default_values?: Array<Record<string, any>>;
};

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string) || "http://localhost:8000";

function authHeader(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------- tiny helpers ----------
const toYMD = (p: string) => {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(p)) {
    const [mm, dd, yyyy] = p.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return p;
};

const normPct = (v: any) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.endsWith("%") ? s : `${s}%`;
};

// ---------- existing endpoints ----------
export async function overrideGetForcasted(
  workflowId: number | string,
  token?: string | null
): Promise<OverrideGetForcastedResponse> {
  const url = `${API_BASE}/api/overlay/execution/override_forecasted_mevs/?workflow_id=${workflowId}`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error(`GET input failed: ${res.status}`);
  const json = await res.json();
  const data = json?.data ?? {};
  const rows: ScenarioRow[] | undefined = Array.isArray(data)
    ? (data as ScenarioRow[])
    : undefined;
  return { rows };
}

/** GET: /override_data_transformation_mevs/?workflow_id=ID */
export async function overrideGetDataTransformationMevs(
  workflowId: number | string,
  token?: string | null
): Promise<OverrideDataTransformationResponse> {
  const url = `${API_BASE}/api/overlay/execution/override_data_transformation_mevs/?workflow_id=${workflowId}`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (res.status === 404 || res.status === 204) {
    return { rows: [], periods: [], variables: [] };
  }
  if (!res.ok) throw new Error(`GET data transformation override failed: ${res.status}`);
  const json = await res.json();
  const data = json?.data ?? {};

  const rows: ScenarioRow[] | undefined = Array.isArray(data)
    ? (data as ScenarioRow[])
    : Array.isArray(data?.rows)
    ? (data.rows as ScenarioRow[])
    : undefined;

  const periods: string[] = Array.isArray(data?.period) ? data.period : [];
  const variables: string[] = Array.isArray(data?.variables) ? data.variables : [];
  const default_values: Array<Record<string, any>> | undefined = Array.isArray(data?.default_values) 
    ? data.default_values 
    : undefined;

  return { rows, periods, variables, default_values };
}

/** GET: /override_forecasted_mevs/input/?workflow_id=ID */
export async function overrideGetInput(
  workflowId: number | string,
  token?: string | null
): Promise<OverrideGetResponse> {
  const url = `${API_BASE}/api/overlay/execution/override_forecasted_mevs/input/?workflow_id=${workflowId}`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error(`GET input failed: ${res.status}`);
  const json = await res.json();
  const data = json?.data ?? {};
  const periods: string[] = Array.isArray(data.period) ? data.period : [];
  const variables: string[] = Array.isArray(data.variables) ? data.variables : [];
  return { periods, variables };
}

/** GET: /override_data_transformation_mevs/input/?workflow_id=ID */
export async function overrideGetDataTransformationInput(
  workflowId: number | string,
  token?: string | null
): Promise<OverrideGetResponse> {
  const url = `${API_BASE}/api/overlay/execution/override_data_transformation_mevs/input/?workflow_id=${workflowId}`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error(`GET data transformation input failed: ${res.status}`);
  const json = await res.json();
  const data = json?.data ?? {};
  const periods: string[] = Array.isArray(data.period) ? data.period : [];
  const variables: string[] = Array.isArray(data.variables) ? data.variables : [];
  const default_values: Array<Record<string, any>> | undefined = Array.isArray(data?.default_values) 
    ? data.default_values 
    : undefined;
  return { periods, variables, default_values };
}

/** POST: /override_forecasted_mevs/ */
export async function overridePostForecastedMevs(
  workflowId: number | string,
  payloadRows: any,
  token?: string | null
) {
  const url = `${API_BASE}/api/overlay/execution/override_forecasted_mevs/`;
  const fd = new FormData();
  fd.append("workflow_id", String(workflowId));
  const jsonStr = JSON.stringify(payloadRows);
  fd.append("override_forecasted_mevs", jsonStr);
  fd.append("override_forecated_mevs", jsonStr); // tolerate alt spelling

  const res = await fetch(url, {
    method: "POST",
    headers: authHeader(token),
    body: fd,
  });
  if (!res.ok) throw new Error(`POST override failed: ${res.status}`);
  return res.json();
}

/** POST: /override_data_transformation_mevs/ */
export async function overridePostDataTransformationMevs(
  workflowId: number | string,
  payloadRows: any,
  token?: string | null
) {
  const url = `${API_BASE}/api/overlay/execution/override_data_transformation_mevs/`;
  const fd = new FormData();
  fd.append("workflow_id", String(workflowId));
  const jsonStr = JSON.stringify(payloadRows);
  fd.append("override_forecated_mevs", jsonStr);
  fd.append("override_data_transformation_mevs", jsonStr);

  const res = await fetch(url, {
    method: "POST",
    headers: authHeader(token),
    body: fd,
  });
  if (!res.ok) throw new Error(`POST data transformation override failed: ${res.status}`);
  return res.json();
}

/** POST: /transform_forecasted_mevs/ */
export async function transformForecastedMevs(
  workflowId: number | string,
  token?: string | null
) {
  const url = `${API_BASE}/api/overlay/execution/transform_forecasted_mevs/`;
  const fd = new FormData();
  fd.append("workflow_id", String(workflowId));

  const res = await fetch(url, {
    method: "POST",
    headers: authHeader(token),
    body: fd,
  });
  if (!res.ok) throw new Error(`POST transform failed: ${res.status}`);
  return res.json();
}

/**
 * NEW:
 * Simple "check" for /transform_forecasted_mevs/ (no workflow_id).
 * Used to see if may laman bago mag-transform.
 */
export async function checkTransformForecastedMevs(
  token?: string | null
): Promise<any[]> {
  const url = `${API_BASE}/api/overlay/execution/transform_forecasted_mevs/`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error(`GET transform check failed: ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows;
}

/** GET: /transform_forecasted_mevs/?workflow_id=ID */
export async function getTransformedForecastedMevs(
  workflowId: number | string,
  variables: string[],
  token?: string | null
): Promise<ScenarioRow[]> {
  const url = `${API_BASE}/api/overlay/execution/transform_forecasted_mevs/?workflow_id=${workflowId}`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error(`GET transform failed: ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json?.data) ? json.data : [];

  if (rows.length === 0) return [];

  // Extract variables dynamically from the first row's column names
  // Look for columns like "Upside gdp", "Base gni", "Downside gdp", etc.
  const firstRow = rows[0];
  const extractedVariables = new Set<string>();
  
  Object.keys(firstRow).forEach((colName) => {
    // Skip Period column
    if (colName.toLowerCase() === "period") return;
    
    // Extract variable name from column patterns: "Upside gdp" -> "gdp"
    // Handle different casings: "Upside", "UPSIDE", "upside", "Base", "BASE", "base", etc.
    const match = colName.match(/^(Upside|Base|Downside|UPSIDE|BASE|DOWNSIDE|upside|base|downside)\s+(.+)$/i);
    if (match && match[2]) {
      extractedVariables.add(match[2].trim());
    }
  });

  // Use extracted variables, fallback to provided variables if extraction failed
  const varsToUse = extractedVariables.size > 0 
    ? Array.from(extractedVariables).sort() 
    : variables;

  // Transform rows using extracted variables
  const out: ScenarioRow[] = rows.map((r: any) => {
    const period = toYMD(String(r["Period"] ?? r["period"] ?? ""));
    const upside: Record<string, string> = {};
    const base: Record<string, string> = {};
    const downside: Record<string, string> = {};

    varsToUse.forEach((v) => {
      // Try multiple column name variations for robustness
      const upsideVal = r[`Upside ${v}`] ?? r[`UPSIDE ${v}`] ?? r[`upside ${v}`] ?? "";
      const baseVal = r[`Base ${v}`] ?? r[`BASE ${v}`] ?? r[`base ${v}`] ?? "";
      const downsideVal = r[`Downside ${v}`] ?? r[`DOWNSIDE ${v}`] ?? r[`downside ${v}`] ?? "";
      
      upside[v] = normPct(upsideVal);
      base[v] = normPct(baseVal);
      downside[v] = normPct(downsideVal);
    });

    return { period, upside, base, downside };
  });

  return out;
}