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
  history?: Array<{ role: string; content: string }>;
  stream?: boolean;
};

const API_BASE = "https://brain-sam.sgvnexus.uk";

const getAuthHeaders = (tokenai?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (tokenai) {
    headers["x-app-auth"] = tokenai;
  }
  return headers;
};
export async function uploadEclFile(
  args: { session_id: string; file: File },
  signal?: AbortSignal,
  tokenai?: string | null,
): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("session_id", args.session_id);
  fd.append("file", args.file);

  const res = await fetch(`${API_BASE}/deepagents/ecl/upload`, {
    method: "POST",
    headers: getAuthHeaders(tokenai),
    body: fd,
    signal,
  });

  if (!res.ok) {
    const txt = await safeText(res);
    throw new Error(`Upload failed (${res.status}): ${txt || res.statusText}`);
  }

  return (await res.json()) as UploadResponse;
}

export async function messageEcl(
  req: MessageRequest,
  signal?: AbortSignal,
  tokenai?: string | null,
): Promise<any> {
  const res = await fetch(`${API_BASE}/deepagents/ecl/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders(tokenai) },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const txt = await safeText(res);
    throw new Error(`Message failed (${res.status}): ${txt || res.statusText}`);
  }

  return await res.json();
}

export async function streamEcl(
  req: StreamRequest,
  signal?: AbortSignal,
  tokenai?: string | null,
): Promise<Response> {
  const res = await fetch(`${API_BASE}/deepagents/ecl/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders(tokenai) },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const txt = await safeText(res);
    throw new Error(`Stream failed (${res.status}): ${txt || res.statusText}`);
  }

  if (!res.body)
    throw new Error("Stream response has no body (ReadableStream missing).");

  return res;
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
