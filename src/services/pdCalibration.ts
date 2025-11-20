// src/services/pdCalibration.ts

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000";

export interface PostPdCalibrationResponse {
  code: number;
  success: boolean;
  msg?: string;
  [key: string]: any;
}

export interface GetPdCalibrationRow {
  Bucket: string;
  Obligors: number | null;
  ttc_pd: string;
  "FL PiT PD Best": number | string;
  "FL PiT PD Base": number | string;
  "FL PiT PD Worst": number | string;
  [key: string]: any;
}

export interface GetPdCalibrationResponse {
  code: number;
  success: boolean;
  data: GetPdCalibrationRow[] | GetPdCalibrationRow;
  [key: string]: any;
}

/**
 * POST /api/overlay/execution/pd_calibration/
 * Body: form-data with workflow_id
 */
export async function postPdCalibration(
  workflowId: number | string,
  token: string | null
): Promise<PostPdCalibrationResponse> {
  const url = `${API_BASE}/api/overlay/execution/pd_calibration/`;

  console.log("[API CALL]", {
    method: "POST",
    endpoint: url,
    payload: { workflow_id: workflowId },
  });

  const formData = new FormData();
  formData.append("workflow_id", String(workflowId));

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`POST pd_calibration failed (${res.status})`);
  }

  return res.json();
}

/**
 * GET /api/overlay/execution/pd_calibration/?workflow_id=...
 */
export async function getPdCalibration(
  workflowId: number | string,
  token: string | null
): Promise<GetPdCalibrationResponse> {
  const url = `${API_BASE}/api/overlay/execution/pd_calibration/?workflow_id=${encodeURIComponent(
    String(workflowId)
  )}`;

  console.log("[API CALL]", {
    method: "GET",
    endpoint: url,
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
    throw new Error(`GET pd_calibration failed (${res.status})`);
  }

  return res.json();
}