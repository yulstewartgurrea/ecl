import React, { useId, useRef, useState } from "react";
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type UploadDropzoneProps = {
  label: string;
  description?: string;
  required?: boolean;
  multiple?: boolean;
  /** input accept attribute, e.g. ".csv,.xlsx,.xls" */
  accept?: string;
  /** max size per file in MB */
  maxSizeMB?: number;
  /** max files allowed */
  maxFiles?: number;
  /** Controlled value */
  value: File[];
  /** Called whenever the file list changes */
  onChange: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  /** Custom empty hint (when no files) */
  emptyHint?: React.ReactNode;
  /** look & feel */
  variant?: "card" | "compact";
  /** show a subtle success chip when non-empty */
  showCountBadge?: boolean;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${v} ${sizes[i]}`;
}
const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

export default function UploadDropzone({
  label,
  description,
  required,
  multiple = true,
  accept = ".csv,.xlsx,.xls",
  maxSizeMB = 20,
  maxFiles,
  value,
  onChange,
  disabled,
  className,
  emptyHint,
  variant = "card",
  showCountBadge = true,
}: UploadDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const next = [...value];
    const errs: string[] = [];

    list.forEach((f) => {
      const tooBig = f.size > maxSizeMB * 1024 * 1024;
      const typeOk =
        !accept ||
        accept
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .some((ext) => f.name.toLowerCase().endsWith(ext));

      if (tooBig) {
        errs.push(`${f.name} exceeds ${maxSizeMB} MB`);
        return;
      }
      if (!typeOk) {
        errs.push(`${f.name} is not an accepted type (${accept})`);
        return;
      }
      if (maxFiles && next.length >= maxFiles) {
        errs.push(`Max ${maxFiles} file${maxFiles > 1 ? "s" : ""} allowed`);
        return;
      }
      const k = fileKey(f);
      if (!next.some((x) => fileKey(x) === k)) next.push(f);
    });

    setErrors(errs);
    onChange(next);
  };

  const removeAt = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };
  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    if (e.type === "dragleave") setDragActive(false);
  };
  const openPicker = () => !disabled && inputRef.current?.click();

  const hasFiles = value.length > 0;

  const wrapper =
    variant === "compact"
      ? "rounded-xl border border-gray-200 bg-white shadow-sm"
      : "rounded-2xl border border-gray-200 bg-white shadow-sm";

  const dropPad = variant === "compact" ? "m-3 p-4" : "m-4 p-5";
  const titleSize = variant === "compact" ? "text-sm" : "text-sm";
  const listPad = variant === "compact" ? "px-3 pb-3" : "px-4 pb-4";

  return (
    <div className={[wrapper, className].filter(Boolean).join(" ")}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-gray-900 to-gray-700 text-white shadow">
          <CloudArrowUpIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`${titleSize} font-semibold text-gray-900`}>{label}</h3>
            {required && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
                Required
              </span>
            )}
            {showCountBadge && hasFiles && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                {value.length} file{value.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {description && <p className="mt-0.5 text-xs text-gray-600">{description}</p>}
        </div>
      </div>

      {/* Dropzone */}
      <div
        onClick={openPicker}
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? openPicker() : null)}
        className={[
          dropPad,
          "rounded-xl border-2 border-dashed transition relative overflow-hidden",
          dragActive ? "border-gray-900 bg-gray-50" : "border-gray-300 hover:border-gray-400",
          disabled ? "opacity-50 pointer-events-none" : "cursor-pointer",
        ].join(" ")}
        aria-labelledby={inputId}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />

        {/* Drag overlay */}
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gray-100/80 to-white/40" />
        )}

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <CloudArrowUpIcon className="h-6 w-6 text-gray-700" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">
              Click to upload <span className="text-gray-500">or</span> drag and drop
            </p>
            <p className="text-xs text-gray-500">
              Accepted: <span className="font-medium">{accept}</span>
              {maxFiles ? ` · Up to ${maxFiles} file${maxFiles > 1 ? "s" : ""}` : ""} · Max {maxSizeMB} MB/file
            </p>
          </div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mx-4 -mt-2 mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <div className="flex items-start gap-2">
            <ExclamationCircleIcon className="mt-0.5 h-4 w-4 flex-none" />
            <ul className="space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* File list */}
      <div className={listPad}>
        {hasFiles ? (
          <ul className="space-y-2">
            {value.map((file, i) => (
              <li
                key={fileKey(file)}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <DocumentIcon className="h-5 w-5 text-gray-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(i);
                  }}
                  className="inline-flex items-center rounded-lg p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50"
                  aria-label={`Remove ${file.name}`}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-gray-500">
            {emptyHint ?? "No files uploaded yet."}
          </div>
        )}
      </div>
    </div>
  );
}
