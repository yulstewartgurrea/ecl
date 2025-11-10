// src/services/candidateModels.ts
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { ModelSpec } from "../components/overlay/development/candidate_model/ModelCompareGrid";

/* ---------- shared helpers ---------- */
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

/* ---------- shaping utilities ---------- */
type ServerModel = Record<string, unknown>;
type ServerList =
  | ServerModel[]
  | {
      items?: ServerModel[];
      results?: ServerModel[];
      rows?: ServerModel[];
      data?: ServerModel[];   // some APIs nest again
      total?: number;
      count?: number;
      pages?: number;
      page?: number;
      page_size?: number;
      limit?: number;
    };

function coerceNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pick<T = any>(obj: any, keys: string[], fallback?: any): T | undefined {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k] as T;
  }
  return fallback;
}

function extractListAndMeta(payload: any): {
  list: ServerModel[];
  total?: number;
  pages?: number;
} {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
    ? payload.data
    : payload?.items ?? payload?.results ?? payload?.rows ?? [];

  const total = payload?.total ?? payload?.count ?? (Array.isArray(list) ? list.length : undefined);
  const size = payload?.page_size ?? payload?.limit;
  const pages = payload?.pages ?? (total && size ? Math.max(1, Math.ceil(total / size)) : undefined);

  return { list, total, pages };
}

function shapeOne(server: ServerModel, idx: number): ModelSpec {
  // Always use "Candidate Model N"
  const title = `Candidate Model ${idx + 1}`;

  const previewUrl = pick<string>(server, ["previewUrl", "preview_url", "thumb", "thumbnail_url"]);

  // ----- metrics -----
  const metricsSrc = (server as any).metrics ?? (server as any).fit ?? server;
  const metrics = {
    index: (pick(metricsSrc, ["Index", "index", "INDEX"]) as number | string | undefined),
    Y: (pick(metricsSrc, ["Y", "y"]) as number | string | undefined),
    X1: (pick(metricsSrc, ["X1", "x1"]) as number | string | undefined),
    X2: (pick(metricsSrc, ["X2", "x2"]) as number | string | undefined),
    Adj_R_Squared:
      coerceNum(pick(metricsSrc, ["Adj_R_Squared", "adjR2", "adj_r2", "adjusted_r2", "r2_adj"])) ??
      coerceNum(pick(metricsSrc, ["R_Squared", "r2"])),
    RMSE: coerceNum(pick(metricsSrc, ["RMSE", "rmse", "root_mse"])),
    MAPE: (pick(metricsSrc, ["MAPE", "mape", "mape_pct"]) as number | string | undefined),
    R_Squared: (pick(metricsSrc, ["R_Squared"]) as number | string | undefined)
  };

  // ----- variables -----
  const varsRaw =
    (server as any).variables ??
    (server as any).params ??
    (server as any).coefficients ??
    (server as any).coefs ??
    (server as any).terms ??
    null;

  let variables: Array<{
    name: string;
    coeff_X1: number;
    "p-value_X1": number | string;
    vif?: number | string;
  }> = [];

  if (Array.isArray(varsRaw) && varsRaw.length) {
    variables = varsRaw.map((v: any) => {
      const nameRaw = pick(v, ["name", "variable", "term", "feature", "param", "x"]);
      const coefRaw = pick(v, ["coeff_X1", "coefficient", "coef", "beta", "value", "estimate"]);
      const pRaw    = pick(v, ["p-value_X1", "pValue", "p_value", "p", "prob", "pval"]);
      const vifRaw  = pick(v, ["vif", "VIF", "vif_X1"]);

      const name =
        typeof nameRaw === "string" && nameRaw.trim() !== "" ? nameRaw : String(nameRaw ?? "var");

      return {
        name,
        coeff_X1: coerceNum(coefRaw) ?? 0,
        "p-value_X1": (typeof pRaw === "number" || typeof pRaw === "string") ? pRaw : "—",
        vif: (typeof vifRaw === "number" || typeof vifRaw === "string") ? vifRaw : undefined,
      };
    });
  } else {
    const s = server as any;

    // Intercept
    const intCoef = coerceNum(s.intercept ?? s.coeff_intercept ?? s.coef_intercept);
    if (intCoef != null) {
      const intP = s["p-value_intercept"] ?? s.p_value_intercept ?? s.p_intercept ?? s.pval_intercept;
      variables.push({
        name: "Intercept",
        coeff_X1: intCoef,
        "p-value_X1": (typeof intP === "number" || typeof intP === "string") ? intP : "—",
        vif: "—",
      });
    }

    // X1..Xn
    const idxs = Object.keys(s)
      .map((k) => /^X(\d+)$/.exec(k))
      .filter(Boolean)
      .map((m) => Number(m![1]))
      .sort((a, b) => a - b);

    for (const n of idxs) {
      const name = s[`X${n}`];
      const coef = coerceNum(s[`coeff_X${n}`] ?? s[`coef_X${n}`]);
      const pval = s[`p-value_X${n}`] ?? s[`p_value_X${n}`] ?? s[`pX${n}`];
      const vif  = s[`vif_X${n}`] ?? s[`VIF_X${n}`];

      if (name != null || coef != null || pval != null || vif != null) {
        variables.push({
          name: String(name ?? `X${n}`),
          coeff_X1: coef ?? 0,
          "p-value_X1": (typeof pval === "number" || typeof pval === "string") ? pval : "—",
          vif: (typeof vif === "number" || typeof vif === "string") ? vif : undefined,
        });
      }
    }
  }

  return { title, variables, metrics, previewUrl };
}


/* ---------- API: POST then GET (paged) ---------- */

export async function postCandidateModels(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  candidate_models: any;
}): Promise<ApiEnvelope<unknown>> {
  const { apiBase, token, workflowId, candidate_models } = opts;
  if (!Number.isFinite(workflowId)) throw new Error("workflowId must be a finite number");

  const url = `${base(apiBase)}/api/overlay/development/candidate_models`;

  const form = new FormData();
  form.append("workflow_id", String(workflowId));
  form.append("candidate_models", JSON.stringify(candidate_models));
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
  if (!json?.success) throw new Error(json?.msg || "Candidate models POST failed");
  return json;
}


// GET: /api/overlay/development/candidate_models/?workflow_id=22&page=2&page_size=10
export async function getCandidateModels(opts: {
  apiBase: string;
  token?: string | null;
  workflowId: number;
  page?: number;
  pageSize?: number;
}): Promise<{
  envelope: ApiEnvelope<ServerList>;
  models: ModelSpec[];
  total?: number;
  pages?: number;
}> {
  const { apiBase, token, workflowId } = opts;
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 10;

  if (!Number.isFinite(workflowId)) throw new Error("workflowId must be a finite number");

  const qs = new URLSearchParams({
    workflow_id: String(workflowId),
    page: String(page),
    page_size: String(pageSize),
  }).toString();

  // Note the trailing slash before the query, matching your example path
  const url = `${base(apiBase)}/api/overlay/development/candidate_models/?${qs}`;

  const res = await xfetch(url, {
    method: "GET",
    headers: withAuth(token, { Accept: "application/json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const envelope = (await res.json()) as ApiEnvelope<ServerList>;
  const { list, total, pages } = extractListAndMeta(envelope?.data);
  const models = list.map((m, i) => shapeOne(m, i));
  return { envelope, models, total, pages };
}