// src/services/finalPitPd.ts
import { fetch } from "@tauri-apps/plugin-http";

export type FinalPitPdApiRow = {
  Bucket: string;
  "FL PiT PD Best": number;
  "FL PiT PD Base": number;
  "FL PiT PD Worst": number;
};

export type FinalPitPdApiResponse = {
  code: number;
  success: boolean;
  data?: FinalPitPdApiRow[];
  msg?: string;
};

export async function getFinalPitPd(
  workflowId: number | string,
  token: string | null
): Promise<FinalPitPdApiRow[]> {
  const url = `http://localhost:8000/api/overlay/execution/final_pit_pd/?workflow_id=${workflowId}`;

  // 👀 Logging for debugging
  console.log("[API] GET", url, "payload:", { workflowId });

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    console.error(
      "[API] GET",
      url,
      "failed with status",
      res.status
    );
    throw new Error(
      `Failed to fetch final PiT PD (status ${res.status})`
    );
  }

  const json = (await res.json()) as FinalPitPdApiResponse;
  console.log("[API] GET", url, "response:", json);

  if (!json.success || json.code !== 1) {
    throw new Error(json.msg || "final_pit_pd API returned error");
  }

  return json.data ?? [];
}