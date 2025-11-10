// src/services/interpolation.ts
import { fetch } from "@tauri-apps/plugin-http";

type HeadersMap = Record<string, string>;
const base = (u: string) => u.replace(/\/+$/, "");
const withAuth = (token?: string | null, extra: HeadersMap = {}): HeadersMap => {
  const h: HeadersMap = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

export type ApiEnvelope<T> = {
  code: number;
  success: boolean;
  msg?: string;
  data: T;
};

export type InterpolationRow = Record<string, any>;

/**
 * POST multipart/form-data to /api/overlay/development/data_interpolation
 * body:
 *   workflow_id: number (text)
 *   frequency?: "monthly" | "quarterly" (text)  // optional
 */
export async function getInterpolationData(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  frequency?: "monthly" | "quarterly";
}): Promise<ApiEnvelope<InterpolationRow[]>> {
  const { apiBase, token, workflowId, frequency } = opts;

  const form = new FormData();
  form.append("workflow_id", String(workflowId));
  if (frequency) form.append("frequency", frequency);

  const url = `${base(apiBase)}/api/overlay/development/data_interpolation`;
  const res = await fetch(url, {
    method: "POST",
    headers: withAuth(token), // don't set Content-Type; FormData sets boundary
    body: form,
  });

  let json: ApiEnvelope<InterpolationRow[]>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status})`);
  }
  if (!res.ok || !json?.success) {
    throw new Error(json?.msg || `HTTP ${res.status}`);
  }
  return json;
}

/** Drop meta rows and normalize a few keys so your table columns match. */
export function sanitizeInterpolationRows(rows: InterpolationRow[]): InterpolationRow[] {
  const isDataRow = (r: any) => {
    const y = r?.year;
    return typeof y === "number" || /^\d{4}$/.test(String(y));
  };

  const keyMap: Record<string, string> = {
    gni_gdp_elec_steam_gas: "gni_gdp_elec_steam_g",
    gni_gdp_constr: "gni_gdp_const",
    gni_gdp_wholesale_ret: "gni_gdp_wholesale_retl",
  };

  return (rows || [])
    .filter(isDataRow)
    .map((row) => {
      const out: InterpolationRow = {};
      for (const [k, v] of Object.entries(row)) out[keyMap[k] ?? k] = v;
      if (!out.period_id) {
        const y = out.year ?? "";
        const m = out.month ?? "";
        const q = out.quarter ?? "";
        if (y && m) out.period_id = `${y}-${m}`;
        else if (y && q) out.period_id = `${y}-Q${q}`;
      }
      return out;
    });
}