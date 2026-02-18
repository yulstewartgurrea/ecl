// # file: src/features/chatbot/ChatbotPage.tsx
import { useEffect, useRef, useState } from "react";

import type {
  ChatThread,
  UploadedFile,
  ChatMessage,
  StreamEvent,
} from "./chatbot.types";
import {
  buildAccordionFromEvents,
  createStreamingAssistantMsg,
  JsonObjectStreamParser,
} from "./useAiResponseStream";

import {
  uploadEclFile,
  streamEcl,
  messageEcl,
} from "../../features/chatbot/deepagentsEcl.api";

import { ChatSidebar } from "../../components/chatbot/ChatSidebar";
import { ChatThread as ChatThreadView } from "../../components/chatbot/ChatThread";
import { ChatComposer } from "../../components/chatbot/ChatComposer";
import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import { updateModuleData } from "../../redux_toolkit/features/workflow/workflowSlice";

const SAM_INTRO = `Hi! I’m **Sam 👩🏻‍🦰** — I can help you run **NetFlow**, **Probability of Default (PD)**, or **Overlay / ECL**.

### Choose what you want to calculate:
- **Net Flow Approach**
- **PD Transaction**
- **Overlay**
`;

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function ensureSessionId(thread: ChatThread) {
  return thread.session_id ?? makeId();
}

function normalizeMessageResponseToEvents(resp: any): StreamEvent[] {
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

function createNewThread(): ChatThread {
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

function isVisualizationRequest(text: string) {
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

export default function ChatbotPage() {
  const dispatch = useAppDispatch();
  const threads = useAppSelector(
    (s) => (s.workflow.modules.chatbot.data.threads ?? []) as ChatThread[],
  );
  const activeId = useAppSelector(
    (s) => (s.workflow.modules.chatbot.data.activeId ?? null) as string | null,
  );
  const tokenai = useAppSelector((s) => s.auth.tokenai);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const uploadMsgIdRef = useRef<string | null>(null);

  const abortCtrlRef = useRef<AbortController | null>(null);
  const threadsRef = useRef<ChatThread[]>(threads);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    if (threads.length === 0) {
      const t = createNewThread();
      dispatch(
        updateModuleData({
          moduleId: "chatbot",
          data: { threads: [t], activeId: t.id },
        }),
      );
    }
  }, [dispatch, threads.length]);

  const activeThread = threads.find((t) => t.id === activeId) ?? null;

  const mutateThread = (id: string, fn: (t: ChatThread) => ChatThread) => {
    const current = threadsRef.current;
    const next = current.map((t) => (t.id === id ? fn(t) : t));
    next.sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return b.updatedAt - a.updatedAt;
    });
    dispatch(
      updateModuleData({
        moduleId: "chatbot",
        data: { threads: next },
      }),
    );
  };

  const upsertAssistantMessage = (threadId: string, msg: ChatMessage) => {
    mutateThread(threadId, (t) => {
      const has = t.messages.some((m) => m.id === msg.id);
      return {
        ...t,
        updatedAt: Date.now(),
        messages: has
          ? t.messages.map((m) => (m.id === msg.id ? msg : m))
          : [...t.messages, msg],
      };
    });
  };

  const buildUploadResponseContent = (
    uploaded: any,
    fileName: string,
    sessionId: string,
  ) => {
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
        ? `\n\n\`\`\`json\n${JSON.stringify(uploaded, null, 2)}\n\`\`\``
        : "";

    return `${lines.join("\n")}${details}`;
  };

  const onNewChat = () => {
    const t = createNewThread();
    const current = threadsRef.current;
    dispatch(
      updateModuleData({
        moduleId: "chatbot",
        data: { threads: [t, ...current], activeId: t.id },
      }),
    );
  };

  const onDelete = (id: string) => {
    const nextThreads = threads.filter((t) => t.id !== id);
    const nextActive =
      activeId === id ? (nextThreads[0]?.id ?? null) : activeId;
    dispatch(
      updateModuleData({
        moduleId: "chatbot",
        data: { threads: nextThreads, activeId: nextActive },
      }),
    );
  };

  const onRename = (id: string, title: string) => {
    mutateThread(id, (t) => ({ ...t, title, updatedAt: Date.now() }));
  };

  const onTogglePin = (id: string) => {
    mutateThread(id, (t) => ({
      ...t,
      pinned: !t.pinned,
      updatedAt: Date.now(),
    }));
  };

  /**
   * Shared streaming runner (auto-start after upload)
   */
  const runStream = async (
    threadId: string,
    sessionId: string,
    message: string = "start",
    reuseMessageId?: string,
  ) => {
    abortCtrlRef.current?.abort();
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    const runMsg = createStreamingAssistantMsg(makeId);

    if (reuseMessageId) {
      mutateThread(threadId, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: t.messages.map((m: any) =>
          m.id === reuseMessageId
            ? ({ ...runMsg, id: reuseMessageId } as any)
            : m,
        ),
      }));
    } else {
      mutateThread(threadId, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: [...t.messages, runMsg as any],
      }));
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      const res = await streamEcl(
        { session_id: sessionId, message },
        ctrl.signal,
        tokenai,
      );

      const reader = res.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      const parser = new JsonObjectStreamParser();

      const allEvents: StreamEvent[] = [];
      let rawText = "";

      // pacing
      const MIN_RUNNING_MS = 650;
      const MIN_STEP_GAP_MS = 450;

      const stepRunningAt = new Map<string, number>();
      let lastStepStartAt = 0;

      type PendingDone = { ev: any; dueAt: number };
      let pendingDones: PendingDone[] = [];

      const scheduleDone = (ev: any) => {
        const id = ev?.step?.id;
        const startedAt = id ? stepRunningAt.get(id) : undefined;
        const base = startedAt ?? Date.now();
        const dueAt = base + MIN_RUNNING_MS;
        pendingDones.push({ ev, dueAt });
        pendingDones.sort((a, b) => a.dueAt - b.dueAt);
      };

      const flushDueDones = () => {
        const t = Date.now();
        let changed = false;
        while (pendingDones.length && pendingDones[0].dueAt <= t) {
          allEvents.push(pendingDones.shift()!.ev);
          changed = true;
        }
        return changed;
      };

      let stopStreaming = false;

      const render = (streaming: boolean) => {
        const built = buildAccordionFromEvents(allEvents, makeId, {
          showWorkflow: true,
          showTables: true,
        });
        if (!built) return;
        if (built.workflowState === "done") stopStreaming = true;
        console.log("Render called", {
          streaming,
          workflowState: built.workflowState,
          title: built.title,
          subtitle: built.subtitle,
        });
        mutateThread(threadId, (t) => {
          let forcedWorkflowState = built.workflowState;
          return {
            ...t,
            updatedAt: Date.now(),
            last_artifacts:
              allEvents
                .filter((e: any) => e?.type === "result" && e?.artifacts)
                .slice(-1)[0]?.artifacts ?? t.last_artifacts,
            messages: t.messages.map((m: any) => {
              const targetId = reuseMessageId ?? (runMsg as any).id;
              if (m.id !== targetId) return m;
              return {
                ...m,
                title: built.title,
                subtitle: built.subtitle || (streaming ? "Streaming…" : "Done"),
                sections: built.sections,
                actions: built.actions,
                isStreaming: forcedWorkflowState === "done" ? false : streaming,
              };
            }),
          };
        });
      };

      const queue: any[] = [];
      let processing = false;

      const processQueue = async () => {
        if (processing) return;
        processing = true;
        try {
          while (queue.length) {
            const ev = queue.shift();

            if (ev?.type === "step_start" && ev?.step?.id) {
              const t = Date.now();
              const wait = Math.max(0, MIN_STEP_GAP_MS - (t - lastStepStartAt));
              if (wait > 0) await sleep(wait);

              lastStepStartAt = Date.now();
              stepRunningAt.set(ev.step.id, lastStepStartAt);

              allEvents.push(ev);
              render(true);
              continue;
            }

            if (ev?.type === "step_done" && ev?.step?.id) {
              scheduleDone(ev);
              continue;
            }

            allEvents.push(ev);
            render(true);
          }
        } finally {
          processing = false;
        }
      };

      const tick = setInterval(() => {
        if (flushDueDones()) render(true);
      }, 80);

      render(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const remainingEvents = parser.feed("");
          queue.push(...remainingEvents);
          await processQueue();
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        rawText += chunkText;
        const newEvents = parser.feed(chunkText);
        if (!newEvents.length) continue;

        queue.push(...newEvents);
        await processQueue();
        if (stopStreaming) {
          render(false);
          break;
        }
      }

      while (processing || queue.length) {
        await sleep(50);
      }

      while (pendingDones.length) {
        await sleep(100);
        if (flushDueDones()) render(true);
      }

      clearInterval(tick);
      if (allEvents.length === 0 && rawText.trim()) {
        let fallback: any = rawText;
        try {
          fallback = JSON.parse(rawText);
        } catch {}
        const evs = normalizeMessageResponseToEvents(fallback);
        if (evs.length) {
          allEvents.push(...evs);
        }
      }
      render(false);
    } catch (e: any) {
      mutateThread(threadId, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: t.messages.map((m: any) => {
          const targetId = reuseMessageId ?? (runMsg as any).id;
          if (m.id !== targetId) return m;
          return {
            ...m,
            isStreaming: false,
            title: "Something went wrong",
            subtitle: "Error",
            sections: [
              {
                id: makeId(),
                kind: "text",
                title: "Error",
                pill: "error",
                open: true,
                content: String(e?.message ?? e ?? "Unknown error"),
              },
            ],
          };
        }),
      }));
    }
  };

  const getLastAssistantId = (thread: ChatThread) => {
    for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
      const m: any = thread.messages[i];
      if (m?.role === "assistant") return m.id as string;
    }
    return undefined;
  };

  const resumeValidation = async (text: string) => {
    if (!activeThread) return;
    const sessionId = ensureSessionId(activeThread);
    const lastAssistantId = getLastAssistantId(activeThread);
    await runStream(activeThread.id, sessionId, text, lastAssistantId);
  };

  /**
   *  Upload → AUTO START /stream
   */
  const onUploadFiles = async (files: FileList | null) => {
    if (!activeThread || !files || files.length === 0) return;

    const list = Array.from(files);

    const newItems: UploadedFile[] = await Promise.all(
      list.map(async (f) => {
        const item: UploadedFile = {
          id: makeId(),
          name: f.name,
          type: f.type || "unknown",
          size: f.size,
          lastModified: f.lastModified,
        };

        const isTextLike =
          f.type.startsWith("text/") ||
          f.name.endsWith(".json") ||
          f.name.endsWith(".csv") ||
          f.name.endsWith(".md") ||
          f.name.endsWith(".txt");

        if (isTextLike && f.size <= 200_000) {
          try {
            item.textPreview = (await f.text()).slice(0, 900);
          } catch {}
        }

        return item;
      }),
    );

    mutateThread(activeThread.id, (t) => ({
      ...t,
      updatedAt: Date.now(),
      files: [...newItems, ...t.files],
    }));

    const file = list[0];

    try {
      const uploadMsgId = makeId();
      uploadMsgIdRef.current = uploadMsgId;
      setIsUploading(true);
      abortCtrlRef.current?.abort();
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      const session_id = ensureSessionId(activeThread);

      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        session_id,
        file_name: file.name,
        upload_status: "uploading",
        upload_error: null,
        upload_response: null,
      }));

      upsertAssistantMessage(activeThread.id, {
        id: uploadMsgId,
        role: "assistant",
        kind: "accordion",
        title: "Uploading file…",
        subtitle: file.name,
        actions: [],
        sections: [
          {
            id: makeId(),
            kind: "thinking",
            title: "Upload status",
            content: `Uploading **${file.name}** now. Please wait…`,
            open: true,
          },
        ],
        isStreaming: true,
      } as any);

      const uploaded = await uploadEclFile(
        { session_id, file },
        ctrl.signal,
        tokenai,
      );

      const finalSession = uploaded.session_id ?? session_id;
      const finalFileName = uploaded.file_name ?? file.name;

      const uploadResponseContent = buildUploadResponseContent(
        uploaded,
        finalFileName,
        finalSession,
      );

      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        session_id: finalSession,
        file_name: finalFileName,
        has_uploaded_file: true,
        upload_status: "success",
        upload_response: uploaded ?? null,
      }));

      const successMsgId = uploadMsgIdRef.current ?? makeId();
      upsertAssistantMessage(activeThread.id, {
        id: successMsgId,
        role: "assistant",
        kind: "accordion",
        title: "Upload complete ✅",
        subtitle: "I’ll start the calculations now…",
        actions: [],
        sections: [
          {
            id: makeId(),
            kind: "text",
            title: "Uploaded",
            pill: "upload",
            open: true,
            content: `Nice, I received **${finalFileName}**.\nStarting calculations now…`,
          },
          {
            id: makeId(),
            kind: "text",
            title: "Upload response",
            pill: "result",
            open: true,
            content: uploadResponseContent,
          },
        ],
        isStreaming: false,
      } as any);

      // ✅ auto run stream
      await runStream(activeThread.id, finalSession, "start");
    } catch (e: any) {
      const errorMessage = String(e?.message ?? e ?? "Upload error");
      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        upload_status: "error",
        upload_error: errorMessage,
      }));

      const failMsgId = uploadMsgIdRef.current ?? makeId();
      upsertAssistantMessage(activeThread.id, {
        id: failMsgId,
        role: "assistant",
        kind: "accordion",
        title: "Upload failed",
        subtitle: "Let’s try again",
        sections: [
          {
            id: makeId(),
            kind: "text",
            title: "Error",
            pill: "error",
            open: true,
            content: errorMessage,
          },
        ],
        isStreaming: false,
      } as any);

      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        has_uploaded_file: false,
      }));
    } finally {
      setIsUploading(false);
    }
  };

  /**
   *  Send button ALWAYS uses /message
   *  Visualization request: Answer + Chart only (no tables/summary)
   */
  const onSend = async (text: string) => {
    if (!activeThread) return;

    abortCtrlRef.current?.abort();
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    setIsSending(true);

    const normalized = text.trim().toLowerCase();
    if (normalized === "yes" || normalized === "continue all") {
      try {
        await resumeValidation(normalized);
      } finally {
        setIsSending(false);
      }
      return;
    }

    const userMsg: ChatMessage = { id: makeId(), role: "user", content: text };
    const assistant = createStreamingAssistantMsg(makeId);

    const sessionId = ensureSessionId(activeThread);
    if (!activeThread.session_id) {
      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        session_id: sessionId,
      }));
    }

    const shouldUpdateTitle =
      normalized !== "yes" && normalized !== "continue all";

    mutateThread(activeThread.id, (t) => ({
      ...t,
      updatedAt: Date.now(),
      title: shouldUpdateTitle
        ? text.slice(0, 40).trim() || "New chat"
        : t.title,
      messages: [...t.messages, userMsg, assistant as any],
    }));

    try {
      const resp = await messageEcl(
        { session_id: sessionId, message: text },
        ctrl.signal,
        tokenai,
      );
      const events = normalizeMessageResponseToEvents(resp);

      // cache artifacts (if any)
      const lastArtifacts =
        events
          .filter((e: any) => e?.type === "result" && e?.artifacts)
          .slice(-1)[0]?.artifacts ?? null;

      // Visualization mode: show chart, hide tables & summary
      const wantsViz = isVisualizationRequest(text);

      const built = buildAccordionFromEvents(events, makeId, {
        showWorkflow: false,
        showTables: !wantsViz,
        showVisualization: wantsViz,
      });

      mutateThread(activeThread.id, (t) => {
        const fallbackArtifacts = lastArtifacts ?? t.last_artifacts;

        // If user asked for viz but backend didn't re-send artifacts,
        // create a synthetic "result" event using cached artifacts.
        let finalBuilt = built;

        if (wantsViz) {
          const hasVizData = (events || []).some(
            (e: any) =>
              e?.type === "result" &&
              e?.artifacts?.credit_loss_rate?.preview?.length,
          );

          if (
            !hasVizData &&
            fallbackArtifacts?.credit_loss_rate?.preview?.length
          ) {
            finalBuilt = buildAccordionFromEvents(
              [
                ...events,
                {
                  type: "result",
                  workflow_state: resp?.workflow_state ?? "done",
                  answer: (resp?.answer ?? "") || "",
                  artifacts: fallbackArtifacts,
                } as any,
              ],
              makeId,
              {
                showWorkflow: false,
                showTables: false,
                showVisualization: true,
              },
            );
          }
        }

        return {
          ...t,
          updatedAt: Date.now(),
          last_artifacts: fallbackArtifacts,
          messages: t.messages.map((m: any) => {
            if (m.id !== (assistant as any).id) return m;
            if (!finalBuilt) return m;
            return {
              ...m,
              title: finalBuilt!.title,
              subtitle:
                finalBuilt!.subtitle || String(resp?.workflow_state ?? "Done"),
              sections: finalBuilt!.sections,
              actions: finalBuilt!.actions,
              isStreaming: false,
            };
          }),
        };
      });

      if (resp?.continue_stream) {
        await runStream(activeThread.id, sessionId, "yes");
      }
    } catch (e: any) {
      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        messages: t.messages.map((m: any) => {
          if (m.id !== (assistant as any).id) return m;
          return {
            ...m,
            isStreaming: false,
            title: "Error",
            subtitle: "Error",
            sections: [
              {
                id: makeId(),
                kind: "text",
                title: "Error",
                pill: "error",
                open: true,
                content: String(e?.message ?? e ?? "Unknown error"),
              },
            ],
          };
        }),
      }));
    } finally {
      setIsSending(false);
    }
  };

  if (!activeThread) return null;

  return (
    <div className="h-full min-h-[calc(100vh-2rem)] bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-[1200px] h-full flex">
        <ChatSidebar
          threads={threads}
          activeId={activeId}
          onNewChat={onNewChat}
          onSelect={(id) =>
            dispatch(
              updateModuleData({
                moduleId: "chatbot",
                data: { activeId: id },
              }),
            )
          }
          onDelete={onDelete}
          onRename={onRename}
          onTogglePin={onTogglePin}
        />

        <section className="flex-1 flex flex-col min-w-0">
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur">
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                  Sam Assistant 👩🏻‍🦰
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {activeThread.title} · {activeThread.files.length} file(s)
                  {activeThread.upload_status === "uploading"
                    ? " · uploading…"
                    : activeThread.upload_status === "success"
                      ? " · upload successful ✅"
                      : activeThread.upload_status === "error"
                        ? " · upload failed ❌"
                        : activeThread.has_uploaded_file
                          ? " · uploaded ✅"
                          : " · no upload yet"}
                </div>
              </div>
            </div>
          </div>

          <ChatThreadView
            messages={activeThread.messages}
            onAction={(action) => {
              if (action.type === "send_message" && action.payload?.text) {
                const msg = String(action.payload.text);
                const norm = msg.trim().toLowerCase();
                if (norm === "yes" || norm === "continue all") {
                  void resumeValidation(norm);
                  return;
                }
                onSend(msg);
              }
            }}
          />

          <ChatComposer
            disabled={isSending || isUploading}
            filesCount={activeThread.files.length}
            onSend={onSend}
            onUploadFiles={onUploadFiles}
          />
        </section>
      </div>
    </div>
  );
}
