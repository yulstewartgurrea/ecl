import type { ChatThread, StreamEvent } from "./chatbot.types";


const SAM_INTRO = `Hi! I’m **Sam 👩🏻‍🦰** — I can help you run **NetFlow**, **Probability of Default (PD)**, or **Overlay / ECL**.

### Choose what you want to calculate:
- **Net Flow Approach**
- **PD Transaction**
- **Overlay**
`;

export function createNewThread(): ChatThread {
  const now = Date.now();
  const session_id = makeId();
  return {
    id: makeId(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    pinned: false,
    files: [],
    session_id,
    has_uploaded_file: false,
    upload_status: "idle",
    upload_error: null,
    upload_response: null,
    last_artifacts: null,
    messages: [
      {
        id: makeId(),
        role: "assistant",
        kind: "accordion",
        title: "Sam 👩🏻‍🦰",
        subtitle: "Getting started",
        sections: [
          {
            id: makeId(),
            kind: "text",
            title: "Welcome",
            pill: "intro",
            content: SAM_INTRO,
            open: true,
          },
        ],
        isStreaming: false,
      } as any,
    ],
  };
}


export const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);

export function ensureSessionId(thread: ChatThread) {
  return thread.session_id ?? makeId();
}

export function normalizeMessageResponseToEvents(resp: any): StreamEvent[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp as StreamEvent[];
  if (Array.isArray(resp.events)) return resp.events as StreamEvent[];
  if (typeof resp === "object" && typeof resp.type === "string")
    return [resp as StreamEvent];

  if (typeof resp === "object" && typeof resp.answer === "string") {
    return [
      {
        type: "result",
        workflow_state: resp.workflow_state ?? "done",
        answer: resp.answer,
        artifacts: resp.artifacts,
        sources: resp.sources ?? [],
        confidence: resp.confidence,
        mode: resp.mode,
        mode_used: resp.mode_used,
        session_id: resp.session_id,
        file_name: resp.file_name,
        workflow_steps: resp.workflow_steps,
      } as any,
    ];
  }

  return [
    {
      type: "result",
      workflow_state: "done",
      answer: typeof resp === "string" ? resp : JSON.stringify(resp, null, 2),
      sources: [],
      confidence: "unknown",
      mode: "deepagents_ecl",
      mode_used: "deepagents_ecl",
    } as any,
  ];
}

export function isVisualizationRequest(text: string) {
  const t = (text || "").toLowerCase();
  return (
    t.includes("visual") ||
    t.includes("visualize") ||
    t.includes("visualization") ||
    t.includes("graph") ||
    t.includes("chart") ||
    t.includes("plot")
  );
}

export function buildUploadResponseContent(
  uploaded: any,
  fileName: string,
  sessionId: string,
) {
  const lines = [
    `File: **${fileName}**`,
    `Session ID: **${sessionId}**`,
    uploaded?.workflow_state
      ? `Workflow state: **${uploaded.workflow_state}**`
      : null,
    uploaded?.type ? `Type: **${uploaded.type}**` : null,
  ].filter(Boolean);

  const details =
    uploaded && typeof uploaded === "object"
      ? `\n\n\
\`\`\`json\n${JSON.stringify(uploaded, null, 2)}\n\`\`\`\n`
      : "";

  return `${lines.join("\n")}${details}`;
}
