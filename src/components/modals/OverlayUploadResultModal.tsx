// src/components/modals/OverlayUploadResultModal.tsx
import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  normalizeUploadError,
  type NormalizedUploadError,
} from "../../utils/uploadErrorNormalizer";

export type IssueRow = {
  fileName: string;
  status: number;
  ok: boolean;
  kind: "conflict" | "error";
  payload?: any;
  normalized?: NormalizedUploadError;
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

  const normalized = useMemo(() => {
    if (!issues.length) return normalizeUploadError(null);
    const first = issues[0];
    return first.normalized ?? normalizeUploadError(first.payload ?? first);
  }, [issues]);

  const issueMessages = useMemo(() => {
    const all: string[] = [];
    issues.forEach((issue) => {
      const norm = issue.normalized ?? normalizeUploadError(issue.payload ?? issue);
      if (norm.issueMessages?.length) all.push(...norm.issueMessages);
    });
    return Array.from(new Set(all));
  }, [issues]);

  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    if (open) setShowDetails(false);
  }, [open, issues]);
  const detailsText = useMemo(() => {
    if (!issues.length) return "";
    const blocks = issues
      .map((issue) => {
        const norm = issue.normalized ?? normalizeUploadError(issue.payload ?? issue);
        const lines = [
          `File: ${issue.fileName}`,
          `Type: ${issue.kind}`,
          `Status: ${issue.status}`,
        ];
        if (norm.debugDetails) lines.push(norm.debugDetails);
        return lines.join("\n");
      })
      .join("\n\n");
    return blocks;
  }, [issues]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between  px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            {normalized.title}
          </h3>
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
          <div className="space-y-2">
            <p className="text-sm text-gray-800">{normalized.userMessage}</p>
            <p className="text-sm text-gray-700">{normalized.userAction}</p>
          </div>

          {issueMessages.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-800">Issues found</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                {issueMessages.map((msg, idx) => (
                  <li key={`${msg}-${idx}`}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {detailsText && (
            <div>
              <button
                type="button"
                className="text-sm text-gray-700 underline underline-offset-2"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>
              {showDetails && (
                <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-50 p-3 text-[11px] leading-tight text-gray-700">
                  {detailsText}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50  cursor-pointer"
            disabled={isSubmitting}
          >
            Close
          </button>
          <button
            onClick={onProceed}
            className="rounded-xl bg-yellow-300 px-4 py-2.5 text-sm text-gray-800 font-semibold text-white hover:bg-gray-200 disabled:opacity-50 cursor-pointer"
            disabled={isSubmitting || issues.length === 0 || !!proceedDisabledReason}
            title={proceedDisabledReason || "Upload again"}
          >
            {isSubmitting ? "Uploading..." : "Upload again"}
          </button>
        </div>
      </div>
    </div>
  );
}

