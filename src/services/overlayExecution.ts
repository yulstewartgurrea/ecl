// src/services/overlayExecution.ts
import type { ScenarioRow } from "../components/overlay/execution/mev/ConfigModal";

export type OverrideGetResponse = {
  periods: string[];
  variables: string[];
};

export type OverrideGetForcastedResponse = {
  rows?: ScenarioRow[];
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

const makeBlank = (vars: string[]) =>
  vars.reduce<Record<string, string>>((acc, k) => ((acc[k] = ""), acc), {});

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

  const out: ScenarioRow[] = rows.map((r: any) => {
    const period = toYMD(String(r["Period"] ?? r["period"] ?? ""));
    const upside = makeBlank(variables);
    const base = makeBlank(variables);
    const downside = makeBlank(variables);

    variables.forEach((v) => {
      // tolerate different casings/spaces
      upside[v] = normPct(r[`Upside ${v}`] ?? r[`UPSIDE ${v}`] ?? r[`upside ${v}`] ?? "");
      base[v] = normPct(r[`Base ${v}`] ?? r[`BASE ${v}`] ?? r[`base ${v}`] ?? "");
      downside[v] = normPct(
        r[`Downside ${v}`] ?? r[`DOWNSIDE ${v}`] ?? r[`downside ${v}`] ?? ""
      );
    });

    return { period, upside, base, downside };
  });

  return out;
}