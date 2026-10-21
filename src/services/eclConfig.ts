// src/services/eclConfig.ts
// Entities and loan products live in the backend database and are shared by all users.
import { request } from "./apiRequest";

export type Entity = { id: number; name: string };
export type LoanProduct = { id: number; name: string; entity_id: number };

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
