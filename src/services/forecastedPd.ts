// src/services/forecastedPd.ts
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function authFetch(
  url: string,
  options: RequestInit = {},
  token?: string | null
) {
  // Normalize headers to a plain object we can safely index
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers, // still valid as HeadersInit
  });
}

export async function getForecastedPdInput(
  workflowId: number | string,
  token?: string | null
): Promise<Record<string, number>> {
  const url = `${API_BASE}/api/overlay/execution/forecasted_pd_calc/input/?workflow_id=${encodeURIComponent(
    String(workflowId)
  )}`;

  const res = await authFetch(url, { method: "GET" }, token);
  if (!res.ok) throw new Error("Failed to fetch forecasted PD input.");
  const json = await res.json();
  if (json?.success === false) {
    throw new Error(json?.msg || "Failed to fetch forecasted PD input.");
  }
  return (json?.data ?? {}) as Record<string, number>;
}

export async function getForecastedPdCalc(
  workflowId: number | string,
  token?: string | null
): Promise<any> {
  const url = `${API_BASE}/api/overlay/execution/forecasted_pd_calc/?workflow_id=${encodeURIComponent(
    String(workflowId)
  )}`;

  const res = await authFetch(url, { method: "GET" }, token);
  if (!res.ok) throw new Error("Failed to fetch forecasted PD calc.");
  const json = await res.json();
  if (json?.success === false) {
    throw new Error(json?.msg || "Failed to fetch forecasted PD calc.");
  }
  return json?.data ?? {};
}

export async function runForecastedPdCalc(
  workflowId: number | string,
  finalModelExecutionFile?: boolean,
  token?: string | null
): Promise<any> {
  const url = `${API_BASE}/api/overlay/execution/forecasted_pd_calc/`;
  const form = new FormData();
  form.append("workflow_id", String(workflowId));

  if (finalModelExecutionFile) {
    form.append("final_model_execution_file", String(finalModelExecutionFile));
  }

  const res = await authFetch(
    url,
    {
      method: "POST",
      body: form,
    },
    token
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.msg || "Failed to run forecasted PD calc.");
  }
  return json;
}