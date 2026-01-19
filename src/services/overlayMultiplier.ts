// src/services/overlayMultiplier.ts

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000";

export interface OverlayMultiplierApiRow {
  Period?: string;
  report_date?: string;
  reportDate?: string;
  ODR?: number;
  odr_percent?: number;
  odr?: number;
  Best?: number;
  Base?: number;
  Worst?: number;
  best?: number;
  base?: number;
  worst?: number;
  [key: string]: any;
}

export interface PostOverlayMultiplierResponse {
  code: number;
  success: boolean;
  msg?: string;
  [key: string]: any;
}

export interface GetOverlayMultiplierResponse {
  code: number;
  success: boolean;
  data: OverlayMultiplierApiRow[] | OverlayMultiplierApiRow;
  [key: string]: any;
}

/**
 * POST /api/overlay/execution/overlay_multiplier/
 * Body: form-data with workflow_id
 */
export async function postOverlayMultiplier(
  workflowId: number | string,
  historicalWeightedCreditLossRateFile?: boolean,
  token?: string | null
): Promise<PostOverlayMultiplierResponse> {
  const url = `${API_BASE}/api/overlay/execution/overlay_multiplier/`;

  console.log("[API] POST overlay_multiplier", {
    method: "POST",
    url,
    payload: { workflow_id: workflowId },
  });

  const formData = new FormData();
  formData.append("workflow_id", String(workflowId));
  
  if (historicalWeightedCreditLossRateFile) {
    formData.append("historical_weighted_credit_loss_rate_file", String(historicalWeightedCreditLossRateFile));
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`POST overlay_multiplier failed (${res.status})`);
  }

  return res.json();
}

/**
 * GET /api/overlay/execution/overlay_multiplier/?workflow_id=...
 */
export async function getOverlayMultiplier(
  workflowId: number | string,
  token: string | null
): Promise<GetOverlayMultiplierResponse> {
  const url = `${API_BASE}/api/overlay/execution/overlay_multiplier/?workflow_id=${encodeURIComponent(
    String(workflowId)
  )}`;

  console.log("[API] GET overlay_multiplier", {
    method: "GET",
    url,
    payload: { workflow_id: workflowId },
  });

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`GET overlay_multiplier failed (${res.status})`);
  }

  return res.json();
}