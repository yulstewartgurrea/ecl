// src/components/modals/OverlayUploadResultModal.tsx
import { XMarkIcon } from "@heroicons/react/24/outline";

export type IssueRow = {
  fileName: string;
  status: number;
  ok: boolean;
  kind: "conflict" | "error";
  payload?: any;
};

export default function OverlayUploadResultModal({
  open,
  title = "Upload Validation",
  issues,
  isSubmitting,
  onClose,
  onProceed,
  proceedDisabledReason,
}: {
  open: boolean;
  title?: string;
  issues: IssueRow[];
  isSubmitting: boolean;
  onClose: () => void;
  onProceed: () => void;
  proceedDisabledReason?: string;
}) {
  if (!open) return null;

  const conflicts = issues.filter(i => i.kind === "conflict");
  const errors = issues.filter(i => i.kind === "error");

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-gray-100/80 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            className="p-1 rounded hover:bg-gray-100"
            onClick={onClose}
            disabled={isSubmitting}
            title="Close"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-auto p-5 space-y-4">
          <div className="text-sm text-gray-700">
            <span className="mr-4"><strong>Conflicts:</strong> {conflicts.length}</span>
            <span><strong>Errors:</strong> {errors.length}</span>
          </div>

          {issues.length === 0 ? (
            <p className="text-sm text-gray-500">No conflicts or errors.</p>
          ) : (
            <ul className="space-y-3">
              {issues.map((r, idx) => (
                <li key={idx} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-all">{r.fileName}</p>
                      <p className="text-xs text-gray-500">status: {r.status} â€¢ {r.kind.toUpperCase()}</p>
                      <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-[11px] leading-tight text-gray-700">
                        {JSON.stringify(r.payload ?? {}, null, 2)}
                      </pre>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-1 text-xs " +
                        (r.kind === "conflict" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700")
                      }
                    >
                      {r.kind === "conflict" ? "CONFLICT" : "ERROR"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50  cursor-pointer"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="rounded-xl border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50 cursor-pointer"
            disabled={isSubmitting || issues.length === 0 || !!proceedDisabledReason}
            title={proceedDisabledReason || "Run again with override=true"}
          >
            {isSubmitting ? "Uploadingâ€¦" : "Proceed"}
          </button>
        </div>
      </div>
    </div>
  );
}
