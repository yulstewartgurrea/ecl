// src/services/workflow.ts
import { fetch as tFetch } from "@tauri-apps/plugin-http";

export type ApiEnvelope<T> = { code: number; success: boolean; data: T; msg?: string | null };

export type Workflow = {
  id: number;
  name?: string | null;
  workflow_name?: string | null;
  directory_path?: string | null;
  workflow_path?: string | null;
  path?: string | null;
  entity?: string | null;
  reporting_period?: string | null;
  reportingPeriod?: string | null;
  [k: string]: any;
};

type HeadersMap = Record<string, string>;
const withAuth = (token?: string | null, extra: HeadersMap = {}): HeadersMap => {
  const h: HeadersMap = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};
const base = (url: string) => url.replace(/\/+$/, "");

// ---- Params/Types ----
export type CheckWorkflowParams = {
  apiBase: string;
  token?: string | null;
  entity: string;
  reportingPeriod: string;
  workflowName: string;
};

export type CreateWorkflowParams = {
  apiBase: string;
  token?: string | null;
  payload: {
    entity: string;
    workflow_name: string;
    reporting_period: string;
    baseline_year?: string;
    loan_product?: string;
    report_date_start?: string;
    workflow_type?: string; // e.g. "ecl"
  };
};

export type WorkflowRecord = {
  id: number;
  entity: string;
  workflow_name: string;
  reporting_period: string;
  [k: string]: unknown;
};

export type ApiEnvelope1<T = unknown> = {
  code?: number;
  success?: boolean;
  msg?: string;
  data?: T;
};

// Thrown when check says the workflow already exists and caller didn’t allow overwrite
export class WorkflowAlreadyExistsError extends Error {
  constructor(message = "Workflow already exists") {
    super(message);
    this.name = "WorkflowAlreadyExistsError";
  }
}

const qs = (obj: Record<string, string>) => new URLSearchParams(obj).toString();

/** GET /documents/workflows/check?... → { exists: boolean } */
export async function checkWorkflowExists({
  apiBase,
  token,
  entity,
  reportingPeriod,
  workflowName,
}: CheckWorkflowParams): Promise<{ exists: boolean } & Record<string, unknown>> {
  const url = `${apiBase.replace(/\/$/, "")}/documents/workflows/check?${qs({
    entity,
    reporting_period: reportingPeriod,
    workflow_name: workflowName,
  })}`;

  const res = await tFetch(url, {
    method: "GET",
    headers: { ...withAuth(token) },
  });

  const data = (await res.json()) as any;

  if (!res.ok) {
    const detail = data?.detail ?? data?.msg ?? `HTTP ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  // Some backends wrap in an envelope; others return plain JSON
  if (data && typeof data === "object" && "data" in data && "success" in data) {
    return (data.data ?? {}) as any;
  }
  return data as any;
}

/** POST /workflows/ → envelope with created workflow in `data` */
export async function createWorkflow({
  apiBase,
  token,
  payload,
}: CreateWorkflowParams): Promise<WorkflowRecord> {
  const url = `${apiBase.replace(/\/$/, "")}/workflows/`;

  const res = await tFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...withAuth(token),
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as any;

  if (!res.ok) {
    const detail = data?.detail ?? data?.msg ?? `HTTP ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  // Some APIs return { data: {...} }, others return the record directly
  if (data && typeof data === "object" && "data" in data && data.data) {
    return data.data as WorkflowRecord;
  }
  return data as WorkflowRecord;
}

/** Check first, then create if allowed; throws WorkflowAlreadyExistsError otherwise. */
export async function createOrUpdateWorkflow(
  params: CheckWorkflowParams & {
    proceedWithUpdate?: boolean;
    baselineYear?: string;
    loanProduct?: string;
    reportDateStart?: string;
    workflowType?: string;
  }
): Promise<WorkflowRecord> {
  const {
    apiBase,
    token,
    entity,
    reportingPeriod,
    workflowName,
    proceedWithUpdate = false,
    baselineYear,
    loanProduct,
    reportDateStart,
    workflowType = "ecl",
  } = params;

  const check = await checkWorkflowExists({
    apiBase,
    token,
    entity,
    reportingPeriod,
    workflowName,
  });

  if (check?.exists && !proceedWithUpdate) {
    throw new WorkflowAlreadyExistsError(
      "This workflow already exists. Set `proceedWithUpdate: true` to continue."
    );
  }

  return createWorkflow({
    apiBase,
    token,
    payload: {
      entity,
      workflow_name: workflowName,
      reporting_period: reportingPeriod,
      baseline_year: baselineYear,
      loan_product: loanProduct,
      report_date_start: reportDateStart,
      workflow_type: workflowType,
    },
  });
}

/* ---------------- convenience helpers for listing/updating ---------------- */

async function getJson<T>(res: any): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const detail = (data && (data.detail || data.msg)) || `HTTP ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export async function listWorkflows(apiBase: string, token?: string | null) {
  const res = await tFetch(`${base(apiBase)}/workflows/`, {
    method: "GET",
    headers: withAuth(token),
  });
  return getJson<ApiEnvelope<Workflow[]>>(res);
}

export async function getWorkflowById(apiBase: string, id: number, token?: string | null) {
  const res = await tFetch(`${base(apiBase)}/workflows/${id}`, {
    method: "GET",
    headers: withAuth(token),
  });
  return getJson<ApiEnvelope<Workflow>>(res);
}

export async function updateWorkflow(apiBase: string, id: number, payload: Record<string, any>, token?: string | null) {
  const res = await tFetch(`${base(apiBase)}/workflows/${id}`, {
    method: "PUT",
    headers: withAuth(token, { "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify(payload),
  });
  return getJson<ApiEnvelope<Workflow>>(res);
}

export async function updateWorkflowStatus(apiBase: string, id: number, newStatus: string, token?: string | null) {
  const cur = await getWorkflowById(apiBase, id, token);
  const payload = { ...cur.data, status: newStatus };
  return updateWorkflow(apiBase, id, payload, token);
}

/* ---------------- directoryPath matching helpers ---------------- */
function normalizePath(p?: string | null): string {
  if (!p) return "";
  let s = p.trim().replace(/\\/g, "/");
  s = s.replace(/\/{2,}/g, "/");
  s = s.replace(/\/+$/, "");
  if (!s.startsWith("/")) s = "/" + s;
  return s;
}
function stripInputOverlaySuffix(p: string): string {
  const lowered = p.toLowerCase();
  const suffixes = [
    "/input/overlay/development",
    "/overlay/development",
    "/module/development",
  ];
  for (const suf of suffixes) {
    if (lowered.endsWith(suf)) return p.slice(0, p.length - suf.length);
  }
  return p;
}
function candidateWorkflowPath(w: Workflow): string | null {
  const fields = [w.directory_path, w.workflow_path, w.path].filter(Boolean) as string[];
  if (fields.length) return fields[0];
  const nm = w.name ?? w.workflow_name ?? "";
  const rp = (w.reporting_period ?? w.reportingPeriod ?? "") as string;
  const ent = (w.entity ?? "") as string;
  if (ent && rp && nm) return `/${ent}/${rp}/${nm}`;
  return null;
}

/** Find workflow id by comparing normalized base directoryPath */
export async function findWorkflowIdByDirectoryPath(
  apiBase: string,
  token: string | null | undefined,
  directoryPath: string
): Promise<number | null> {
  const targetBase = stripInputOverlaySuffix(normalizePath(directoryPath));
  const list = await listWorkflows(apiBase, token);
  for (const w of list.data) {
    const cand = candidateWorkflowPath(w);
    if (!cand) continue;
    const candBase = stripInputOverlaySuffix(normalizePath(cand));
    if (candBase === targetBase) return w.id;
  }
  return null;
}