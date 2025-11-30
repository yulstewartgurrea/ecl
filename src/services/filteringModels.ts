// src/services/filteringModels.ts
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/* ---------- shared helpers (same style as dataTransformation.ts) ---------- */
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

/* ----------------------------- result shaping ---------------------------- */
export type FilteringRow = Record<string, unknown>;
export type FilteringPayload =
  | FilteringRow[]
  | {
      items?: FilteringRow[];
      results?: FilteringRow[];
      rows?: FilteringRow[];
      total?: number;
      count?: number;
    };

export function extractFilteringRows(payload: FilteringPayload): {
  rows: FilteringRow[];
  total?: number;
} {
  if (Array.isArray(payload)) return { rows: payload, total: payload.length };
  const any = payload as any;
  const rows: FilteringRow[] = any.items ?? any.results ?? any.rows ?? [];
  const total = any.total ?? any.count ?? (Array.isArray(rows) ? rows.length : undefined);
  return { rows, total };
}

/* --------------------------------- POST --------------------------------- */
// POST: /api/overlay/development/filtering_models
// payload: { workload_id: "22", filter: [...] }
export type FilterRule = {
  column: string;
  value: string;
};

export async function postFilteringModels(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  filter_list?: FilterRule[];
}): Promise<ApiEnvelope<unknown>> {
  const { apiBase, token, workflowId, filter_list } = opts;
  if (!Number.isFinite(workflowId)) throw new Error("workflowId must be a finite number");

  const url = `${base(apiBase)}/api/overlay/development/filtering_models`;
  // Use FormData to send workload_id and filter array
  const form = new FormData();
  form.append("workload_id", String(workflowId));
  
  // Append filter_list array - send as JSON string
  // FastAPI expects array[dict], so we'll send it as JSON string
  if (filter_list && filter_list.length > 0) {
    // Convert filter array to JSON string
    const filterArray = filter_list.map(f => ({ column: f.column, value: f.value }));
    form.append("filter_list", JSON.stringify(filterArray));
  } else {
    // Send empty array if no filter_list
    form.append("filter_list", JSON.stringify([]));
  }

  const res = await xfetch(url, {
    method: "POST",
    headers: withAuth(token, { Accept: "application/json" }), // do NOT set Content-Type for FormData
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<unknown>;
  if (!json?.success) throw new Error(json?.msg || "Filtering POST failed");
  return json;
}

/* ---------------------------------- GET ---------------------------------- */
// GET: /api/overlay/development/filtering_models?workflow_id=22
export async function getFilteringModels(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<{ envelope: ApiEnvelope<FilteringPayload>; rows: FilteringRow[]; total?: number }> {
  const { apiBase, token, workflowId } = opts;
  const qs = new URLSearchParams({ workflow_id: String(workflowId) }).toString();
  const url = `${base(apiBase)}/api/overlay/development/filtering_models?${qs}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const envelope = (await res.json()) as ApiEnvelope<FilteringPayload>;
  const { rows, total } = extractFilteringRows(envelope.data);
  return { envelope, rows, total };
}

/* -------------------------- one-call orchestrator ------------------------- */
export async function runFilteringModels(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<{ rows: FilteringRow[]; total?: number }> {
  const { apiBase, token, workflowId } = opts;
  await postFilteringModels({ apiBase, token, workflowId });
  const { rows, total } = await getFilteringModels({ apiBase, token, workflowId });
  return { rows, total };
}