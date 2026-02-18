import React from "react";

type SkeletonTableProps = {
  /** Number of skeleton rows to render */
  rows?: number;
  /** Number of columns (excluding the sticky index col if shown) */
  cols?: number;
  /** Show a header skeleton row */
  showHeader?: boolean;
  /** Optional title bar above the table */
  title?: string;
  /** Show a leading “index” column (slightly wider, like a name/date col) */
  showIndexCol?: boolean;
  /** Animate pulse effect */
  animated?: boolean;
  /** Extra classes for the outer card */
  className?: string;
  /** Fixed height for scrollable area (keeps layout stable) */
  heightClass?: string; // e.g. "max-h-[60vh]"
};

/** utility */
const cn = (...xs: Array<string | false | undefined>) => xs.filter(Boolean).join(" ");

/**
 * Skeleton table loader
 * - Light card with optional title and header
 * - Sticky first column (optional), helpful to match your real tables
 * - Uses Tailwind's animate-pulse unless `animated=false`
 */
const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 8,
  cols = 5,
  showHeader = true,
  title,
  showIndexCol = true,
  animated = true,
  className,
  heightClass = "max-h-[60vh]",
}) => {
  // simple deterministic widths to avoid “uniform bar look”
  const widths = ["w-2/5", "w-3/5", "w-1/2", "w-1/3", "w-2/3", "w-1/4", "w-3/4"];

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white shadow-sm",
        animated && "animate-pulse",
        className
      )}
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading table"
      role="status"
    >
      {title && (
        <div className="px-4 pt-4">
          <div className="h-5 w-40 rounded bg-neutral-200" />
        </div>
      )}

      <div className={cn("overflow-auto", heightClass)}>
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          {showHeader && (
            <thead>
              <tr className="text-xs">
                {showIndexCol && (
                  <th className="sticky left-0 z-10 bg-white px-3 py-3 border-b border-neutral-100 border-r">
                    <div className="h-3 w-16 rounded bg-neutral-200" />
                  </th>
                )}
                {Array.from({ length: cols }).map((_, i) => (
                  <th key={`h-${i}`} className="px-3 py-3 border-b border-neutral-100">
                    <div className={cn("h-3 rounded bg-neutral-200", widths[i % widths.length])} />
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={`r-${r}`} className={r % 2 ? "bg-neutral-50/50" : ""}>
                {showIndexCol && (
                  <td className="sticky left-0 z-0 bg-white px-3 py-3 border-b border-neutral-100 border-r">
                    <div className="h-3 w-24 rounded bg-neutral-200" />
                  </td>
                )}
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={`c-${r}-${c}`} className="px-3 py-3 border-b border-neutral-100">
                    <div className={cn("h-3 rounded bg-neutral-200", widths[(r + c) % widths.length])} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* optional footer action placeholders */}
      <div className="flex justify-end gap-2 px-4 py-3">
        <div className="h-9 w-24 rounded-lg bg-neutral-200" />
        <div className="h-9 w-28 rounded-lg bg-neutral-200" />
      </div>
    </div>
  );
};

export default SkeletonTable;

