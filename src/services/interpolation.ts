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

export type InterpolationRow = Record<string, any>;
export type Mode = "development" | "execution";

/** GET: /api/overlay/{mode}/data_interpolation/?workflow_id=... */
export async function getInterpolationDataGET(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  frequency?: "monthly" | "quarterly";
  mode: Mode;
}): Promise<ApiEnvelope<InterpolationRow[]>> {
  const { apiBase, token, workflowId, frequency, mode } = opts;
  const qs = new URLSearchParams({
    workflow_id: String(workflowId),
    ...(frequency ? { frequency } : {}),
  }).toString();
  const url = `${base(apiBase)}/api/overlay/${mode}/data_interpolation/?${qs}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  let json: ApiEnvelope<InterpolationRow[]>;
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

/** POST: /api/overlay/{mode}/data_interpolation  -> triggers generation */
export async function runInterpolationPOST(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  frequency?: "monthly" | "quarterly";
  mode: Mode;
}): Promise<ApiEnvelope<InterpolationRow[]>> {
  const { apiBase, token, workflowId, frequency, mode } = opts;

  const form = new FormData();
  form.append("workflow_id", String(workflowId));
  if (frequency) form.append("frequency", frequency);

  const url = `${base(apiBase)}/api/overlay/${mode}/data_interpolation`;
  const res = await xfetch(url, {
    method: "POST",
    headers: withAuth(token),
    body: form,
  });

  let json: ApiEnvelope<InterpolationRow[]>;
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

/** Optional: exporter helper (kept if you want to call from services) */
export async function exportInterpolationCSV(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  mode: Mode;
}): Promise<Blob> {
  const { apiBase, token, workflowId, mode } = opts;
  const url = `${base(apiBase)}/api/overlay/${mode}/data_interpolation/export/?workflow_id=${encodeURIComponent(
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

/** Keep as-is; don’t rename your display keys; only drop non-data rows & add id */
export function sanitizeInterpolationRows(rows: InterpolationRow[]): InterpolationRow[] {
  const isDataRow = (r: any) => {
    const y = r?.year;
    return typeof y === "number" || /^\d{4}$/.test(String(y));
  };

  return (rows || [])
    .filter(isDataRow)
    .map((row) => {
      const out: InterpolationRow = { ...row };
      if (!out.period_id) {
        const y = out.year ?? "";
        const m = out.month ?? "";
        const q = out.quarter ?? "";
        if (y && m) out.period_id = `${y}-${m}`;
        else if (y && q) out.period_id = `${y}-Q${q}`;
      }
      return out;
    });
}