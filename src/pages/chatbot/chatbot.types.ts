// # file: src/features/chatbot/chatbot.types.ts

export type StepStatus = "pending" | "running" | "done" | "error";

export type AssistantActionVariant = "primary" | "secondary" | "ghost";

export type AssistantAction = {
  id: string;
  label: string;
  variant?: AssistantActionVariant;
  disabled?: boolean;

  // For link actions (download, open)
  href?: string;
  download?: boolean;

  // For local actions (e.g., export, quick reply)
  type?: "export_xlsx" | "send_message" | string;
  payload?: any;
};

export type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  textPreview?: string;
};

export type ChatRole = "user" | "assistant";

export type ChatMessageBase = {
  id: string;
  role: ChatRole;
};

export type UserMsg = ChatMessageBase & {
  role: "user";
  content: string;
};

export type AssistantSectionText = {
  id: string;
  kind: "text";
  title: string;
  pill?: string; // e.g. "intro" | "stream" | "done" | "error"
  content: string;
  open?: boolean;
};

export type AssistantSectionThinking = {
  id: string;
  kind: "thinking";
  title: string;
  content: string;
  open?: boolean;
};

export type AssistantWorkflowStep = {
  id: string;
  label: string;
  status: StepStatus;
};

export type AssistantSectionWorkflow = {
  id: string;
  kind: "workflow";
  title: string;
  steps: AssistantWorkflowStep[];
  meta?: {
    fileName?: string;
    sessionId?: string;
    state?: string; // workflow_state
    liveMessage?: string; // checklist message shown in workflow card
  };
  open?: boolean;
};

export type AssistantSectionTable = {
  id: string;
  kind: "table";
  title: string;
  pill?: string; // "stream" | "result"
  totals?: Record<string, any>;
  columns: string[];
  rows: Record<string, any>[];
  open?: boolean;
  actions?: AssistantAction[];
};

/**
 * ✅ Chart section (for visualization requests)
 * We keep it simple: we only chart Credit Loss Rate preview rows.
 */
export type AssistantSectionChart = {
  id: string;
  kind: "chart";
  title: string;
  pill?: string; // "viz" | "result"
  chartType: "credit_loss_rate";
  data: Record<string, any>[];
  open?: boolean;
};

export type AssistantSectionSummary = {
  id: string;
  kind: "summary";
  title: string;
  content?: string;
  chartData?: Record<string, any>[];
  flowratePreview?: Record<string, any>[];
  creditLossRatePreview?: Record<string, any>[];
  open?: boolean;
};

export type AssistantSection =
  | AssistantSectionText
  | AssistantSectionThinking
  | AssistantSectionWorkflow
  | AssistantSectionTable
  | AssistantSectionChart
  | AssistantSectionSummary;

export type AssistantMsg = ChatMessageBase & {
  role: "assistant";
  kind: "accordion";
  title: string;
  subtitle?: string;
  sections: AssistantSection[];
  actions?: AssistantAction[];
  isStreaming?: boolean;
};

export type ChatMessage = UserMsg | AssistantMsg;

export type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;

  // per-thread file uploads
  files: UploadedFile[];

  // backend session state
  session_id?: string;
  file_name?: string;
  has_uploaded_file?: boolean;
  upload_status?: "idle" | "uploading" | "success" | "error";
  upload_error?: string | null;
  upload_response?: {
    type?: string;
    workflow_state?: string;
    session_id?: string;
    file_name?: string;
    [key: string]: any;
  } | null;

  /**
   * ✅ Cache last artifacts so visualization can work
   * even if /message doesn’t re-send full artifacts.
   */
  last_artifacts?: any;

  messages: ChatMessage[];
};

/**
 * Backend event types (stream NDJSON + message normalized)
 * Keep this flexible: backend can add fields (we allow index signature).
 */
export type StreamEventType =
  | "state"
  | "step_start"
  | "step_done"
  | "result"
  | "error"
  | "validation_log"
  | "chunk_start"
  | "chunk_done"
  | "thinking"
  | string;

export type StreamEventStep = {
  id: string;
  label?: string;
};

export type StreamEvent = {
  type: StreamEventType;

  // state/result metadata
  workflow_state?: string; // running | done | error | awaiting_upload | awaiting_start
  session_id?: string;
  file_name?: string;

  // step events
  step?: StreamEventStep;
  failed_step?: string;

  // messages
  answer?: string;
  message?: string;

  // artifacts/results
  artifacts?: any;
  sources?: any[];
  confidence?: string;
  mode?: string;
  mode_used?: string;

  // optional error payloads
  error_detail?: string;
  error_hint?: string;

  // allow extra fields without breaking
  [key: string]: any;
};

export type BuildOpts = {
  showWorkflow?: boolean;
  showTables?: boolean;
  showVisualization?: boolean;
};
