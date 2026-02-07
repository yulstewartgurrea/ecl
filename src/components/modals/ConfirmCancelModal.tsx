import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmCancelModal({
  open,
  title = "Warning",
  message,
  confirmText = "Yes, continue",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2 text-red-600">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 text-sm text-gray-700">
          {message}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <ExclamationTriangleIcon className="h-4 w-4" />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
