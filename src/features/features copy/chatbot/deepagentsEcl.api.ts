// # file: src/features/chatbot/deepagentsEcl.api.ts
export type UploadResponse = {
  type?: string;
  workflow_state?: string;
  session_id: string;
  file_name?: string;
};

export type MessageRequest = {
  session_id: string;
  message: string;
};

export type StreamRequest = {
  session_id: string;
  message: string; // backend requires this field; we’ll send "start" on Start click
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8001";

/**
 * Upload expects multipart/form-data:
 *  - session_id (string)
 *  - file (binary)
 */
export async function uploadEclFile(
  args: { session_id: string; file: File },
  signal?: AbortSignal
): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("session_id", args.session_id);
  fd.append("file", args.file);

  const res = await fetch(`${API_BASE}/deepagents/ecl/upload`, {
    method: "POST",
    body: fd,
    signal,
  });

  if (!res.ok) {
    const txt = await safeText(res);
    throw new Error(`Upload failed (${res.status}): ${txt || res.statusText}`);
  }

  return (await res.json()) as UploadResponse;
}

/**
 * Send button ALWAYS calls this (non-stream)
 */
export async function messageEcl(req: MessageRequest, signal?: AbortSignal): Promise<any> {
  const res = await fetch(`${API_BASE}/deepagents/ecl/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const txt = await safeText(res);
    throw new Error(`Message failed (${res.status}): ${txt || res.statusText}`);
  }

  return await res.json();
}

/**
 * Start button calls this (stream)
 */
export async function streamEcl(req: StreamRequest, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`${API_BASE}/deepagents/ecl/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const txt = await safeText(res);
    throw new Error(`Stream failed (${res.status}): ${txt || res.statusText}`);
  }

  if (!res.body) throw new Error("Stream response has no body (ReadableStream missing).");

  return res;
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
