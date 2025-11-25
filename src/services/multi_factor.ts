// src/services/multifactor.ts
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

type HeadersMap = Record<string, string>;
const base = (u: string) => u.replace(/\/+$/, "");

const withAuth = (token?: string | null, extra: HeadersMap = {}): HeadersMap => {
  const h: HeadersMap = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

export type MultiFactorPagination = {
  current_page?: number;
  end_index?: number;
  has_next?: boolean;
  has_previous?: boolean;
  next_page?: number | null;
  page_size?: number;
  previous_page?: number | null;
  start_index?: number;
  total_items?: number;
  total_pages?: number;
};

export type MultiFactorStatus = {
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

export type ApiEnvelope<TData = unknown, TPagination = unknown> = {
  code: number;
  success: boolean;
  msg?: string;
  data: TData;
  pagination?: TPagination;
};

export type MultiFactorList =
  | { items: Record<string, unknown>[]; total?: number; page?: number; page_size?: number; pages?: number }
  | { results: Record<string, unknown>[]; total?: number; page?: number; page_size?: number; pages?: number }
  | { rows: Record<string, unknown>[]; total?: number; page?: number; page_size?: number; pages?: number }
  | Record<string, unknown>[];

function extractRowsAndMeta(
  payload: MultiFactorList
): { rows: Record<string, unknown>[]; total?: number; pages?: number } {
  if (Array.isArray(payload)) {
    return { rows: payload, total: payload.length, pages: undefined };
  }
  const anyPayload = payload as any;
  const rows =
    anyPayload.items ??
    anyPayload.results ??
    anyPayload.rows ??
    [];
  const total =
    anyPayload.total ??
    anyPayload.count ??
    (Array.isArray(rows) ? rows.length : undefined);

  const pageSize = anyPayload.page_size ?? anyPayload.limit ?? undefined;
  const pages =
    anyPayload.pages ??
    (total && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : undefined);

  return { rows, total, pages };
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
/** GET /api/overlay/development/multifactor_analysis/status/{workflow_id} to get job status */
export async function getMultiFactorStatus(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<MultiFactorStatus>> {
  const { apiBase, token, workflowId } = opts;

  const url = `${base(apiBase)}/api/overlay/development/multifactor_analysis/status/${workflowId}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiEnvelope<MultiFactorStatus>;
  return json;
}

/** POST /api/overlay/development/multifactor_analysis/cancel/ to cancel job */
export async function cancelMultiFactorAnalysis(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<unknown>> {
  const { apiBase, token, workflowId } = opts;

  if (!Number.isFinite(workflowId)) {
    throw new Error("workflowId must be a finite number");
  }

  const url = `${base(apiBase)}/api/overlay/development/multifactor_analysis/cancel/`;

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
  if (!json?.success) throw new Error(json?.msg || "Failed to cancel multifactor analysis");
  return json;
}

/** POST /api/overlay/development/multifactor_analysis/ to trigger the job */
export async function postMultiFactorTrigger(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<unknown>> {
  const { apiBase, token, workflowId } = opts;

  if (!Number.isFinite(workflowId)) {
    throw new Error("workflowId must be a finite number");
  }

  // If your FastAPI endpoint expects JSON, prefer JSON.
  // If your server currently accepts form (as per your last message), keep FormData.
  const url = `${base(apiBase)}/api/overlay/development/multifactor_analysis/`;

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
  if (!json?.success) throw new Error(json?.msg || "Transformation failed");
  return json;
}


/** GET /api/overlay/development/multifactor_analysis?... to fetch results */
export async function getMultiFactorResults(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  page: number;
  pageSize: number;
}): Promise<{
  rows: Record<string, unknown>[];
  total?: number;
  pages?: number;
  total_items?: number;
  page_size?: number;
  page?: number;
}> {
  const { apiBase, token, workflowId, page, pageSize } = opts;

  const qs = new URLSearchParams({
    workflow_id: String(workflowId),
    page: String(page),
    page_size: String(pageSize),
  }).toString();

  const url = `${base(apiBase)}/api/overlay/development/multifactor_analysis?${qs}`;
  const res = await tauriFetch(url, { method: "GET", headers: withAuth(token) });

  // 👇 tell TS that pagination is NOT the same type as data
  const json = (await res.json()) as ApiEnvelope<MultiFactorList, MultiFactorPagination>;
  if (json?.success === false) {
    throw new Error(json?.msg || `GET failed (status ${res.status})`);
  }

  const { rows, total, pages } = extractRowsAndMeta(json.data);

  // prefer explicit pagination fields from the envelope
  const total_items = json.pagination?.total_items ?? total;
  const total_pages = json.pagination?.total_pages ?? pages;
  const page_size = json.pagination?.page_size ?? pageSize;
  const current_page = json.pagination?.current_page ?? page;

  return {
    rows,
    total: total_items,
    pages: total_pages,
    total_items,
    page_size,
    page: current_page,
  };
}