// # file: src/features/chatbot/components/ChatThread.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import type {
  ChatMessage,
  AssistantMsg,
  AssistantAction,
  AssistantSection,
} from "../../pages/chatbot/chatbot.types";
import { fmtForTableCell } from "../../pages/chatbot/useAiResponseStream";
import { Markdown } from "./Markdown";
import CreditLossRateCharts from "../asa/graph/CreditLossRateCharts";

async function exportToXlsx(payload: {
  sheets: { name: string; rows: Record<string, any>[] }[];
  suggestedName?: string;
}) {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    (payload.sheets || []).forEach((sheet) => {
      const ws = XLSX.utils.json_to_sheet(sheet.rows || []);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name || "Sheet");
    });
    const name = payload.suggestedName || "ecl_results.xlsx";
    XLSX.writeFile(wb, name);
  } catch (err) {
    console.error("XLSX export failed:", err);
    window.alert(
      "XLSX export failed. Please ensure the 'xlsx' package is installed.",
    );
  }
}

function Bubble({
  children,
  align,
  fullWidth,
}: {
  children: React.ReactNode;
  align: "left" | "right";
  fullWidth?: boolean;
}) {
  return (
    <div
      className={align === "right" ? "flex justify-end" : "flex justify-start"}
    >
      <div
        className={[
          fullWidth ? "w-full" : "max-w-[900px]",
          "rounded-2xl px-4 py-3",
          align === "right"
            ? "border border-yellow-500 text-gray-900"
            : "bg-white text-gray-900",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

function ActionButtons({
  msg,
  onAction,
}: {
  msg: AssistantMsg;
  onAction?: (action: AssistantAction) => void;
}) {
  const actions: AssistantAction[] = msg.actions ?? [];
  if (!actions.length) return null;

  const exportActions = actions.filter((a) => a.type === "export_xlsx");
  const otherActions = actions.filter((a) => a.type !== "export_xlsx");

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!exportRef.current) return;
      if (!exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const base = "px-3 py-2 rounded-xl text-sm border flex items-center";

  return (
    <div className="flex flex-wrap gap-2 items-start relative">
      {/* Export dropdown (single entry) */}
      {exportActions.length > 0 && (
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            className={`${base} bg-white border-gray-200 text-gray-700 hover:bg-gray-50`}
            onClick={() => setExportOpen((s) => !s)}
            aria-expanded={exportOpen}
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Export
          </button>

          {exportOpen && (
            <div className="absolute left-0 mt-2 w-48 rounded-md border bg-white shadow-lg z-50 origin-top-left">
              {exportActions.map((a) => (
                <button
                  key={a.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={(e) => {
                    e.preventDefault();
                    setExportOpen(false);
                    if (a.payload?.sheets?.length) {
                      void exportToXlsx(a.payload);
                    } else {
                      window.alert("No export data available yet.");
                    }
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Other actions (links / send_message / generic) */}
      {otherActions.map((a) => {
        const variant = a.variant ?? "secondary";
        const theme =
          variant === "primary"
            ? "bg-yellow-500 border-yellow-500 text-gray-900 hover:bg-yellow-400"
            : variant === "ghost"
              ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              : "bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200";
        const cls = [
          base,
          theme,
          a.disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ");

        if (a.href) {
          return (
            <a
              key={a.id}
              href={a.href}
              className={cls}
              {...(a.download ? { download: "" } : {})}
              onClick={(e) => {
                if (a.disabled) e.preventDefault();
              }}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              {a.label}
            </a>
          );
        }

        if (a.type === "send_message") {
          return (
            <button
              key={a.id}
              type="button"
              disabled={!!a.disabled}
              className={cls}
              onClick={(e) => {
                e.preventDefault();
                if (a.disabled) return;
                onAction?.(a);
              }}
            >
              {a.label}
            </button>
          );
        }

        return (
          <button
            key={a.id}
            type="button"
            disabled={!!a.disabled}
            className={cls}
            onClick={(e) => e.preventDefault()}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}

function CompactCard({
  title,
  pill,
  children,
  openDefault,
}: {
  title: string;
  pill?: string;
  children: React.ReactNode;
  openDefault?: boolean;
}) {
  const [open, setOpen] = useState(openDefault ?? true);

  return (
    <div className=" rounded-2xl bg-white overflow-hidden w-full">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50"
      >
        <div className="min-w-0 flex items-center gap-2">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {title}
          </div>
          {pill ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full  text-gray-600 bg-white">
              {pill}
            </span>
          ) : null}
        </div>
        <div className="text-xs text-gray-500">{open ? "▲" : "▼"}</div>
      </button>

      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function LiveChecklistCard({ text }: { text: string }) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  return (
    <div className="rounded-2xl  bg-gray-50 p-3">
      <div className="text-xs font-semibold text-gray-700">Progress</div>
      <div className="mt-2 space-y-1.5">
        {lines.map((line, idx) => {
          const parts = line.split(" ");
          const first = parts[0] || "•";
          const rest = line.slice(first.length).trim();

          return (
            <div key={idx} className="flex items-start gap-2">
              <div className="mt-[1px] text-sm leading-none">{first}</div>
              <div className="text-sm text-gray-800">{rest}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkflowBar({
  s,
}: {
  s: Extract<AssistantSection, { kind: "workflow" }>;
}) {
  const statusStyle = (st: string) => {
    if (st === "done") return "bg-emerald-500 border-emerald-500";
    if (st === "running") return "bg-yellow-500 border-yellow-500";
    if (st === "error") return "bg-red-500 border-red-500";
    return "bg-gray-200 border-gray-300";
  };

  return (
    <div className="space-y-3">
      {s.meta?.fileName ? (
        <div className="text-xs text-gray-600">
          File:{" "}
          <span className="font-medium text-gray-900">{s.meta.fileName}</span>
          {s.meta?.sessionId ? (
            <span className="text-gray-400">
              {" "}
              · {String(s.meta.sessionId).slice(0, 8)}…
            </span>
          ) : null}
        </div>
      ) : null}

      {s.meta?.liveMessage ? (
        <LiveChecklistCard text={s.meta.liveMessage} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {s.steps.map((st) => (
          <div
            key={st.id}
            className="flex items-center gap-2 px-3 py-2 rounded-xl  bg-white"
          >
            <div
              className={[
                "w-2.5 h-2.5 rounded-full",
                statusStyle(st.status),
              ].join(" ")}
            />
            <div className="text-xs font-medium text-gray-800">{st.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyValueTotals({ totals }: { totals?: Record<string, any> }) {
  const entries = Object.entries(totals ?? {});
  if (!entries.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl  bg-white px-3 py-2">
          <div className="text-[11px] text-gray-500 truncate">{k}</div>
          <div className="text-sm font-semibold text-gray-900 truncate">
            {fmtForTableCell(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, any>[];
}) {
  return (
    <div className=" rounded-2xl overflow-hidden w-full">
      <div className="max-h-[280px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="text-left font-semibold text-gray-700 px-3 py-2 whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className=" hover:bg-gray-50">
                {columns.map((c) => (
                  <td
                    key={c}
                    className="px-3 py-2 whitespace-nowrap text-gray-900"
                  >
                    {fmtForTableCell((r as any)[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length ? (
          <div className="p-4 text-sm text-gray-500">No rows.</div>
        ) : null}
      </div>
    </div>
  );
}

function SectionRenderer({
  section,
  onAction,
}: {
  section: AssistantSection;
  onAction?: (action: AssistantAction) => void;
}) {
  if (section.kind === "workflow") {
    return (
      <CompactCard
        title={section.title ?? "Workflow"}
        pill={section.meta?.state}
        openDefault={true}
      >
        <WorkflowBar s={section} />
      </CompactCard>
    );
  }

  if (section.kind === "text") {
    return (
      <CompactCard
        title={section.title}
        pill={section.pill}
        openDefault={section.open ?? false}
      >
        <div className="text-sm text-gray-800 leading-relaxed">
          <Markdown>{String(section.content ?? "")}</Markdown>
        </div>
      </CompactCard>
    );
  }

  if (section.kind === "thinking") {
    return (
      <CompactCard
        title={section.title}
        pill="thinking"
        openDefault={section.open ?? true}
      >
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          <span className="inline-flex items-center gap-2">
            <span className="animate-pulse text-gray-500">● ● ●</span>
            <span>{String(section.content ?? "")}</span>
          </span>
        </div>
      </CompactCard>
    );
  }

  if (section.kind === "table") {
    const cols =
      section.columns ??
      (section.rows?.[0] ? Object.keys(section.rows[0]) : []);
    const hasParData = cols.some(
      (col) =>
        col.toLowerCase().includes("par") ||
        col.toLowerCase().includes("credit loss"),
    );

    return (
      <CompactCard
        title={section.title}
        pill={section.pill}
        openDefault={section.open ?? true}
      >
        <div className="space-y-3 w-full">
          {section.actions?.length ? (
            <ActionButtons
              msg={{ actions: section.actions } as AssistantMsg}
              onAction={onAction}
            />
          ) : null}
          <KeyValueTotals totals={section.totals} />
          {hasParData && section.rows?.length ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">
                  Visualization
                </h4>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">
                  Data
                </h4>
                <DataTable columns={cols} rows={section.rows ?? []} />
              </div>
            </div>
          ) : (
            <DataTable columns={cols} rows={section.rows ?? []} />
          )}
        </div>
      </CompactCard>
    );
  }

  if (section.kind === "chart") {
    return (
      <CompactCard
        title={section.title}
        pill={section.pill}
        openDefault={section.open ?? true}
      >
        <CreditLossRateCharts data={section.data ?? []} />
      </CompactCard>
    );
  }

  if (section.kind === "summary") {
    return (
      <CompactCard
        title={section.title}
        pill="final"
        openDefault={section.open ?? true}
      >
        <div className="space-y-4">
          {section.content ? (
            <div className="text-sm text-gray-800 leading-relaxed">
              <Markdown>{String(section.content ?? "")}</Markdown>
            </div>
          ) : null}
          {section.flowratePreview?.length ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-3">
                Flowrate Preview
              </h4>
              <DataTable
                columns={Object.keys(section.flowratePreview[0])}
                rows={section.flowratePreview}
              />
            </div>
          ) : null}
          {section.creditLossRatePreview?.length ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-3">
                Credit Loss Rate Preview
              </h4>
              <DataTable
                columns={Object.keys(section.creditLossRatePreview[0])}
                rows={section.creditLossRatePreview}
              />
            </div>
          ) : null}
          {section.chartData?.length ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-3">
                Visualization
              </h4>
              <CreditLossRateCharts data={section.chartData ?? []} />
            </div>
          ) : null}
        </div>
      </CompactCard>
    );
  }

  return null;
}

export function ChatThread({
  messages,
  onAction,
}: {
  messages: ChatMessage[];
  onAction?: (action: AssistantAction) => void;
}) {
  const list = useMemo(() => messages ?? [], [messages]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [list.length]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto px-4 sm:px-6 py-6 space-y-4"
      onScroll={() => {
        const el = containerRef.current;
        if (!el) return;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        isNearBottomRef.current = distance < 80;
      }}
    >
      {list.map((m: any) => {
        if (m.role === "user") {
          return (
            <Bubble key={m.id} align="right">
              <div className="text-sm text-gray-900 leading-relaxed">
                <Markdown>{String(m.content ?? "")}</Markdown>
              </div>
            </Bubble>
          );
        }

        const am = m as AssistantMsg;

        return (
          <Bubble key={am.id} align="left" fullWidth>
            <div className="space-y-3 w-full">
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {am.title ?? "Assistant"}
                </div>
                {am.subtitle ? (
                  <div className="text-xs text-gray-500">
                    {am.subtitle}
                    {am.isStreaming ? " ⏳" : ""}
                  </div>
                ) : null}
              </div>

              <ActionButtons msg={am} onAction={onAction} />

              <div className="space-y-2 w-full">
                {(am.sections ?? []).map((s: any) => (
                  <SectionRenderer key={s.id} section={s} onAction={onAction} />
                ))}
              </div>
            </div>
          </Bubble>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
