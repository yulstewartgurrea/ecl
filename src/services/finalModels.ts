// src/services/finalModels.ts
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { ModelSpec } from "../components/overlay/development/candidate_model/ModelCompareGrid";

export type ApiEnvelope<T = unknown> = {
  code: number;
  msg?: string;
  success: boolean;
  data: T;
};

const base = (u: string) => u.replace(/\/+$/, "");

export function withAuth(
  token?: string | null,
  extra?: Record<string, string>
): Record<string, string> {
  const h: Record<string, string> = { ...(extra ?? {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!(w?.__TAURI__ || w?.__TAURI_IPC__ || (navigator.userAgent || "").includes("Tauri"));
}

async function xfetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauriRuntime()) {
    return (await tauriFetch(input, init as any)) as unknown as Response;
  }
  return fetch(input, init);
}

export async function postFinalModel(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  model: ModelSpec;                          
  payloadKey?: "final_models" | "selected_model";
  asArray?: boolean;                         
  useFormData?: boolean;                     
}): Promise<ApiEnvelope<unknown>> {
  const {
    apiBase,
    token,
    workflowId,
    model,
    payloadKey = "final_models",
  
  } = opts;

  if (!Number.isFinite(workflowId)) throw new Error("workflowId must be a finite number");

  const url = `${base(apiBase)}/api/overlay/development/final_models`;
  const value = [model]

  // multipart/form-data
  const form = new FormData();
  form.append("workflow_id", String(workflowId));
  form.append(payloadKey, JSON.stringify(value));
  console.log(form)
  const res = await xfetch(url, {
    method: "POST",
    headers: withAuth(token, { Accept: "application/json" }),
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!json?.success) throw new Error(json?.msg || "Failed to save final model");
  return json;
}