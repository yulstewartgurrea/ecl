
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
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename\s*=\s*"?([^";\n]+)"?/i);
  return match ? match[1].trim() : null;
}

export type ExportFlowRateResult = { blob: Blob; filename: string };

/** Export: /api/flowrate_approach/flow_rate/export/?workflow_id=... */
export async function exportFlowRateFile(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ExportFlowRateResult> {
  const { apiBase, token, workflowId } = opts;
  const url = `${base(apiBase)}/api/flowrate_approach/flow_rate/export/?workflow_id=${encodeURIComponent(
    String(workflowId)
  )}`;
  // Use native fetch in Tauri so the binary body is read in the webview and avoid
  // plugin-http fetch_read_body/channel errors when streaming the blob back.
  const fetcher = (typeof window !== "undefined" && (window as any).__TAURI__) ? fetch : xfetch;
  const res = await fetcher(url, {
    method: "GET",
    headers: withAuth(token),
  });
  if (!res.ok) {
    let errorMsg = `Export failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.msg) errorMsg = body.msg;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) errorMsg = `Export failed: HTTP ${res.status} – ${text}`;
    }
    throw new Error(errorMsg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename = parseContentDispositionFilename(disposition) ?? "flow_rate_export.xlsx";
  return { blob, filename };
}

export type ExportCreditLossCalculationResult = { blob: Blob; filename: string };

/** Export: /api/flowrate_approach/credit_loss_calculation/export?workflow_id=... */
export async function exportCreditLossCalculationFile(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
}): Promise<ExportCreditLossCalculationResult> {
  const { apiBase, token, workflowId } = opts;
  const url = `${base(apiBase)}/api/flowrate_approach/credit_loss_calculation/export?workflow_id=${encodeURIComponent(
    String(workflowId)
  )}`;
  // Use native fetch in Tauri so the binary body is read in the webview and avoid
  // plugin-http fetch_read_body/channel errors when streaming the blob back.
  const fetcher = typeof window !== "undefined" && (window as any).__TAURI__ ? fetch : xfetch;
  const res = await fetcher(url, {
    method: "GET",
    headers: withAuth(token),
  });
  if (!res.ok) {
    let errorMsg = `Export failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.msg) errorMsg = body.msg;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) errorMsg = `Export failed: HTTP ${res.status} – ${text}`;
    }
    throw new Error(errorMsg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename =
    parseContentDispositionFilename(disposition) ?? "credit_loss_calculation_output.xlsx";
  return { blob, filename };
}

