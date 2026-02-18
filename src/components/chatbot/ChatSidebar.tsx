// # file: src/features/chatbot/components/ChatSidebar.tsx
import { useMemo, useState } from "react";
import type { ChatThread } from "../../pages/chatbot/chatbot.types";

type Props = {
  threads: ChatThread[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
};

export function ChatSidebar({
  threads,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
  onRename,
  onTogglePin,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return threads;
    return threads.filter((t) => t.title.toLowerCase().includes(s));
  }, [threads, q]);

  return (
    <aside className="w-[290px] hidden sm:flex flex-col  bg-white">
      <div className="p-3 ">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full px-3 py-2 rounded-xl border border-yellow-500 text-gray-900 hover:bg-yellow-400 text-sm"
        >
          New chat
        </button>

        <div className="mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats…"
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {filtered.length === 0 ? (
          <div className="text-xs text-gray-500 px-2 py-3">No chats found.</div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((t) => {
              const active = t.id === activeId;
              return (
                <li key={t.id}>
                  <div
                    className={[
                      "group rounded-xl px-3 py-2 cursor-pointer",
                      active ? "border-yellow-500 bg-yellow-50" : " hover:bg-gray-50",
                    ].join(" ")}
                    onClick={() => onSelect(t.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {t.pinned ? "📌 " : ""}
                          {t.title}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {t.files.length} file(s)
                          {t.session_id ? ` · ${t.session_id.slice(0, 8)}…` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(t.id);
                          }}
                          title="Pin"
                        >
                          📌
                        </button>
                        <button
                          type="button"
                          className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            const title = window.prompt("Rename chat:", t.title);
                            if (title && title.trim()) onRename(t.id, title.trim());
                          }}
                          title="Rename"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            const ok = window.confirm("Delete this chat?");
                            if (ok) onDelete(t.id);
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-3 border-t border-gray-200 text-[11px] text-gray-500">
        Sam 👩🏻‍🦰 AI · DeepAgents ECL
      </div>
    </aside>
  );
}
