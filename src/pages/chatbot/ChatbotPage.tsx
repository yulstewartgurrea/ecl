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
  makeId,
  ensureSessionId,
  normalizeMessageResponseToEvents,
  isVisualizationRequest,
  buildUploadResponseContent,
  createNewThread,
} from "./utils";

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
  const [typewriterEnabled, setTypewriterEnabled] = useState<boolean>(true);
  const [typewriterActive, setTypewriterActive] = useState<boolean>(false);

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

  useEffect(() => {
    if (typeof window !== "undefined" && "matchMedia" in window) {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      setTypewriterEnabled(!reduced);
    }
  }, []);

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
  /** Find the latest assistant message tagged as the upload bubble. */
  const findLatestUploadMsg = (threadId: string) => {
    const t = threadsRef.current.find((x) => x.id === threadId);
    if (!t) return null;
    const msgs = (t.messages ?? []).filter(
      (m: any) => m?.role === "assistant" && m?.meta?.tag === "upload",
    );
    return msgs.length ? (msgs[msgs.length - 1] as any) : null;
  };

  /** Patch a specific assistant message by id. */
  const patchAssistantMessage = (
    threadId: string,
    messageId: string,
    patch: (m: ChatMessage & { role: "assistant" }) => ChatMessage,
  ) => {
    mutateThread(threadId, (t) => ({
      ...t,
      updatedAt: Date.now(),
      messages: t.messages.map((m: any) =>
        m.id === messageId ? patch(m as any) : m,
      ),
    }));
  };

  /** Upsert OR patch-by-tag fallback (if id went missing). */
  const upsertOrPatchUploadMsg = (
    threadId: string,
    messageId: string,
    makeMsg: () => ChatMessage,
    patch: (m: ChatMessage & { role: "assistant" }) => ChatMessage,
  ) => {
    const t = threadsRef.current.find((x) => x.id === threadId);
    if (!t) {
      // Thread gone; just ignore safely
      return;
    }
    const has = t.messages.some((m) => m.id === messageId);
    if (has) {
      patchAssistantMessage(threadId, messageId, patch);
      return;
    }
    // Fallback: find by tag
    const existing = findLatestUploadMsg(threadId);
    if (existing) {
      patchAssistantMessage(threadId, existing.id, patch);
      return;
    }
    // Last resort: upsert a new one (should rarely happen)
    upsertAssistantMessage(threadId, makeMsg());
  };

  /** Small utilities to let UI commit before we start stream */
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () =>
    new Promise<void>((r) => {
      if (typeof window === "undefined") return r();
      requestAnimationFrame(() => r());
    });
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
      // build history payload from the current thread messages
      const thread = threadsRef.current.find((t) => t.id === threadId);
      const history = (thread?.messages ?? []).map((m: any) => {
        if (m.role === "user")
          return { role: "user", content: m.content ?? "" };
        // assistant messages: concat text-like sections
        const secs = Array.isArray(m.sections) ? m.sections : [];
        const content = secs
          .map((s: any) => {
            if (!s) return "";
            if (
              s.kind === "text" ||
              s.kind === "thinking" ||
              s.kind === "summary"
            )
              return s.content ?? "";
            if (s.kind === "table")
              return s.rows && s.rows.length ? JSON.stringify(s.rows) : "";
            return "";
          })
          .filter(Boolean)
          .join("\n\n");
        return { role: "assistant", content };
      });

      const res = await streamEcl(
        { session_id: sessionId, message, history, stream: true },
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
        // render called (stream update) — keep silent in production
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

    // Build UI file list (unchanged)
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
      // Guard against concurrent actions
      setIsUploading(true);

      // Fresh abort controller for upload
      abortCtrlRef.current?.abort();
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      // Ensure session id on thread
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

      // 1) Create the initial "Uploading..." bubble (TAGGED as 'upload')
      const uploadMsgId = makeId();
      uploadMsgIdRef.current = uploadMsgId;

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
        meta: { status: "uploading", tag: "upload" }, // 👈 tag + uploading
      } as any);

      // 2) Do the upload
      const uploaded = await uploadEclFile(
        { session_id, file },
        ctrl.signal,
        tokenai,
      );

      const finalSession = uploaded.session_id ?? session_id;
      const finalFileName = uploaded.file_name ?? file.name;

      // Prebuild content for the success message body
      const uploadResponseContent = buildUploadResponseContent(
        uploaded,
        finalFileName,
        finalSession,
      );

      // Update the thread-level upload state first
      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        session_id: finalSession,
        file_name: finalFileName,
        has_uploaded_file: true,
        upload_status: "success",
        upload_response: uploaded ?? null,
        upload_error: null,
      }));

      // 3) ✅ Patch the SAME upload bubble to SUCCESS
      const successPatch = (m: ChatMessage & { role: "assistant" }) =>
        ({
          ...m,
          title: "Upload complete",
          subtitle: finalFileName,
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
          meta: { ...(m as any).meta, status: "success", tag: "upload" }, // 👈 success + tag
        }) as any;

      upsertOrPatchUploadMsg(
        activeThread.id,
        uploadMsgIdRef.current!,
        // makeMsg only used if fallback creation is needed
        () =>
          ({
            id: uploadMsgIdRef.current!,
            role: "assistant",
            kind: "accordion",
            title: "Upload complete",
            subtitle: finalFileName,
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
            ],
            isStreaming: false,
            meta: { status: "success", tag: "upload" },
          }) as any,
        successPatch,
      );

      // 4) Give React/Redux a frame to commit the icon flip BEFORE we start stream
      await nextFrame();
      await wait(10);

      // 5) Auto run the stream after upload visibly succeeded
      await runStream(activeThread.id, finalSession, "start");
    } catch (e: any) {
      const errorMessage = String(e?.message ?? e ?? "Upload error");

      // Update thread-level status
      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        upload_status: "error",
        upload_error: errorMessage,
      }));

      // Patch the SAME bubble to ERROR (by id or by tag)
      const errorPatch = (m: ChatMessage & { role: "assistant" }) =>
        ({
          ...m,
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
          meta: { ...(m as any).meta, status: "error", tag: "upload" },
        }) as any;

      const id = uploadMsgIdRef.current ?? makeId();

      upsertOrPatchUploadMsg(
        activeThread.id,
        id,
        () =>
          ({
            id,
            role: "assistant",
            kind: "accordion",
            title: "Upload failed",
            subtitle: "Let’s try again",
            actions: [],
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
            meta: { status: "error", tag: "upload" },
          }) as any,
        errorPatch,
      );

      // Optional: mark no uploaded file
      mutateThread(activeThread.id, (t) => ({
        ...t,
        updatedAt: Date.now(),
        has_uploaded_file: false,
      }));
    } finally {
      setIsUploading(false);
      // Keep the id around until after stream starts (or clear now if you prefer)
      // uploadMsgIdRef.current = null;
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
            typewriterEnabled={typewriterEnabled}
            onTypewriterActiveChange={(v: boolean) => setTypewriterActive(v)}
            sequentialAccordions={true}
          />

          <ChatComposer
            disabled={isSending || isUploading || typewriterActive}
            filesCount={activeThread.files.length}
            onSend={onSend}
            onUploadFiles={onUploadFiles}
          />
        </section>
      </div>
    </div>
  );
}
