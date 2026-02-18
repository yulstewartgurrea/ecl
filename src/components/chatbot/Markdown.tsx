// # file: src/features/chatbot/components/Markdown.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  children: string;
  className?: string;
};

export function Markdown({ children, className }: Props) {
  const text = String(children ?? "");

  return (
    <div className={["min-w-0", className ?? ""].join(" ")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // ✅ No raw HTML rendering (safer)
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-6 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-200 pl-3 text-gray-700">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
            >
              {children}
            </a>
          ),
          code: ({ inline, children }: any) => {
            if (inline) {
              return (
                <code className="px-1 py-0.5 rounded bg-gray-100  text-[0.9em]">
                  {children}
                </code>
              );
            }
            return (
              <code className="block whitespace-pre-wrap text-sm leading-relaxed">{children}</code>
            );
          },
          pre: ({ children }) => (
            <pre className="rounded-xl  bg-gray-50 p-3 overflow-auto text-sm">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-3 border-none" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}