// components/about/AboutTablePanel.tsx
import { useState, type ReactNode } from "react";
import {
  InformationCircleIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";

export type LegendItem = {
  direction: "higher" | "lower" | "note";
  tone: "good" | "bad" | "neutral";
  label: string;
  text: string;
};

const TONE = {
  good: { text: "text-green-700", bg: "bg-green-100" },
  bad: { text: "text-red-700", bg: "bg-red-100" },
  neutral: { text: "text-gray-700", bg: "bg-gray-100" },
};

/**
 * "About this table" box shown above the Flowrate Approach tables:
 * only the description up front; the higher/lower legend, where the numbers go next
 * and the details all sit behind "Learn more".
 */
export default function AboutTablePanel({
  description,
  legend,
  usedNext,
  notice,
  children,
}: {
  description: ReactNode;
  /** Omit for steps where higher/lower has no meaning (e.g. uploads) */
  legend?: LegendItem[];
  usedNext?: ReactNode;
  notice?: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-amber-100">
            <InformationCircleIcon className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">About this table</h2>
            <p className="mt-1 text-sm text-gray-700">{description}</p>
            {notice && (
              <div className="mt-2 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
                <div>{notice}</div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex flex-none items-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
        >
          <BookOpenIcon className="h-4 w-4" />
          Learn more
          <ChevronDownIcon className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <>
          {/* Higher / lower legend */}
          {legend && legend.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                What higher or lower means
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {legend.map((item) => {
                  const tone = TONE[item.tone];
                  const Icon =
                    item.direction === "higher"
                      ? ArrowUpIcon
                      : item.direction === "lower"
                        ? ArrowDownIcon
                        : InformationCircleIcon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full ${tone.bg}`}
                      >
                        <Icon className={`h-4 w-4 ${tone.text}`} />
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold ${tone.text}`}>{item.label}</div>
                        <p className="text-xs text-gray-600">{item.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {usedNext && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Where it's used next
              </h3>
              <p className="mt-1 text-sm text-gray-700">{usedNext}</p>
            </div>
          )}

          {children && <div className="mt-4 grid gap-3 lg:grid-cols-2">{children}</div>}
        </>
      )}
    </section>
  );
}

export type ColumnDefinition = { name: string; text: ReactNode };

export function ColumnDefinitions({ items }: { items: ColumnDefinition[] }) {
  return (
    <dl className="space-y-2">
      {items.map((item) => (
        <div key={item.name} className="rounded-md bg-gray-50 px-2.5 py-1.5">
          <dt className="text-sm font-semibold text-gray-900">{item.name}</dt>
          <dd className="text-xs text-gray-600">{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Worked example with real numbers so the user can trace one value in the table.
 * `tableValue` is what the table shows for the same cell; when it matches `result` we say so.
 */
export function CalcExample({
  heading,
  steps,
  terms,
  result,
  tableValue,
  footnote,
}: {
  heading: string;
  steps: string[];
  /** Optional one-line-per-item breakdown shown before the result, e.g. a sum over buckets */
  terms?: { label: string; parts: string; value: string }[];
  result: string;
  tableValue: string | null;
  footnote?: string;
}) {
  return (
    <div className="mt-3 rounded-md bg-gray-50 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Example</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{heading}</div>
      <div className="mt-1 space-y-0.5 font-mono text-xs text-gray-700">
        {steps.map((step) => (
          <div key={step}>= {step}</div>
        ))}
        {terms && (
          <table className="my-1">
            <tbody>
              {terms.map((t) => (
                <tr key={t.label}>
                  <td className="pr-3 text-gray-500">{t.label}</td>
                  <td className="pr-3">{t.parts}</td>
                  <td className="text-right">= {t.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="font-semibold text-gray-900">= {result}</div>
      </div>
      {tableValue !== null &&
        (tableValue === result ? (
          <p className="mt-1 text-xs font-semibold text-green-700">✓ Matches the value in the table.</p>
        ) : (
          <p className="mt-1 text-xs text-gray-600">The table shows {tableValue}.</p>
        ))}
      {footnote && <p className="mt-1 text-xs text-gray-500">{footnote}</p>}
    </div>
  );
}

export function InfoCard({
  title,
  wide = false,
  children,
}: {
  title: string;
  /** Span the full width of the "Learn more" grid (e.g. for tables) */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-3 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-2 text-sm text-gray-700">{children}</div>
    </div>
  );
}

/** Small reference table, e.g. definitions of the columns an upload needs. */
export function DefinitionTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((cells, i) => (
            <tr key={i} className="align-top">
              {cells.map((cell, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? "whitespace-nowrap font-mono text-gray-900" : "text-gray-700"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
