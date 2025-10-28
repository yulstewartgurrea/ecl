// lib/asaApi.ts
import { useMemo } from "react";
import { useAppSelector } from "../redux_toolkit/hooks";
type AuthScheme = "Bearer" | "Token" | "";

/* ===== Base URL ===== */
const DEFAULT_API_BASE =
  (typeof window !== "undefined" && (window as any).__ASA_API_BASE__) ||
  "http://localhost:8000/api/flowrate_approach";

/* ===== Types used in Step 2 (keep exported) ===== */
export type SummaryRow = {
  uniqueReportDate: string;
  uniqueProduct: string;
  index: number;
};

export type ConsolidatedRow = {
  reportDate: string;
  agingCategory: string;
  numberOfDelinquents?: number;
  loanBalancePrincipal?: number;
  netParAmount_LB_withCP?: number;
  netParAmount_LB_Principal?: number;
  netParPercent?: number;
  repaymentRate?: number;
};

export type AsaApi = {
  getStep2Data: (workflowId: number) => Promise<any>;
  getStep3Data: (workflowId: number) => Promise<any>;
  getStep4Data: (workflowId: number) => Promise<any>;
  getStep5Data: (workflowId: number) => Promise<any>;
};

/* ===== Helpers ===== */
function makeAuthHeader(token?: string, scheme: AuthScheme = "Bearer"): Record<string, string> {
  if (!token) return {};
  if (/^\s*(Bearer|Token)\s+/i.test(token)) return { Authorization: token };
  return scheme ? { Authorization: `${scheme} ${token}` } : { Authorization: token };
}

/** Join base + path safely and remove any `/ ?` that causes 307s. */
function joinPath(base: string, path: string) {
  const url = path.startsWith("http")
    ? path
    : `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  return url.replace(/\/+\?/, "?");
}

async function fetchJson<T>(
  base: string,
  path: string,
  token?: string,
  scheme: AuthScheme = "Bearer",
  init?: RequestInit
): Promise<T> {
  const url = joinPath(base, path);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...makeAuthHeader(token, scheme),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch { try { body = await res.text(); } catch {} }
    const err: any = new Error(`API ${res.status} ${res.statusText} – ${url}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json() as Promise<T>;
}

/* ===== Small parsing helpers for Step 2 ===== */
const toNum = (v: any): number | undefined => {
  if (v === "" || v == null) return undefined;
  const s = String(v).replace(/[, ]+/g, "");
  const n = Number(s.replace(/%$/, ""));
  return Number.isFinite(n) ? n : undefined;
};
const pick = (row: any, keys: string[]) =>
  keys.find((k) => row[k] != null && row[k] !== "") as string | undefined;

/* ===== STEP 2 adapter (kept exported exactly as you asked) ===== */
export async function getStep2Consolidation(
  workflowId: number,
  opts?: { token?: string; base?: string; scheme?: AuthScheme }
): Promise<{ summaryRows: SummaryRow[]; consolidatedRows: ConsolidatedRow[] }> {
  const base = opts?.base ?? DEFAULT_API_BASE;
  const scheme = opts?.scheme ?? "Bearer";
  const token = opts?.token;

  type RawResp = {
    code: number;
    success: boolean;
    msg?: string;
    data?: { data_summary?: any[]; consolidated_data?: any[] };
  };

  // ⬇️ no trailing slash before ? (prevents 307)
  const raw = await fetchJson<RawResp>(base, `data_consolidation?workflow_id=${workflowId}`, token, scheme);
  const data = raw?.data ?? {};

  const summaryRows: SummaryRow[] = (data.data_summary ?? []).map((r: any): SummaryRow => {
    const dateKey = pick(r, ["Unique Report Dates", "Unique Report Date", "Report Date"])!;
    const prodKey = pick(r, ["Unique Product", "Product"])!;
    const idxKey  = pick(r, ["Index"])!;
    return {
      uniqueReportDate: (r[dateKey] ?? "").toString(),
      uniqueProduct: (r[prodKey] ?? "").toString(),
      index: Number(r[idxKey] ?? 0) || 0,
    };
  });

  const consolidatedRows: ConsolidatedRow[] = (data.consolidated_data ?? []).map((r: any): ConsolidatedRow => {
    const rdKey   = pick(r, ["Report Date", "Date"])!;
    const acKey   = pick(r, ["Aging Category"])!;
    const delKey  = pick(r, ["Product Counts", "No. of Delinquents"]);
    const lbpKey  = pick(r, ["Loan Balance Principal"]);
    const nparCP  = pick(r, ["NET PAR Amount Loan Balance w/ CP"]);
    const nparLB  = pick(r, ["NET PAR Amount Loan Balance Principal"]);
    const nparPct = pick(r, ["NET PAR % (Gross PAR/TLP)", "NET PAR %"]);
    const repay   = pick(r, ["Repayment Rate"]);

    return {
      reportDate: (r[rdKey] ?? "").toString(),
      agingCategory: (r[acKey] ?? "").toString(),
      numberOfDelinquents: toNum(delKey ? r[delKey] : undefined),
      loanBalancePrincipal: toNum(lbpKey ? r[lbpKey] : undefined),
      netParAmount_LB_withCP: toNum(nparCP ? r[nparCP] : undefined),
      netParAmount_LB_Principal: toNum(nparLB ? r[nparLB] : undefined),
      netParPercent: toNum(nparPct ? r[nparPct] : undefined),
      repaymentRate: toNum(repay ? r[repay] : undefined),
    };
  });

  return { summaryRows, consolidatedRows };
}

/* ===== Generic API factory ===== */
export function createAsaApi(token?: string, options?: { base?: string; scheme?: AuthScheme }): AsaApi {
  const base = options?.base ?? DEFAULT_API_BASE;
  const scheme = options?.scheme ?? "Bearer";
  return {
    getStep2Data: (workflowId: number) =>
      fetchJson(base, `data_consolidation?workflow_id=${workflowId}`, token, scheme),
    getStep3Data: (workflowId: number) =>
      fetchJson(base, `flow_rate?workflow_id=${workflowId}`, token, scheme),
    getStep4Data: (workflowId: number) =>
      fetchJson(base, `flow_rate?workflow_id=${workflowId}`, token, scheme),
    getStep5Data: (workflowId: number) =>
      fetchJson(base, `credit_loss_calculation?workflow_id=${workflowId}`, token, scheme),
  };
}

/* ===== React hook — memoize so identity is STABLE ===== */
export function useAsaApi(options?: { base?: string; scheme?: AuthScheme }): AsaApi {
  const authToken = useAppSelector((s) => s.auth.token) || undefined;
  const base = options?.base;
  const scheme = options?.scheme;
  return useMemo(() => createAsaApi(authToken, { base, scheme }), [authToken, base, scheme]);
}
