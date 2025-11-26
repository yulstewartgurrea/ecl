// Robust fetch: use @tauri-apps/plugin-http if available, else window.fetch
let tauriFetchRef: any;
async function xfetch(input: string, init?: RequestInit): Promise<Response> {
  if (!tauriFetchRef) {
    try {
      const mod = await import("@tauri-apps/plugin-http");
      tauriFetchRef = mod.fetch;
    } catch {
      tauriFetchRef = null;
    }
  }
  if (tauriFetchRef) {
    return (await tauriFetchRef(input, init as any)) as unknown as Response;
  }
  return fetch(input, init);
}

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

export type FlowRateData = Record<string, any>;

/** GET: /api/flowrate_approach/flow_rate/?workflow_id=... */
export async function getFlowRateDataGET(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<FlowRateData>> {
  const { apiBase, token, workflowId } = opts;
  const qs = new URLSearchParams({
    workflow_id: String(workflowId),
  }).toString();
  const url = `${base(apiBase)}/api/flowrate_approach/flow_rate/?${qs}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  let json: ApiEnvelope<FlowRateData>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status})`);
  }
  if (!res.ok || json?.success !== true) {
    throw new Error(json?.msg || `HTTP ${res.status}`);
  }
  return json;
}

/** POST: /api/flowrate_approach/flow_rate  -> triggers generation */
export async function runFlowRatePOST(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ApiEnvelope<FlowRateData>> {
  const { apiBase, token, workflowId } = opts;

  console.log("runFlowRatePOST - workflowId:", workflowId, "Type:", typeof workflowId);
  
  if (!workflowId || workflowId <= 0 || isNaN(workflowId)) {
    throw new Error(`Invalid workflowId: ${workflowId}`);
  }

  const form = new FormData();
  form.append("workflow_id", String(workflowId));

  const url = `${base(apiBase)}/api/flowrate_approach/flow_rate`;
  console.log("runFlowRatePOST - URL:", url);
  console.log("runFlowRatePOST - FormData workflow_id:", form.get("workflow_id"));
  
  const res = await xfetch(url, {
    method: "POST",
    headers: withAuth(token),
    body: form,
  });

  let json: ApiEnvelope<FlowRateData>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status})`);
  }
  if (!res.ok || json?.success !== true) {
    throw new Error(json?.msg || `HTTP ${res.status}`);
  }
  return json;
}

/** Export: /api/flowrate_approach/flow_rate/export/?workflow_id=... */
export async function exportFlowRateFile(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<Blob> {
  const { apiBase, token, workflowId } = opts;
  const url = `${base(apiBase)}/api/flowrate_approach/flow_rate/export/?workflow_id=${encodeURIComponent(
    String(workflowId)
  )}`;
  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Export failed: HTTP ${res.status}${text ? ` – ${text}` : ""}`);
  }
  return await res.blob();
}

