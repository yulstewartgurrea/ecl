// ==========================
// components/uploader/MultiCategoryUploader.tsx
// (yellow theme + scrollable right column + loading cursor + disabled interactions)
// ==========================
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  DocumentIcon,
  ArrowUpTrayIcon,
  CloudArrowUpIcon,
  EyeIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import UploadDropzone from "../ui/UploadDropzone";

/* ===================== Types ===================== */
export type CategoryConfig = {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  submodule?: string;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  emptyHint?: string;
};

export type PathBuilderContext = {
  entity: string;
  cadence: string;
  wf: string | number;
  subdir?: string;
  categoryKey: string;
};

export type FileUploadResult = {
  filename: string;
  success: boolean;
  data?: any;
  msg?: string;
  error?: string;
};

export type UploadResultsByCategory = Record<string, FileUploadResult[]>;

export type BulkStrategy = "sequential" | "roundrobin";
export type BulkAssign = "selected" | "order";
export type BulkModeOptions = {
  enabled?: boolean;
  assign?: BulkAssign;
  strategy?: BulkStrategy;
};
export type RightCardsMode = "status-only" | "interactive";

export type MultiCategoryUploaderProps = {
  categories: CategoryConfig[];
  title?: string;
  subtitle?: string;
  accept?: string;
  maxSizeMB?: number;
  endpoint?: string;
  module: string;
  workflowId: string | number;
  pathBuilder: (ctx: PathBuilderContext) => string;
  context: Omit<PathBuilderContext, "categoryKey">;
  tokenGetter?: () => string | null;
  onResultsChange?: (results: UploadResultsByCategory) => void;
  initialSelectedKey?: string;
  bulk?: BulkModeOptions;
  rightCardsMode?: RightCardsMode;
};

/* ===================== Helpers ===================== */
const defaultTokenGetter = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "green" | "red" | "blue" | "orange" | "yellow";
}) {
  const tones: Record<string, string> = {
    default: "bg-gray-100 text-gray-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-orange-50 text-orange-700",
    yellow: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ===================== Component ===================== */
export default function MultiCategoryUploader({
  categories,
  title = "Input Files",
  subtitle,
  accept = ".csv,.xlsx,.xls",
  maxSizeMB = 20,
  endpoint = "/api/document/upload",
  module,
  workflowId,
  pathBuilder,
  context,
  tokenGetter = defaultTokenGetter,
  onResultsChange,
  initialSelectedKey,
  bulk = { enabled: true, assign: "selected", strategy: "sequential" },
  rightCardsMode = "status-only",
}: MultiCategoryUploaderProps) {
  const [selectedKey, setSelectedKey] = useState<string>(
    initialSelectedKey ?? (categories[0]?.key ?? "")
  );
  const [uploading, setUploading] = useState(false);
  const [filesByKey, setFilesByKey] = useState<Record<string, File[]>>({});
  const [uploadResults, setUploadResults] = useState<UploadResultsByCategory>({});
  const [validated, setValidated] = useState<null | "ok" | "error">(null);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorData, setErrorData] = useState<{
    categoryKey: string;
    categoryName: string;
    results: FileUploadResult[];
  } | null>(null);

  // bulk drop state
  const [dragOver, setDragOver] = useState(false);
  const dragDepthRef = useRef(0); // nested drag tracking
  const [lastAssignments, setLastAssignments] = useState<{ name: string; key: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- Global cursor: progress while uploading ---------- */
  useEffect(() => {
    const prev = document.body.style.cursor;
    if (uploading) {
      document.body.style.cursor = "progress";
    } else {
      document.body.style.cursor = prev || "";
      document.body.style.removeProperty("cursor");
    }
    return () => {
      document.body.style.cursor = prev;
    };
  }, [uploading]);

  /* ---------- Persist across remounts (session) ---------- */
  const cacheKey = useMemo(() => `mcu:${module}:${workflowId}`, [module, workflowId]);

  // Hydrate state from in-memory cache on mount
  useEffect(() => {
    const g: any = window as any;
    const cache: Map<string, any> = g.__MCU_CACHE__ ?? (g.__MCU_CACHE__ = new Map());
    const memo = cache.get(cacheKey);
    if (memo) {
      setFilesByKey(memo.filesByKey ?? {});
      setUploadResults(memo.uploadResults ?? {});
      if (memo.selectedKey) setSelectedKey(memo.selectedKey);
      if (memo.lastAssignments) setLastAssignments(memo.lastAssignments);
    }
  }, [cacheKey]);

  // Save to cache whenever these change
  useEffect(() => {
    const g: any = window as any;
    const cache: Map<string, any> = g.__MCU_CACHE__ ?? (g.__MCU_CACHE__ = new Map());
    cache.set(cacheKey, { filesByKey, uploadResults, selectedKey, lastAssignments });
  }, [cacheKey, filesByKey, uploadResults, selectedKey, lastAssignments]);

  /* ---------- derived ---------- */
  const selectedCategory = useMemo(
    () => categories.find((c) => c.key === selectedKey),
    [categories, selectedKey]
  );

  const getCategoryLabel = useCallback(
    (key: string) => categories.find((c) => c.key === key)?.label ?? key,
    [categories]
  );

  const setCategoryFiles = useCallback((key: string, files: File[]) => {
    setFilesByKey((prev) => ({ ...prev, [key]: files }));
  }, []);

  const appendCategoryFiles = useCallback((key: string, newFiles: File[]) => {
    setFilesByKey((prev) => {
      const curr = prev[key] ?? [];
      const mark = new Set(curr.map((f) => `${f.name}-${f.size}`));
      const next = [...curr, ...newFiles.filter((f) => !mark.has(`${f.name}-${f.size}`))];
      return { ...prev, [key]: next };
    });
  }, []);

  const clearCategory = useCallback((key: string) => {
    setFilesByKey((prev) => ({ ...prev, [key]: [] }));
    setUploadResults((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, []);

  const removeFile = useCallback((key: string, fileToRemove: File) => {
    setFilesByKey((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((f) => f !== fileToRemove),
    }));
  }, []);

  const getSuccessfulFiles = useCallback(
    (key: string): File[] => {
      const allFiles = filesByKey[key] ?? [];
      const results = uploadResults[key] ?? [];
      if (!results.length) return [];
      const successNames = new Set(results.filter((r) => r.success).map((r) => r.filename));
      return allFiles.filter((f) => successNames.has(f.name));
    },
    [filesByKey, uploadResults]
  );

  const getFailedResults = useCallback(
    (key: string): FileUploadResult[] => {
      const results = uploadResults[key] ?? [];
      return results.filter((r) => !r.success);
    },
    [uploadResults]
  );

  const validate = useCallback(() => {
    const allOk = categories.every((c) =>
      c.required ? (filesByKey[c.key]?.length ?? 0) > 0 : true
    );
    setValidated(allOk ? "ok" : "error");
    return allOk;
  }, [categories, filesByKey]);

  const clearAll = useCallback(() => {
    setFilesByKey({});
    setUploadResults({});
    setValidated(null);
    // wipe cache too
    const g: any = window as any;
    const cache: Map<string, any> = g.__MCU_CACHE__ ?? (g.__MCU_CACHE__ = new Map());
    cache.set(cacheKey, { filesByKey: {}, uploadResults: {}, selectedKey, lastAssignments: [] });
  }, [cacheKey, selectedKey]);

  /* ---------- upload (single category) ---------- */
  const uploadSingleCategory = useCallback(
    async (key: string, files: File[], override = false) => {
      if (!files.length) return;
      const token = tokenGetter?.() ?? undefined;
      setUploading(true);

      try {
        const results: FileUploadResult[] = [];
        const categoryCfg = categories.find((c) => c.key === key);
        const workflow_path = pathBuilder({ ...context, categoryKey: key });

        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("workflow_path", workflow_path);
            formData.append("document_type", key);
            formData.append("workflow_id", String(workflowId));
            formData.append("override", String(override));
            formData.append("module", module);
            formData.append("submodule", categoryCfg?.submodule ?? "");

            const response = await fetch(endpoint, {
              method: "POST",
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              body: formData,
            });

            const result = await response.json();
            results.push({
              filename: file.name,
              success: !!result?.success,
              data: result?.data,
              msg: result?.msg,
            });
          } catch (err) {
            results.push({
              filename: file.name,
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        setUploadResults((prev) => {
          const merged = { ...prev, [key]: results };
          onResultsChange?.(merged);
          return merged;
        });

        if (!override && results.some((r) => !r.success)) {
          setErrorData({
            categoryKey: key,
            categoryName: getCategoryLabel(key),
            results,
          });
          setShowErrorModal(true);
        }
      } finally {
        setUploading(false);
      }
    },
    [categories, context, endpoint, module, onResultsChange, pathBuilder, tokenGetter, workflowId, getCategoryLabel]
  );

  const uploadAll = useCallback(async () => {
    if (!validate()) return;
    for (const c of categories) {
      const fs = filesByKey[c.key];
      if (fs?.length) await uploadSingleCategory(c.key, fs);
    }
  }, [categories, filesByKey, uploadSingleCategory, validate]);

  /* ---------- DnD handlers (robust) ---------- */
  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!bulk?.enabled || uploading) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setDragOver(true);
  }, [bulk?.enabled, uploading]);

  const onDragOverHandler = useCallback((e: React.DragEvent) => {
    if (!bulk?.enabled || uploading) return;
    e.preventDefault(); // required for drop to fire
    e.stopPropagation();
    try { e.dataTransfer.dropEffect = "copy"; } catch {}
  }, [bulk?.enabled, uploading]);

  const onDragLeaveHandler = useCallback((e: React.DragEvent) => {
    if (!bulk?.enabled || uploading) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOver(false);
  }, [bulk?.enabled, uploading]);

  const onDropHandler = useCallback(async (e: React.DragEvent) => {
    if (!bulk?.enabled || uploading) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragOver(false);

    const items = Array.from(e.dataTransfer.items ?? []);
    let files: File[] = [];
    if (items.length) {
      files = items
        .filter((it) => it.kind === "file")
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
    } else {
      files = Array.from(e.dataTransfer.files ?? []);
    }

    if (!files.length) return;

    if ((bulk.assign ?? "selected") === "selected") {
      const key = selectedKey || categories[0]?.key;
      if (!key) return;
      appendCategoryFiles(key, files);
      setSelectedKey(key);
      await uploadSingleCategory(key, files);
      setLastAssignments(files.map((f) => ({ name: f.name, key })));
    } else {
      const order = categories.map((c) => c.key);
      const strat: BulkStrategy = bulk.strategy ?? "sequential";
      const groups = new Map<string, File[]>();
      const assignments: { name: string; key: string }[] = [];
      const pickKey = (i: number) =>
        strat === "roundrobin" ? order[i % order.length] : order[i < order.length ? i : i % order.length];

      files.forEach((f, i) => {
        const key = pickKey(i);
        const list = groups.get(key) ?? [];
        list.push(f);
        groups.set(key, list);
        assignments.push({ name: f.name, key });
      });

      for (const [key, list] of groups) {
        appendCategoryFiles(key, list);
        setSelectedKey(key);
        await uploadSingleCategory(key, list);
      }
      setLastAssignments(assignments);
    }
  }, [appendCategoryFiles, bulk.assign, bulk.strategy, bulk?.enabled, categories, selectedKey, uploadSingleCategory, uploading]);

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!bulk?.enabled || uploading) return;
    const files = Array.from(e.target.files || []);
    e.currentTarget.value = "";
    if (!files.length) return;

    if ((bulk.assign ?? "selected") === "selected") {
      const key = selectedKey || categories[0]?.key;
      if (!key) return;
      appendCategoryFiles(key, files);
      setSelectedKey(key);
      await uploadSingleCategory(key, files);
      setLastAssignments(files.map((f) => ({ name: f.name, key })));
    } else {
      const order = categories.map((c) => c.key);
      const strat: BulkStrategy = bulk.strategy ?? "sequential";
      const groups = new Map<string, File[]>();
      const assignments: { name: string; key: string }[] = [];
      const pickKey = (i: number) =>
        strat === "roundrobin" ? order[i % order.length] : order[i < order.length ? i : i % order.length];
      files.forEach((f, i) => {
        const key = pickKey(i);
        const list = groups.get(key) ?? [];
        list.push(f);
        groups.set(key, list);
        assignments.push({ name: f.name, key });
      });
      for (const [key, list] of groups) {
        appendCategoryFiles(key, list);
        setSelectedKey(key);
        await uploadSingleCategory(key, list);
      }
      setLastAssignments(assignments);
    }
  }, [appendCategoryFiles, bulk.assign, bulk.strategy, bulk?.enabled, categories, selectedKey, uploadSingleCategory, uploading]);

  /* ---------- UI helpers ---------- */
  const summary = useMemo(() => {
    const parts: string[] = [];
    for (const c of categories) {
      const n = filesByKey[c.key]?.length ?? 0;
      if (n) parts.push(`${n} ${c.label.toLowerCase()}`);
    }
    return parts.join(" • ");
  }, [categories, filesByKey]);

  /* ---------- Render ---------- */
  return (
    <div className={`mx-auto max-w-8xl p-4 ${uploading ? "cursor-progress" : "cursor-auto"}`} aria-busy={uploading}>
      <div className="rounded-3xl border border-gray-200 bg-white/90 backdrop-blur shadow-sm relative">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">{title}</h3>
            {subtitle ? (
              <p className="text-xs text-gray-700">{subtitle}</p>
            ) : (
              <p className="text-xs text-gray-600">
                Upload your datasets. Accepted types: <span className="font-medium">{accept}</span>
              </p>
            )}
            {!!summary && <p className="mt-1 text-xs text-gray-500">Selected: {summary}</p>}
          </div>

          <div className="flex items-center gap-3">
            {uploading && (
              <Pill tone="blue">
                <ArrowUpTrayIcon className="h-4 w-4 mr-1 animate-pulse" />
                Uploading…
              </Pill>
            )}
            {validated === "ok" && !uploading && (
              <Pill tone="green">
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Ready
              </Pill>
            )}
            {validated === "error" && !uploading && (
              <Pill tone="red">
                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                Missing required files
              </Pill>
            )}
          </div>
        </div>

        <div className="flex p-5 gap-5 min-h-0">
          {/* LEFT: Big bulk drop area */}
          <div className="flex-1">
            <div
              className={`relative rounded-2xl border-2 border-dashed border-yellow-300 bg-yellow-50 p-6 min-h-[480px] max-h-[calc(100vh-8rem)] overflow-y-auto ${uploading ? "cursor-progress" : "cursor-pointer"}`}
              onDragEnter={onDragEnter}
              onDragOver={onDragOverHandler}
              onDragLeave={onDragLeaveHandler}
              onDrop={onDropHandler}
              onClick={() => {
                if (uploading) return;
                fileInputRef.current?.click();
              }}
              role="button"
              aria-label="Upload files"
              aria-disabled={uploading}
            >
              <div className="flex h-full w-full items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-3 w-12 h-12 rounded-full border border-yellow-300 bg-white flex items-center justify-center">
                    <CloudArrowUpIcon className={`h-6 w-6 ${uploading ? "animate-pulse text-gray-400" : "text-gray-700"}`} />
                  </div>

                  {/* ACTIVE TARGET INDICATOR */}
                  <div className="mb-2">
                    <Pill tone="yellow">Active: {selectedCategory?.label ?? "—"}</Pill>
                    <span className="ml-2 text-[11px] text-gray-600">
                      document_type: <code className="text-gray-800">{selectedKey}</code>
                    </span>
                  </div>

                  <p className={`text-sm font-medium ${uploading ? "text-gray-500" : "text-gray-900"}`}>
                    Drop files here or{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        if (uploading) return;
                        e.preventDefault();
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className={`underline decoration-yellow-400 underline-offset-2 ${uploading ? "cursor-not-allowed text-gray-400" : "cursor-pointer"}`}
                      disabled={uploading}
                    >
                      click to upload
                    </button>
                  </p>
                  <p className="text-xs text-gray-700 mt-1">
                    {bulk.assign === "selected"
                      ? "All files will be uploaded to the active category."
                      : "Files will be assigned to categories in order (1st file → 1st category, etc.)."}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-2">
                    Accepted: {accept} • Max {maxSizeMB}MB/file
                  </p>

                  {!!lastAssignments.length && (
                    <div className="mt-5 text-left">
                      <h4 className="text-xs font-semibold text-gray-800 mb-2">Last assignment:</h4>
                      <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {lastAssignments.map((a, i) => (
                          <li key={`${a.name}-${i}`} className="text-xs text-gray-700 flex items-center gap-2">
                            <DocumentIcon className="h-4 w-4 text-gray-500" />
                            <span className="truncate">{a.name}</span>
                            <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700">
                              {getCategoryLabel(a.key)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {dragOver && (
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-yellow-400/70" />
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={accept}
                  className="hidden"
                  onChange={onPick}
                  disabled={uploading}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: actions bar + status cards (SCROLLABLE) */}
          <div
            className="flex flex-col gap-4 w-80 min-h-0 max-h-[calc(90vh-14rem)] overflow-y-auto overscroll-contain pb-4"
            role="region"
            aria-label="Upload categories"
          >
            <div className="sticky top-0 z-10 -mt-5 -mx-5 px-5 py-3 bg-white/85 backdrop-blur border-b border-gray-100">
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={clearAll}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-yellow-400 border border-yellow-400 text-gray-900 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={uploading}
                  title="Remove all selected files"
                >
                  <TrashIcon className="h-4 w-4" />
                  Clear All
                </button>
                <button
                  onClick={validate}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-yellow-400 border border-yellow-400 text-gray-900 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={uploading}
                  title="Check required categories"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Validate
                </button>
                <button
                  onClick={uploadAll}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-yellow-400 border border-yellow-400 text-gray-900 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-yellow-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={uploading}
                  title="Upload all selected files"
                >
                  <ArrowUpTrayIcon className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
                  Upload All
                </button>
              </div>
            </div>

            {categories.map((c) => {
              const count = filesByKey[c.key]?.length ?? 0;
              const fails = getFailedResults(c.key);
              const succCount = (uploadResults[c.key] ?? []).filter((r) => r.success).length;

              if (rightCardsMode === "status-only") {
                return (
                  <div
                    key={c.key}
                    className={`rounded-xl border p-4 bg-white shadow-sm transition-all ${
                      selectedKey === c.key ? "ring-2 ring-yellow-400 ring-opacity-60" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100">
                            <DocumentIcon className="h-4 w-4 text-gray-600" />
                          </span>
                          <div className="font-medium text-gray-900">{c.label}</div>
                        </div>
                        {c.description && (
                          <p className="text-[11px] text-gray-600 pl-9">{c.description}</p>
                        )}
                        <div className="pl-9 flex items-center gap-2 pt-1">
                          {c.required && count === 0 ? (
                            <Pill tone="red">Required</Pill>
                          ) : (
                            <Pill tone={count ? "green" : "default"}>
                              {count ? `${count} file${count > 1 ? "s" : ""}` : "No files"}
                            </Pill>
                          )}
                          {succCount > 0 && <Pill tone="green">{succCount} uploaded</Pill>}
                          {fails.length > 0 && <Pill tone="yellow">{fails.length} failed</Pill>}
                          {selectedKey === c.key && <Pill tone="yellow">Active</Pill>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedKey(c.key)}
                          className="rounded-md p-1.5 bg-yellow-400 border border-yellow-400 text-gray-900 hover:brightness-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Set active"
                          disabled={uploading}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {count > 0 && (
                          <button
                            onClick={() => clearCategory(c.key)}
                            className="rounded-md p-1.5 bg-yellow-400 border border-yellow-400 text-gray-900 hover:brightness-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Clear files"
                            disabled={uploading}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Fallback interactive card
              const _accept = c.accept ?? accept;
              const _maxSizeMB = c.maxSizeMB ?? maxSizeMB;
              const _maxFiles = c.maxFiles ?? 3;

              return (
                <div
                  key={c.key}
                  className={`transition-all duration-200 rounded-xl ${
                    selectedKey === c.key ? "ring-2 ring-yellow-400 ring-opacity-60" : ""
                  }`}
                  onClick={() => !uploading && setSelectedKey(c.key)}
                  role="button"
                  aria-disabled={uploading}
                >
                  <UploadDropzone
                    label={c.label}
                    description={c.description}
                    accept={_accept}
                    maxSizeMB={_maxSizeMB}
                    maxFiles={_maxFiles}
                    required={!!c.required}
                    value={filesByKey[c.key] ?? []}
                    onChange={(files: File[]) => {
                      if (uploading) return;
                      setCategoryFiles(c.key, files);
                      setSelectedKey(c.key);
                      if (files.length) uploadSingleCategory(c.key, files);
                    }}
                    emptyHint={c.emptyHint ?? `Click to upload or drag & drop`}
                    variant="card"
                    hideFileList
                    disabled={uploading}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {showErrorModal && errorData && (
        <div className="fixed inset-0 z-50 bg-black/10 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Some files failed to upload</h3>
                  <p className="text-xs text-gray-600">{errorData.categoryName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowErrorModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors p-2 cursor-pointer"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
              <ul className="space-y-2">
                {errorData.results
                  .filter((r) => !r.success)
                  .map((res, idx) => (
                    <li
                      key={`${res.filename}-${idx}`}
                      className="rounded-lg border border-yellow-100 bg-yellow-50/60 px-3 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <DocumentIcon className="h-4 w-4 text-yellow-700 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{res.filename}</p>
                            <Pill tone="yellow">Failed</Pill>
                          </div>
                          {res.msg && (
                            <p className="text-xs text-gray-700 mt-1">
                              <span className="font-medium">Message:</span> {res.msg}
                            </p>
                          )}
                          {res.error && (
                            <p className="text-xs text-gray-700 mt-1">
                              <span className="font-medium">Error:</span> {res.error}
                            </p>
                          )}
                          {res.data && (
                            <details className="mt-2">
                              <summary className="text-xs text-gray-600 cursor-pointer select-none">
                                Server response
                              </summary>
                              <pre className="text-[11px] bg-gray-100 rounded-md p-2 mt-1 overflow-x-auto">
                                {JSON.stringify(res.data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
              <button
                onClick={() => setShowErrorModal(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-yellow-400 border border-yellow-400 text-gray-900 hover:brightness-95 cursor-pointer"
              >
                <XMarkIcon className="h-4 w-4" />
                Close
              </button>
              <button
                onClick={async () => {
                  if (!errorData) return;
                  setShowErrorModal(false);
                  const failed = new Set(
                    errorData.results.filter((r) => !r.success).map((r) => r.filename)
                  );
                  const originals = filesByKey[errorData.categoryKey] ?? [];
                  const retry = originals.filter((f) => failed.has(f.name));
                  if (retry.length) await uploadSingleCategory(errorData.categoryKey, retry, true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-yellow-400 border border-yellow-400 text-gray-900 hover:brightness-95 cursor-pointer"
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                Retry failed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
