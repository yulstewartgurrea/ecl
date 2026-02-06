import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

export type PaginationState = {
  page: number;
  page_size: number;
  total_rows: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
};

type Props = {
  pagination: PaginationState;
  currentCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  showSummary?: boolean;
};

export default function PaginationControls({
  pagination,
  currentCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100, 1000],
  disabled = false,
  showSummary = true,
}: Props) {
  const start =
    pagination.total_rows > 0
      ? (pagination.page - 1) * pagination.page_size + 1
      : 0;
  const end =
    pagination.total_rows > 0
      ? Math.min(
          pagination.total_rows,
          start + Math.max(0, currentCount) - 1
        )
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            disabled={disabled || !pagination.has_previous}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Prev
          </button>

          <button
            className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={disabled || !pagination.has_next}
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={pagination.total_pages}
            value={pagination.page}
            onChange={(e) => {
              const n = Math.max(1, Number(e.target.value) || 1);
              onPageChange(Math.min(n, pagination.total_pages));
            }}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1"
            disabled={disabled}
          />
          <span>/ {pagination.total_pages}</span>
        </div>

        {onPageSizeChange && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span>Rows per page</span>
            <select
              value={pagination.page_size}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1"
              disabled={disabled}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showSummary && (
        <p className="text-sm text-neutral-600">
          Showing <strong>{start}</strong>–<strong>{end}</strong> of{" "}
          <strong>{pagination.total_rows.toLocaleString()}</strong>
        </p>
      )}
    </div>
  );
}
