// src/services/apiRequest.ts
// JSON request to the local backend for routers that answer {code, success, msg, data}.
import { fetch } from "@tauri-apps/plugin-http";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");

export async function request<T>(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // Our routers send {detail: {msg}}; request validation sends {detail: [{msg}]}
    const detail = json?.detail;
    const msg =
      (typeof detail === "string" && detail) ||
      detail?.msg ||
      (Array.isArray(detail) && String(detail[0]?.msg ?? "").replace(/^Value error, /, "")) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json?.data as T;
}
