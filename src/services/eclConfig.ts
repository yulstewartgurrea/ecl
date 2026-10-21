// src/services/eclConfig.ts
// Entities and loan products live in the backend database and are shared by all users.
import { fetch } from "@tauri-apps/plugin-http";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");

export type Entity = { id: number; name: string };
export type LoanProduct = { id: number; name: string; entity_id: number };

async function request<T>(
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

export const listEntities = (token: string) =>
  request<Entity[]>("/api/entities/", token);

export const createEntity = (token: string, name: string) =>
  request<Entity>("/api/entities/", token, { method: "POST", body: { name } });

export const updateEntity = (token: string, id: number, name: string) =>
  request<Entity>(`/api/entities/${id}`, token, { method: "PUT", body: { name } });

export const deleteEntity = (token: string, id: number) =>
  request<unknown>(`/api/entities/${id}`, token, { method: "DELETE" });

export const listLoanProducts = (token: string) =>
  request<LoanProduct[]>("/api/loan-products/", token);

export const createLoanProduct = (token: string, data: { name: string; entity_id: number }) =>
  request<LoanProduct>("/api/loan-products/", token, { method: "POST", body: data });

export const updateLoanProduct = (
  token: string,
  id: number,
  data: { name?: string; entity_id?: number }
) => request<LoanProduct>(`/api/loan-products/${id}`, token, { method: "PUT", body: data });

export const deleteLoanProduct = (token: string, id: number) =>
  request<unknown>(`/api/loan-products/${id}`, token, { method: "DELETE" });
