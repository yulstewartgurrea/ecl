// # file: src/features/chatbot/useAiResponseStream.ts
import type {
  StreamEvent,
  AssistantMsg,
  AssistantSection,
  AssistantAction,
  BuildOpts,
} from "./chatbot.types";

type StepStatus = "pending" | "running" | "done" | "error";

const API_BASE = import.meta.env.VITE_API_BASE ?? "brain-sam.sgvnexus.uk";

const STEP_ORDER: { id: string; label: string }[] = [
  { id: "read_validate", label: "Reading & Validation" },
  { id: "flowrate", label: "Flowrate Approach" },
  { id: "credit_loss_rate", label: "Credit Loss Rate Approach" },
  { id: "summary", label: "Summary" },
];

type ExportSheet = { name: string; rows: Record<string, any>[] };
type ExportPayload = {
  fileName?: string;
  sheets: ExportSheet[];
  suggestedName: string;
};

export function fmtForTableCell(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v);
    const abs = Math.abs(v);
    if (abs >= 1_000)
      return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  return String(v);
}

function sanitizeSheetName(name: string) {
  const clean = String(name || "Sheet")
    .replace(/[\\/?*:[\]]/g, " ")
    .trim();
  return clean.length > 31 ? clean.slice(0, 31) : clean || "Sheet";
}

function toKeyValueRows(obj: Record<string, any>) {
  return Object.entries(obj || {}).map(([key, value]) => ({ key, value }));
}

function buildSingleExportPayload(
  name: string,
  rows: Record<string, any>[],
  fileName: string,
  suffix: string,
): ExportPayload | null {
  if (!rows || !rows.length) return null;
  const resolvedFileName = fileName || "";
  const suggestedName = resolvedFileName
    ? `${resolvedFileName.replace(/\.[^.]+$/, "")}_${suffix}.xlsx`
    : `${suffix}.xlsx`;
  return {
    fileName: resolvedFileName,
    sheets: [{ name: sanitizeSheetName(name), rows }],
    suggestedName,
  };
}

function buildExportPayload(
  artifacts: any,
  fileName: string,
): ExportPayload | null {
  if (!artifacts) return null;
  const resolvedFileName =
    fileName || artifacts?.file_name || artifacts?.fileName || "";
  const sheets: ExportSheet[] = [];
  const chunks = artifacts?.chunks ?? [];

  if (Array.isArray(chunks) && chunks.length) {
    chunks.forEach((chunk: any, idx: number) => {
      const prefix = `Chunk ${idx + 1}`;
      const flowrate = chunk?.flowrate?.preview ?? [];
      const clr = chunk?.credit_loss_rate?.preview ?? [];
      const summary = chunk?.summary ?? {};

      if (flowrate.length)
        sheets.push({
          name: sanitizeSheetName(`${prefix} Flowrate`),
          rows: flowrate,
        });
      if (clr.length)
        sheets.push({
          name: sanitizeSheetName(`${prefix} Credit Loss Rate`),
          rows: clr,
        });
      if (Object.keys(summary).length) {
        sheets.push({
          name: sanitizeSheetName(`${prefix} Summary`),
          rows: toKeyValueRows(summary),
        });
      }
    });
  } else {
    const flowrate = artifacts?.flowrate?.preview ?? [];
    const clr = artifacts?.credit_loss_rate?.preview ?? [];
    const summary = artifacts?.summary ?? {};
    if (flowrate.length)
      sheets.push({ name: sanitizeSheetName("Flowrate"), rows: flowrate });
    if (clr.length)
      sheets.push({ name: sanitizeSheetName("Credit Loss Rate"), rows: clr });
    if (Object.keys(summary).length)
      sheets.push({
        name: sanitizeSheetName("Summary"),
        rows: toKeyValueRows(summary),
      });
  }

  const logs = artifacts?.validation_logs ?? [];
  if (Array.isArray(logs) && logs.length) {
    sheets.push({ name: sanitizeSheetName("Validation Logs"), rows: logs });
  }

  if (!sheets.length) return null;

  const suggestedName = resolvedFileName
    ? `${resolvedFileName.replace(/\.[^.]+$/, "")}_ecl.xlsx`
    : "ecl_results.xlsx";
  return { fileName: resolvedFileName, sheets, suggestedName };
}

function uniqCols(rows: Record<string, any>[]) {
  const set = new Set<string>();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)));
  return Array.from(set);
}

function toDownloadHref(pathOrUrl: string) {
  const raw = String(pathOrUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+/, "");
  return `${API_BASE}/${clean}`;
}

function buildLiveWorkflowMessage(
  steps: Record<string, StepStatus>,
  workflowState: string,
) {
  const icon = (st: StepStatus) => {
    if (st === "done") return "✅";
    if (st === "running") return "⏳";
    if (st === "error") return "❌";
    return "•";
  };

  const lineText = (id: string, st: StepStatus) => {
    if (id === "read_validate")
      return st === "done"
        ? "I validated your file"
        : "I’m reading and validating the file";
    if (id === "flowrate") return "I’m calculating the Flowrate approach";
    if (id === "credit_loss_rate")
      return "I’m calculating the Credit Loss Rate";
    if (id === "summary") return "I’m preparing the final output";
    return id;
  };

  const lines = STEP_ORDER.map((s) => {
    const st = steps[s.id] ?? ("pending" as StepStatus);
    return `${icon(st)} ${lineText(s.id, st)}${st === "done" ? " - done" : ""}`;
  });

  if (workflowState === "done") lines.push("✅ All steps completed");
  if (workflowState === "error")
    lines.push("❌ Workflow failed. Check the error message above.");
  return lines.join("\n");
}

export class JsonObjectStreamParser {
  private buf = "";
  private depth = 0;
  private inStr = false;
  private esc = false;
  private start = -1;

  feed(chunk: string): StreamEvent[] {
    const out: StreamEvent[] = [];
    if (!chunk) return out;

    this.buf += chunk;

    for (let i = 0; i < this.buf.length; i++) {
      const ch = this.buf[i];

      if (this.inStr) {
        if (this.esc) this.esc = false;
        else if (ch === "\\") this.esc = true;
        else if (ch === '"') this.inStr = false;
        continue;
      }

      if (ch === '"') {
        this.inStr = true;
        continue;
      }

      if (ch === "{") {
        if (this.depth === 0) this.start = i;
        this.depth++;
        continue;
      }

      if (ch === "}") {
        this.depth--;
        if (this.depth === 0 && this.start >= 0) {
          const jsonText = this.buf.slice(this.start, i + 1);
          try {
            out.push(JSON.parse(jsonText));
          } catch {
            // ignore parse errors
          }
          this.buf = this.buf.slice(i + 1);
          i = -1;
          this.start = -1;
        }
      }
    }

    if (this.buf.length > 2_000_000) this.buf = this.buf.slice(-200_000);

    return out;
  }
}

export function createStreamingAssistantMsg(
  makeId: () => string,
): AssistantMsg {
  return {
    id: makeId(),
    role: "assistant",
    kind: "accordion",
    title: "Sam 👩🏻‍🦰",
    subtitle: "Working on it…",
    actions: [],
    sections: [
      {
        id: makeId(),
        kind: "text",
        title: "Answer",
        pill: "stream",
        content:
          "I’m getting things ready. I’ll update you as each step finishes.",
        open: true,
      },
    ],
    isStreaming: true,
  };
}

function looksLikeStream(events: StreamEvent[]) {
  return (events || []).some((e: any) => {
    const t = e?.type;
    return t === "state" || t === "step_start" || t === "step_done";
  });
}

export function buildAccordionFromEvents(
  events: StreamEvent[],
  makeId: () => string,
  opts?: BuildOpts,
) {
  const showWorkflow = opts?.showWorkflow ?? looksLikeStream(events || []);
  const showTables = opts?.showTables ?? true;
  const showVisualization = opts?.showVisualization ?? false;

  let sessionId = "";
  let fileName = "";
  let workflowState = "running";

  const steps: Record<string, StepStatus> = Object.fromEntries(
    STEP_ORDER.map((s) => [s.id, "pending" as StepStatus]),
  );

  let latestAnswer = "";
  let flowrate: any = null;
  let creditLossRate: any = null;
  let directPreview: any = null;
  let previewTotals: any = null;
  let summaryText = "";
  let excelPathOrUrl = "";
  let exportPayload: ExportPayload | null = null;
  const validationLogs: any[] = [];
  console.log(previewTotals, directPreview)
  let lastOutput: "none" | "flowrate" | "credit_loss_rate" = "none";
  const chartRowsFromArtifacts = () => {
    if (creditLossRate?.preview?.length) return creditLossRate.preview;
    return [];
  };
  let thinkingMessage = "";
  const processEntries: any[] = [];
  const chunkEvents: any[] = [];

  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    const t = (e as any).type;

    console.log("Processing event type:", t, e);

    if (t === "state") {
      console.log("-- Entered STATE block", e);
      sessionId = (e as any).session_id ?? sessionId;
      fileName = (e as any).file_name ?? fileName;
      workflowState = (e as any).workflow_state ?? workflowState;
    }

    if (t === "step_start") {
      console.log("-- Entered STEP_START block", e);
      const id = (e as any).step?.id;
      if (id && steps[id] !== "done") steps[id] = "running";
    }

    if (t === "step_done") {
      console.log("-- Entered STEP_DONE block", e);
      const id = (e as any).step?.id;
      if (id) steps[id] = "done";
    }

    // NEW: Handle process_step events
    if (t === "process_step") {
      console.log("-- Entered PROCESS_STEP block", e);
      const id = (e as any).step?.id;
      const status = (e as any).step?.status;
      if (id && status) {
        // Accepts "running", "done", etc.
        steps[id] = status;
      }
      // store the full step object for UI/process log
      try {
        processEntries.push({
          ...(e as any).step,
          chunk: (e as any).chunk,
          total_chunks: (e as any).total_chunks,
        });
      } catch {}
      // Optionally, collect details for display (not implemented here)
    }

    // NEW: Handle chunk_start events
    if (t === "chunk_start") {
      console.log("-- Entered CHUNK_START block", e);
      chunkEvents.push(e);
    }

    // NEW: Handle chunk_done events
    if (t === "chunk_done") {
      console.log("-- Entered CHUNK_DONE block", e);
      chunkEvents.push(e);
    }

    if (t === "error") {
      workflowState = "error";
      const failed = (e as any).failed_step;
      if (failed) steps[failed] = "error";
      const detail = String(
        (e as any).error_detail || (e as any).message || "Unknown error.",
      ).trim();
      if (detail) latestAnswer = detail;
    }

    if (t === "result") {
      console.log("-- Entered RESULT block", e);
      const ans = String((e as any).answer ?? "").trim();
      const artifact = (e as any).artifacts;
      console.log("Extracted answer:", ans);
      console.log("Extracted artifacts:", artifact);
      if (ans) latestAnswer = ans;
      const hasArtifacts = Boolean(artifact);
      const ansSignalsDone = ans.includes("All done");
      const eventSaysDone = (e as any).workflow_state === "done";
      if (hasArtifacts || ansSignalsDone || eventSaysDone) {
        console.log("Result indicates completion. Marking workflow as done.");
        workflowState = "done";
        // clear any transient thinking message so UI shows final result
        thinkingMessage = "";
      } else if ((e as any).workflow_state) {
        workflowState = (e as any).workflow_state ?? workflowState;
      }
      const art = (e as any).artifacts;
      if (!fileName && art?.file_name) {
        fileName = art.file_name;
      }

      // If artifacts include a summary (string or object), surface it immediately
      try {
        const maybeSummary =
          art?.summary ?? (e as any).summary ?? (e as any).summaryText;
        if (maybeSummary) {
          if (typeof maybeSummary === "string") {
            summaryText = maybeSummary;
          } else if (typeof maybeSummary === "object") {
            const kv = toKeyValueRows(maybeSummary)
              .map((r) => `${r.key}: ${r.value}`)
              .join("\n");
            if (kv) summaryText = kv;
          }
        } else if (ans && !summaryText) {
          // fall back to using the answer as a short summary if none provided
          summaryText = ans;
        }
      } catch {}

      if (art?.flowrate) {
        flowrate = art.flowrate;
        lastOutput = "flowrate";
      }
      if (art?.credit_loss_rate) {
        creditLossRate = art.credit_loss_rate;
        lastOutput = "credit_loss_rate";
      }
      // If artifacts include a top-level preview/totals (some agents emit this shape),
      // try to interpret it as credit loss rate results when totals contain relevant keys.
      if (!creditLossRate && art?.preview && art?.totals) {
        const totals = art.totals || {};
        if (
          typeof totals.avg_weighted_credit_loss_rate_per_month === "number" ||
          typeof totals.avg_weighted_credit_loss_rate === "number"
        ) {
          creditLossRate = { preview: art.preview, totals: art.totals } as any;
          lastOutput = "credit_loss_rate";
        } else if (typeof totals.row_count === "number" && !flowrate) {
          // fallback: treat as flowrate preview if row_count present and flowrate missing
          flowrate = { preview: art.preview, totals: art.totals } as any;
          lastOutput = "flowrate";
        }
      }

      if (art?.preview?.length) {
        directPreview = art.preview;
        previewTotals = art.totals;
      }

      if (workflowState === "done") {
        summaryText = ans || summaryText;
        if (art) {
          excelPathOrUrl =
            art.excel_file_url ||
            art.excel_file_path ||
            art.excel ||
            art.result_excel ||
            "";
          exportPayload = buildExportPayload(art, fileName);
        }
      }
    }

    if (t === "thinking") {
      console.log("-- Entered THINKING block", e);
      const msg = String((e as any).message ?? "").trim();
      if (msg) {
        thinkingMessage = thinkingMessage ? `${thinkingMessage}\n${msg}` : msg;
      }
    }

    if (t === "validation_log") {
      console.log("-- Entered VALIDATION_LOG block", e);
      validationLogs.push({
        stage: (e as any).stage,
        chunk: (e as any).chunk,
        ok: (e as any).ok,
        message: (e as any).message,
      });
    }
  }

  if (!validationLogs.length) {
    const lastArtifacts = events
      .filter((e: any) => e?.type === "result" && e?.artifacts)
      .slice(-1)[0]?.artifacts;
    if (lastArtifacts?.validation_logs?.length) {
      validationLogs.push(...lastArtifacts.validation_logs);
    }
  }

  const workflowSteps = STEP_ORDER.map((s) => ({
    id: s.id,
    label: s.label,
    status: steps[s.id],
    detail:
      // take the last matching process entry detail for this step
      processEntries
        .slice()
        .reverse()
        .find((p) => p?.id === s.id)
        ?.details?.join(" \n") || undefined,
  }));

  // Fallback: if backend never emitted a final `result` with artifacts
  // but all known workflow steps are marked done, treat the run as done.
  if (
    workflowState !== "done" &&
    Object.values(steps).every((s) => s === "done")
  ) {
    workflowState = "done";
    thinkingMessage = "";
    console.log("Fallback: all steps done — marking workflow as done.");
  }

  const liveMessage = buildLiveWorkflowMessage(steps, workflowState);

  const actions: AssistantAction[] = [];
  const dlHref = excelPathOrUrl ? toDownloadHref(excelPathOrUrl) : "";
  if (dlHref) {
    actions.push({
      id: "download_excel",
      label: "Download Excel",
      variant: "primary",
      href: dlHref,
      download: true,
      disabled: false,
    });
  }
  if (exportPayload) {
    actions.push({
      id: "export_xlsx",
      label: "Export XLSX",
      variant: "secondary",
      type: "export_xlsx",
      payload: exportPayload,
      disabled: false,
    });
  }
  const flowExport = buildSingleExportPayload(
    "Flowrate",
    flowrate?.preview ?? [],
    fileName,
    "flowrate",
  );
  if (flowExport) {
    actions.push({
      id: "export_flowrate",
      label: "Export Flowrate (XLSX)",
      variant: "ghost",
      type: "export_xlsx",
      payload: flowExport,
      disabled: false,
    });
  }

  const clrExport = buildSingleExportPayload(
    "Credit Loss Rate",
    creditLossRate?.preview ?? [],
    fileName,
    "credit_loss_rate",
  );
  if (clrExport) {
    actions.push({
      id: "export_credit_loss_rate",
      label: "Export Credit Loss (XLSX)",
      variant: "ghost",
      type: "export_xlsx",
      payload: clrExport,
      disabled: false,
    });
  }

  const sections: AssistantSection[] = [];

  // DEBUG: report what artifacts we detected (helps debug missing tables)
  try {
    console.log("Builder state:", {
      workflowState,
      fileName,
      hasFlowrate: Boolean(flowrate?.preview?.length),
      hasCreditLossRate: Boolean(creditLossRate?.preview?.length),
      summaryText: Boolean(summaryText),
    });
  } catch {}

  const isThinkingOnly =
    Boolean(thinkingMessage) &&
    workflowState !== "done" &&
    workflowState !== "error";
  if (isThinkingOnly) {
    sections.push({
      id: makeId(),
      kind: "thinking",
      title: "Thought for a moment",
      content: thinkingMessage,
      open: true,
    });
  } else {
    if (showWorkflow) {
      sections.push({
        id: makeId(),
        kind: "workflow",
        title: "Workflow",
        steps: workflowSteps,
        meta: { fileName, sessionId, state: workflowState, liveMessage },
        open: true,
      });
    }

    // Always show Answer
    sections.push({
      id: makeId(),
      kind: "text",
      title: "Answer",
      pill: workflowState,
      content: latestAnswer || thinkingMessage || "…",
      open: true,
    });
  }

  const isDone = workflowState === "done";

  /**
   * Visualization mode:
   * - Show ONLY Answer + Chart (no tables, no summary)
   */
  if (showVisualization) {
    if (isThinkingOnly) {
      return {
        title: "Thinking…",
        subtitle: "Working on it",
        sections,
        actions,
        workflowState,
      };
    }
    const chartRows = chartRowsFromArtifacts();

    if (Array.isArray(chartRows) && chartRows.length) {
      sections.push({
        id: makeId(),
        kind: "chart",
        title: "Visualization",
        pill: "viz",
        chartType: "credit_loss_rate",
        data: chartRows,
        open: true,
      });
    } else {
      sections.push({
        id: makeId(),
        kind: "text",
        title: "Visualization",
        pill: "viz",
        content:
          "I couldn’t find Credit Loss Rate rows to visualize. Please run NetFlow first (or ask to re-send the results).",
        open: true,
      });
    }

    const title =
      workflowState === "done"
        ? "Run completed"
        : workflowState === "error"
          ? "Run failed"
          : workflowState === "awaiting_upload"
            ? "Awaiting upload"
            : "Running…";

    const subtitle =
      fileName && sessionId
        ? `${fileName} · ${workflowState}`
        : sessionId
          ? `${workflowState} · ${String(sessionId).slice(0, 8)}…`
          : workflowState;

    return { title, subtitle, sections, actions, workflowState };
  }

  if (validationLogs.length && !isThinkingOnly) {
    sections.push({
      id: makeId(),
      kind: "table",
      title: "Validation Logs",
      pill: "log",
      totals: { count: validationLogs.length },
      rows: validationLogs,
      columns: uniqCols(validationLogs),
      open: false,
    });
  }

  // Show a brief validation summary immediately after validation completes
  if (validationLogs.length && !isThinkingOnly && workflowState !== "done") {
    const validationSummary =
      summaryText ||
      validationLogs
        .map((v) => `${v.stage ?? "validation"}: ${v.message ?? "ok"}`)
        .join("\n");
    sections.push({
      id: makeId(),
      kind: "summary",
      title: "Validation Summary",
      content: validationSummary,
      open: false,
    });
  }

  // Surface process entries (all process_step / chunk events) as a table
  if (processEntries.length && !isThinkingOnly) {
    const procRows = processEntries.map((p) => ({
      id: p.id,
      title: p.title,
      stage: p.stage,
      status: p.status,
      details: Array.isArray(p.details)
        ? p.details.join(" \n")
        : p.details || "",
      chunk: p.chunk,
      total_chunks: p.total_chunks,
    }));
    sections.push({
      id: makeId(),
      kind: "table",
      title: "Process",
      pill: "process",
      totals: { count: procRows.length },
      rows: procRows,
      columns: uniqCols(procRows),
      open: false,
    });
  }

  /**
   * ✅ If tables are disabled (explain output)
   * keep Answer only (and optional Summary if non-duplicate)
   */
  if (!showTables) {
    if (isThinkingOnly) {
      return {
        title: "Thinking…",
        subtitle: "Working on it",
        sections,
        actions,
        workflowState,
      };
    }
    const title =
      workflowState === "done"
        ? "Run completed"
        : workflowState === "error"
          ? "Run failed"
          : workflowState === "awaiting_upload"
            ? "Awaiting upload"
            : "Running…";

    const subtitle =
      fileName && sessionId
        ? `${fileName} · ${workflowState}`
        : sessionId
          ? `${workflowState} · ${String(sessionId).slice(0, 8)}…`
          : workflowState;

    return { title, subtitle, sections, actions };
  }

  // Default rendering with tables
  if (isDone) {
    if (flowrate?.preview?.length) {
      sections.push({
        id: makeId(),
        kind: "table",
        title: "Flowrate Approach",
        pill: "result",
        totals: flowrate?.totals ?? {},
        rows: flowrate.preview ?? [],
        columns: uniqCols(flowrate.preview ?? []),
        actions: flowExport
          ? [
              {
                id: "export_flowrate_table",
                label: "Export Flowrate (XLSX)",
                variant: "ghost",
                type: "export_xlsx",
                payload: flowExport,
                disabled: false,
              },
            ]
          : [],
        open: true,
      });
    }

    if (creditLossRate?.preview?.length) {
      sections.push({
        id: makeId(),
        kind: "table",
        title: "Credit Loss Rate Approach",
        pill: "result",
        totals: creditLossRate?.totals ?? {},
        rows: creditLossRate.preview ?? [],
        columns: uniqCols(creditLossRate.preview ?? []),
        actions: clrExport
          ? [
              {
                id: "export_credit_loss_table",
                label: "Export Credit Loss (XLSX)",
                variant: "ghost",
                type: "export_xlsx",
                payload: clrExport,
                disabled: false,
              },
            ]
          : [],
        open: true,
      });
    }
    if (summaryText || chartRowsFromArtifacts().length) {
      sections.push({
        id: makeId(),
        kind: "summary",
        title: "Summary",
        content: summaryText,
        chartData: chartRowsFromArtifacts(),
        open: true,
      });
    }
  } else {
    if (lastOutput === "flowrate" && flowrate?.preview?.length) {
      sections.push({
        id: makeId(),
        kind: "table",
        title: "Flowrate Approach",
        pill: "stream",
        totals: flowrate?.totals ?? {},
        rows: flowrate.preview ?? [],
        columns: uniqCols(flowrate.preview ?? []),
        open: true,
      });
    }

    if (lastOutput === "credit_loss_rate" && creditLossRate?.preview?.length) {
      sections.push({
        id: makeId(),
        kind: "table",
        title: "Credit Loss Rate Approach",
        pill: "stream",
        totals: creditLossRate?.totals ?? {},
        rows: creditLossRate.preview ?? [],
        columns: uniqCols(creditLossRate.preview ?? []),
        open: true,
      });
    }
  }

  const title =
    workflowState === "done"
      ? "Run completed"
      : workflowState === "error"
        ? "Run failed"
        : workflowState === "awaiting_upload"
          ? "Awaiting upload"
          : "Running…";

  const subtitle =
    fileName && sessionId
      ? `${fileName} · ${workflowState}`
      : sessionId
        ? `${workflowState} · ${String(sessionId).slice(0, 8)}…`
        : workflowState;

  return { title, subtitle, sections, actions, workflowState };
}
