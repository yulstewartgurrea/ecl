// # file: src/features/chatbot/components/ChatComposer.tsx
import { useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  filesCount: number;
  onSend: (text: string) => void;
  onUploadFiles: (files: FileList | null) => void;
};

export function ChatComposer({ disabled, filesCount, onSend, onUploadFiles }: Props) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const submit = () => {
    const v = text.trim();
    if (!v || disabled) return;
    console.log(filesCount)
    onSend(v);
    setText("");
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="px-4 sm:px-6 py-4">
        {/* ALIGN ALL CENTER */}
        <div className="flex items-center gap-3">
          {/* Upload beside textbox */}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              onUploadFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />

          {/* Paperclip Icon Button */}
          <button
            type="button"
            disabled={false}
            onClick={() => fileRef.current?.click()}
            title="Upload file"
            aria-label="Upload file"
            className="
              h-11 w-11 rounded-2xl
              border border-yellow-500
              bg-white hover:bg-gray-100
              text-gray-900
              flex items-center justify-center
              transition
              shrink-0
            "
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-8.49 8.49a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Middle input block (textarea + tip) */}
          <div className="flex-1 min-w-0">
            {/* Match button height (h-11) */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask Sam…"
              rows={1}
              className="
                w-full
                h-11
                resize-none
                px-4 py-3
                rounded-2xl
                focus:outline-none
                text-sm
                text-gray-900
                placeholder:text-gray-400
                leading-5
              "
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={disabled}
            />

            <div className="mt-1 text-[11px] text-gray-500">
              Tip: Press <span className="font-semibold">Enter</span> to send ·{" "}
              <span className="font-semibold">Shift+Enter</span> for new line
            </div>
          </div>

          {/* Send button aligned with others */}
          <button
            type="button"
            disabled={disabled || !text.trim()}
            onClick={submit}
            className="
              h-11 px-5 rounded-2xl
              border border-yellow-500
              bg-white text-gray-900
              hover:bg-yellow-50
              disabled:opacity-50
              disabled:cursor-not-allowed
              transition
              shrink-0
            "
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}