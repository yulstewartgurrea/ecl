// src/services/upload.ts
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

function isTauriRuntime(): boolean {
  const w = window as any;
  return !!(w?.__TAURI__ || w?.__TAURI_IPC__ || (navigator.userAgent || "").includes("Tauri"));
}

// makes fetch work in browser + tauri
async function xfetch(input: string, init?: RequestInit): Promise<Response> {
  if (isTauriRuntime()) {
    return (await tauriFetch(input, init as any)) as unknown as Response;
  }
  return fetch(input, init);
}

export type UploadResult = {
  ok: boolean;
  status: number;
  fileName: string;
  data?: any;
  error?: string;
};

export type UploadOutcome = "ok" | "conflict" | "error";

/* ---------------- Filename → document_type ---------------- */
export function inferOverlayDocumentType(fileName: string): string | null {
  const base = fileName.toLowerCase().replace(/\.[a-z0-9]+$/, "");
  if (base.includes("monthly_historical_mev")) {
    return "OVERLAY_DEVELOPMENT_MONTHLY_HISTORICAL_MEV";
  }
  if (base.includes("quarterly_historical_mev")) {
    return "OVERLAY_DEVELOPMENT_QUARTERLY_HISTORICAL_MEV";
  }
  if (base.includes("historical_default_mev") || base.includes("historical_default_rate")) {
    return "OVERLAY_DEVELOPMENT_HISTORICAL_DEFAULT_RATE";
  }
  return null;
}

/* ---------------- Normalizers (locks out bad values) ---------------- */
function normalizeModule(v?: string | null) {
  const up = (v ?? "OVERLAY").trim().toUpperCase();
  return up === "MODULE" ? "OVERLAY" : up; // guard legacy/bad inputs
}
function normalizeSubmodule(v?: string | null) {
  return (v ?? "DEVELOPMENT").trim().toUpperCase();
}
function normalizeWorkflowPath(p: string) {
  // strip leading slashes, enforce overlay/development segments in lowercase
  const cleaned = p.replace(/^\/+/, "");
  return cleaned
    .replace(/\/MODULE\/DEVELOPMENT/gi, "/overlay/development")
    .replace(/\/Overlay\/Development/g, "/overlay/development");
}

/* ---------------- HTTP upload (multipart/form-data) ---------------- */
export async function overlayUploadFile(opts: {
  baseUrl: string;
  token?: string | null;
  file: File;
  workflowPath: string;          // e.g. <entity>/<period>/<wfName>/input/overlay/development
  documentType: string;
  workflowId: number;
  override: boolean;
  moduleVal?: string | null;
  submoduleVal?: string | null;
}): Promise<UploadResult> {
  const {
    baseUrl,
    token,
    file,
    documentType,
    workflowId,
    override,
  } = opts;

  const moduleVal = normalizeModule(opts.moduleVal);
  const submoduleVal = normalizeSubmodule(opts.submoduleVal);
  const workflowPath = normalizeWorkflowPath(opts.workflowPath);

  const url = `${baseUrl.replace(/\/+$/, "")}/api/document/upload`;

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("workflow_path", workflowPath);
  form.append("document_type", documentType);
  form.append("workflow_id", String(workflowId));
  form.append("override", String(override));
  form.append("module", moduleVal);        // 🔒 ALWAYS OVERLAY
  form.append("submodule", submoduleVal);  // 🔒 ALWAYS DEVELOPMENT
  
  console.log("payload: ", {
    file,
    workflowPath,
    documentType,
    workflowId,
    override,
    moduleVal,
    submoduleVal
  })
  // Optional debug: see exactly what we send (excludes file content)
  // for (const [k, v] of form.entries()) {
  //   console.log("[upload form]", k, v instanceof File ? v.name : v);
  // }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await xfetch(url, { method: "POST", headers, body: form });
  try {
    const data = await res.json();
    return { ok: res.ok, status: res.status, fileName: file.name, data };
  } catch {
    return { ok: res.ok, status: res.status, fileName: file.name, error: `Non-JSON (status ${res.status})` };
  }
}

/* ---------------- Conflict / error detection ---------------- */
function looksLikeConflictPayload(data: any): boolean {
  if (!data) return false;
  const s = JSON.stringify(data).toLowerCase();
  return (
    ("status" in data && ["exists", "conflict", "duplicate"].includes(String(data.status).toLowerCase())) ||
    data.conflict === true ||
    /already\s*exists|exists|duplicate|conflict|overwrite/.test(s)
  );
}

export function classifyUploadResult(r: UploadResult): UploadOutcome {
  if (!r.ok) {
    if (r.status === 409) return "conflict";
    if (looksLikeConflictPayload(r.data)) return "conflict";
    return "error";
  }
  if (looksLikeConflictPayload(r.data)) return "conflict";
  return "ok";
}