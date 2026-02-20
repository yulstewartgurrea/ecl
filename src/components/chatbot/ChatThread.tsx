// # file: src/features/chatbot/components/ChatThread.tsx
import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import type {
  ChatMessage,
  AssistantMsg,
  AssistantAction,
  AssistantSection,
} from "../../pages/chatbot/chatbot.types";

import { Markdown } from "./Markdown";
import {
  Bubble,
  ActionButtons,
  CompactCard,
  WorkflowBar,
  KeyValueTotals,
  DataTable,
} from "./ChatHelpers";

import Typewriter from "../Typewriter";
import CreditLossRateCharts from "../asa/graph/CreditLossRateCharts";

/** Typed sections we animate. */
function isTextLikeSection(kind: string) {
  return kind === "text" || kind === "summary";
}

/** Allow advance when workflow reports completion. */
function isWorkflowDone(state: unknown) {
  const s = String(state ?? "")
    .toLowerCase()
    .trim();
  return (
    s === "done" || s === "success" || s === "complete" || s === "completed"
  );
}

function SectionRenderer({
  section,
  onAction,
  useTypewriter = true,
  isNewestMessage = false,
  isCurrent = false,
  onTypewriterStart,
  onTypewriterDone,
}: {
  section: AssistantSection;
  onAction?: (action: AssistantAction) => void;
  useTypewriter?: boolean;
  isNewestMessage?: boolean;
  isCurrent?: boolean; // current gated section
  onTypewriterStart?: () => void;
  onTypewriterDone?: () => void;
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
    const content = String(section.content ?? "");
    const shouldType = useTypewriter && isNewestMessage && isCurrent;
    return (
      <CompactCard
        title={section.title}
        pill={section.pill}
        openDefault={section.open ?? false}
      >
        <div className="text-sm text-gray-800 leading-relaxed">
          {shouldType ? (
            <Typewriter
              text={content}
              enabled={true}
              speed={10}
              jitter={3}
              // continueOnAppend is supported by the improved Typewriter.tsx I sent
              // @ts-ignore
              continueOnAppend={true}
              renderText={(d) => <Markdown>{d}</Markdown>}
              onStart={onTypewriterStart}
              onDone={onTypewriterDone}
            />
          ) : (
            <Markdown>{content}</Markdown>
          )}
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
    const content = String(section.content ?? "");
    const shouldType = useTypewriter && isNewestMessage && isCurrent;
    return (
      <CompactCard
        title={section.title}
        pill="final"
        openDefault={section.open ?? true}
      >
        <div className="space-y-4">
          {section.content ? (
            <div className="text-sm text-gray-800 leading-relaxed">
              {shouldType ? (
                <Typewriter
                  text={content}
                  enabled={true}
                  speed={10}
                  jitter={3}
                  // @ts-ignore
                  continueOnAppend={true}
                  renderText={(d) => <Markdown>{d}</Markdown>}
                  onStart={onTypewriterStart}
                  onDone={onTypewriterDone}
                />
              ) : (
                <Markdown>{content}</Markdown>
              )}
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
  typewriterEnabled = true,
  onTypewriterActiveChange,
  sequentialAccordions = true, // default on
}: {
  messages: ChatMessage[];
  onAction?: (action: AssistantAction) => void;
  typewriterEnabled?: boolean;
  onTypewriterActiveChange?: (active: boolean) => void;
  sequentialAccordions?: boolean;
}) {
  const list = useMemo(() => messages ?? [], [messages]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  /** Track active typewriter count so ChatbotPage can disable composer while typing. */
  const activeCountRef = useRef(0);
  const [typingActive, setTypingActive] = useState(false);

  const signalTypewriterStart = useCallback(() => {
    activeCountRef.current += 1;
    if (activeCountRef.current === 1) {
      onTypewriterActiveChange?.(true);
      setTypingActive(true);
    }
  }, [onTypewriterActiveChange]);

  const signalTypewriterDone = useCallback(() => {
    activeCountRef.current = Math.max(0, activeCountRef.current - 1);
    if (activeCountRef.current === 0) {
      onTypewriterActiveChange?.(false);
      setTypingActive(false);
    }
  }, [onTypewriterActiveChange]);

  /** Identify newest assistant message (we only gate + typewriter that one). */
  const lastAssistantId = useMemo(() => {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const m: any = list[i];
      if (m?.role === "assistant") return m.id as string;
    }
    return undefined;
  }, [list]);

  const newestAssistant = useMemo(() => {
    if (!lastAssistantId) return null;
    const found = list.find(
      (m: any) => m?.role === "assistant" && m.id === lastAssistantId,
    );
    return (found as AssistantMsg) ?? null;
  }, [list, lastAssistantId]);

  const newestSections = (newestAssistant?.sections ??
    []) as AssistantSection[];

  /**
   * ✅ IMPORTANT change:
   * Gate the newest assistant message whether streaming or not.
   * This lets us reveal sections sequentially even if backend sends everything at once.
   */
  const gatingOn = !!sequentialAccordions && !!lastAssistantId;

  /** For gating: store gatedMsgId + visibleCount. */
  const [gatedMsgId, setGatedMsgId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  // Track previous gated message to avoid unnecessary resets
  const prevGatedMsgIdRef = useRef<string | null>(null);

  /**
   * Initialize or reset gating ONLY when the newest assistant message id changes,
   * or when gating is turned off completely.
   */
  useEffect(() => {
    if (!gatingOn || !lastAssistantId) {
      prevGatedMsgIdRef.current = null;
      setGatedMsgId(null);
      setVisibleCount(0);

      // Ensure we don't leave typewriterActive stuck
      activeCountRef.current = 0;
      onTypewriterActiveChange?.(false);
      return;
    }

    if (prevGatedMsgIdRef.current !== lastAssistantId) {
      prevGatedMsgIdRef.current = lastAssistantId;
      setGatedMsgId(lastAssistantId);
      // Always start by revealing the first section (even if we already have many)
      setVisibleCount(newestSections.length > 0 ? 1 : 0);

      // Reset typewriter active when a new run starts
      activeCountRef.current = 0;
      onTypewriterActiveChange?.(false);
    }
  }, [
    gatingOn,
    lastAssistantId,
    newestSections.length,
    onTypewriterActiveChange,
  ]);

  /** Clamp visibleCount if the number of sections shrinks; keep as-is if it grows. */
  useEffect(() => {
    if (!gatingOn || !gatedMsgId) return;
    setVisibleCount((c) => {
      // If we previously had nothing visible but sections just arrived,
      // initialize to reveal the first section rather than leaving blank.
      if (c === 0 && newestSections.length > 0) return 1;
      return Math.min(c, newestSections.length);
    });
  }, [gatingOn, gatedMsgId, newestSections.length]);

  /** Scroll in sync with sequential reveal so auto-scroll doesn't jump ahead. */
  useEffect(() => {
    if (!gatedMsgId) return;
    // Only auto-scroll when user is near bottom
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [gatedMsgId, visibleCount]);

  /** Keep scrolling to bottom while typing is active so the composer stays in view. */
  useEffect(() => {
    let rafId: number | null = null;
    const loop = () => {
      if (isNearBottomRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }
      rafId = requestAnimationFrame(loop);
    };

    if (typingActive) {
      // start loop
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      // final smooth align when typing stops
      if (!typingActive && isNearBottomRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    };
  }, [typingActive]);

  /** Advance to next section (bounded). */
  const advance = useCallback(() => {
    if (!gatingOn || !gatedMsgId) return;
    setVisibleCount((c) => Math.min(c + 1, newestSections.length));
  }, [gatingOn, gatedMsgId, newestSections.length]);

  /**
   * Auto-advance non-text sections so we don't get stuck.
   * Also auto-advance text-like sections when typewriter is disabled (reduced motion).
   */
  useEffect(() => {
    if (!gatingOn || !gatedMsgId) return;
    if (visibleCount <= 0) return;
    if (visibleCount >= newestSections.length) return;

    const currentIndex = visibleCount - 1;
    const current = newestSections[currentIndex];
    if (!current) return;

    // Text-like sections:
    if (isTextLikeSection(current.kind)) {
      const content = String((current as any).content ?? "").trim();

      // if empty, don't deadlock
      if (content.length === 0) {
        const t = setTimeout(() => advance(), 60);
        return () => clearTimeout(t);
      }

      // if typewriter disabled (e.g., reduced motion), still do sequential:
      if (!typewriterEnabled) {
        const t = setTimeout(() => advance(), 140);
        return () => clearTimeout(t);
      }

      // otherwise, wait for Typewriter onDone
      return;
    }

    // Workflow: advance only if done
    if (current.kind === "workflow") {
      if (isWorkflowDone(current.meta?.state)) {
        const t = setTimeout(() => advance(), 150);
        return () => clearTimeout(t);
      }
      return;
    }

    // Other kinds: short dwell for smooth pacing
    const dwell = current.kind === "thinking" ? 220 : 140;
    const t = setTimeout(() => advance(), dwell);
    return () => clearTimeout(t);
  }, [
    gatingOn,
    gatedMsgId,
    visibleCount,
    newestSections,
    advance,
    typewriterEnabled,
  ]);

  /** Smooth auto-scroll if user is near bottom. */
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [list.length]);

  /** Cleanup: don't leave "typing active" stuck true on unmount. */
  useEffect(() => {
    return () => {
      activeCountRef.current = 0;
      onTypewriterActiveChange?.(false);
    };
  }, [onTypewriterActiveChange]);

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
        const isNewestMessage = am.id === lastAssistantId;
        const allSections = (am.sections ?? []) as AssistantSection[];

        /** Apply sequential gating ONLY to newest assistant message (streaming or not). */
        const shouldGate = gatingOn && isNewestMessage && gatedMsgId === am.id;

        /** Hide upcoming sections (hindi muna magpakita). */
        const shownSections = shouldGate
          ? allSections.slice(
              0,
              Math.max(0, Math.min(visibleCount, allSections.length)),
            )
          : allSections;

        return (
          <Bubble key={am.id} align="left" fullWidth>
            <div className="space-y-3 w-full">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {am.meta?.status === "uploading" ? (
                    <CloudArrowUpIcon className="h-5 w-5 text-yellow-500" />
                  ) : am.meta?.status === "success" ? (
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                  ) : am.meta?.status === "error" ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                  ) : null}

                  <div className="text-sm font-semibold">
                    {am.title ?? "Assistant"}
                  </div>
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
                {shownSections.map((s: any, idx: number) => {
                  // Current gated section = last visible one
                  const isCurrent =
                    shouldGate && idx === shownSections.length - 1;

                  const handleDone = () => {
                    signalTypewriterDone();
                    // Reveal next when the current typed section finishes.
                    if (shouldGate) advance();
                  };

                  return (
                    <SectionRenderer
                      key={s.id}
                      section={s}
                      onAction={onAction}
                      useTypewriter={typewriterEnabled}
                      isNewestMessage={isNewestMessage}
                      isCurrent={isCurrent}
                      onTypewriterStart={signalTypewriterStart}
                      onTypewriterDone={handleDone}
                    />
                  );
                })}
              </div>
            </div>
          </Bubble>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
``;
