// src/services/filteringModels.ts
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
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
  pagination?: {
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
} {
  if (Array.isArray(payload)) return { rows: payload, total: payload.length };
  const any = payload as any;
  
  // Check if this is a paginated response (has pagination object)
  if (any.pagination) {
    const rows: FilteringRow[] = Array.isArray(any.data) ? any.data : [];
    return {
      rows,
      total: any.pagination.total_rows,
      pagination: any.pagination,
    };
  }
  
  // Fallback to old structure
  const rows: FilteringRow[] = any.items ?? any.results ?? any.rows ?? [];
  const total = any.total ?? any.count ?? (Array.isArray(rows) ? rows.length : undefined);
  return { rows, total };
}

export type FilterRule = {
  column: string;
  value: string;
  operator?: string;
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
  const form = new FormData();
  form.append("workload_id", String(workflowId));
  if (filter_list && filter_list.length > 0) {
    // Convert filter array to JSON string - include operator
    const filterArray = filter_list.map(f => ({ 
      column: f.column, 
      value: f.value,
      operator: f.operator || ">" // Ensure operator is always present
    }));
    form.append("filter_list", JSON.stringify(filterArray));
  } else {
    // Send empty array if no filter_list
    form.append("filter_list", JSON.stringify([]));
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
  if (!json?.success) throw new Error(json?.msg || "Filtering POST failed");
  return json;
}

/* ---------------------------------- GET ---------------------------------- */
export async function getFilteringModels(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  page?: number;
  page_size?: number;
}): Promise<{
  envelope: ApiEnvelope<FilteringPayload>;
  rows: FilteringRow[];
  total?: number;
  pagination?: {
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}> {
  const { apiBase, token, workflowId, page = 1, page_size = 100 } = opts;
  const qs = new URLSearchParams({
    workflow_id: String(workflowId),
    page: String(page),
    page_size: String(page_size),
  }).toString();
  const url = `${base(apiBase)}/api/overlay/development/filtering_models?${qs}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const envelope = (await res.json()) as ApiEnvelope<FilteringPayload> & {
    pagination?: {
      page: number;
      page_size: number;
      total_rows: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    };
  };
  const { rows, total } = extractFilteringRows(envelope.data);
  // Extract pagination from envelope level (backend returns it at root level)
  const pagination = envelope.pagination;
  return { envelope, rows, total, pagination };
}

/* -------------------------- one-call orchestrator ------------------------- */
export async function runFilteringModels(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  page?: number;
  page_size?: number;
}): Promise<{ rows: FilteringRow[]; total?: number; pagination?: any }> {
  const { apiBase, token, workflowId, page = 1, page_size = 100 } = opts;
  await postFilteringModels({ apiBase, token, workflowId });
  const { rows, total, pagination } = await getFilteringModels({ apiBase, token, workflowId, page, page_size });
  return { rows, total, pagination };
}