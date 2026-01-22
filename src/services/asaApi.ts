// services/asaApi.ts
import { useMemo } from "react";
import { useAppSelector } from "../redux_toolkit/hooks";
type AuthScheme = "Bearer" | "Token" | "";

/* ===== Base URL ===== */
const DEFAULT_API_BASE =
  (typeof window !== "undefined" && (window as any).__ASA_API_BASE__) ||
  "http://127.0.0.1:8000/api/flowrate_approach";

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
function makeAuthHeader(
  token?: string,
  scheme: AuthScheme = "Bearer"
): Record<string, string> {
  if (!token) return {};
  if (/^\s*(Bearer|Token)\s+/i.test(token)) return { Authorization: token };
  return scheme
    ? { Authorization: `${scheme} ${token}` }
    : { Authorization: token };
}

/** Join base + path safely and remove any `/ ?` that causes 307s. */
function joinPath(base: string, path: string) {
  const url = path.startsWith("http")
    ? path
    : `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  return url.replace(/\/+\?/, "?");
}

async function fetchJsonWithAuth<T>(
  base: string,
  path: string,
  token?: string,
  scheme: AuthScheme = "Bearer",
  init?: RequestInit
): Promise<T> {
  const url = joinPath(base, path);
  const apiResponse = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...makeAuthHeader(token, scheme),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!apiResponse.ok) {
    let body: any = null;
    try {
      body = await apiResponse.json();
    } catch {
      try {
        body = await apiResponse.text();
      } catch {}
    }
    const err: any = new Error(
      `API ${apiResponse.status} ${apiResponse.statusText} – ${url}`
    );
    err.status = apiResponse.status;
    err.body = body;
    throw err;
  }
  return apiResponse.json() as Promise<T>;
}

/* ===== Small parsing helpers for Step 2 ===== */
const toNumberMaybe = (value: any): number | undefined => {
  if (value === "" || value == null) return undefined;
  const trimmed = String(value).replace(/[, ]+/g, "");
  const numeric = Number(trimmed.replace(/%$/, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
};
const pickMatchingKey = (row: any, keys: string[]) =>
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
  const apiResponse = await fetchJsonWithAuth<RawResp>(
    base,
    `data_consolidation?workflow_id=${workflowId}`,
    token,
    scheme
  );
  const data = apiResponse?.data ?? {};

  const summaryRows: SummaryRow[] = (data.data_summary ?? []).map(
    (r: any): SummaryRow => {
      const dateKey = pickMatchingKey(r, [
        "Unique Report Dates",
        "Unique Report Date",
        "Report Date",
      ])!;
      const prodKey = pickMatchingKey(r, ["Unique Product", "Product"])!;
      const idxKey = pickMatchingKey(r, ["Index"])!;
      return {
        uniqueReportDate: (r[dateKey] ?? "").toString(),
        uniqueProduct: (r[prodKey] ?? "").toString(),
        index: Number(r[idxKey] ?? 0) || 0,
      };
    }
  );

  const consolidatedRows: ConsolidatedRow[] = (
    data.consolidated_data ?? []
  ).map((r: any): ConsolidatedRow => {
    const rdKey = pickMatchingKey(r, ["Report Date", "Date"])!;
    const acKey = pickMatchingKey(r, ["Aging Category"])!;
    const delKey = pickMatchingKey(r, ["Product Counts", "No. of Delinquents"]);
    const lbpKey = pickMatchingKey(r, ["Loan Balance Principal"]);
    const nparCP = pickMatchingKey(r, ["NET PAR Amount Loan Balance w/ CP"]);
    const nparLB = pickMatchingKey(r, ["NET PAR Amount Loan Balance Principal"]);
    const nparPct = pickMatchingKey(r, ["NET PAR % (Gross PAR/TLP)", "NET PAR %"]);
    const repay = pickMatchingKey(r, ["Repayment Rate"]);

    return {
      reportDate: (r[rdKey] ?? "").toString(),
      agingCategory: (r[acKey] ?? "").toString(),
      numberOfDelinquents: toNumberMaybe(delKey ? r[delKey] : undefined),
      loanBalancePrincipal: toNumberMaybe(lbpKey ? r[lbpKey] : undefined),
      netParAmount_LB_withCP: toNumberMaybe(nparCP ? r[nparCP] : undefined),
      netParAmount_LB_Principal: toNumberMaybe(nparLB ? r[nparLB] : undefined),
      netParPercent: toNumberMaybe(nparPct ? r[nparPct] : undefined),
      repaymentRate: toNumberMaybe(repay ? r[repay] : undefined),
    };
  });

  return { summaryRows, consolidatedRows };
}

/* ===== Generic API factory ===== */
export function createAsaApi(
  token?: string,
  options?: { base?: string; scheme?: AuthScheme }
): AsaApi {
  const base = options?.base ?? DEFAULT_API_BASE;
  const scheme = options?.scheme ?? "Bearer";
  return {
    getStep2Data: (workflowId: number) =>
      fetchJsonWithAuth(
        base,
        `data_consolidation/?workflow_id=${workflowId}`,
        token,
        scheme
      ),
    getStep3Data: (workflowId: number) =>
      fetchJsonWithAuth(base, `flow_rate/?workflow_id=${workflowId}`, token, scheme),
    getStep4Data: (workflowId: number) =>
      fetchJsonWithAuth(base, `flow_rate/?workflow_id=${workflowId}`, token, scheme),
    getStep5Data: (workflowId: number) =>
      fetchJsonWithAuth(
        base,
        `credit_loss_calculation/?workflow_id=${workflowId}`,
        token,
        scheme
      ),
  };
}

/* ===== React hook — memoize so identity is STABLE ===== */
export function useAsaApi(options?: {
  base?: string;
  scheme?: AuthScheme;
}): AsaApi {
  const authToken = useAppSelector((s) => s.auth.token) || undefined;
  const base = options?.base;
  const scheme = options?.scheme;
  return useMemo(
    () => createAsaApi(authToken, { base, scheme }),
    [authToken, base, scheme]
  );
}
