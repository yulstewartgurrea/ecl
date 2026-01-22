// ==========================
// components/uploader/MultiCategoryUploader.tsx
// (validate -> proceed -> upload; halt on failure; "Proceed anyway" forces current then continues)
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
  InformationCircleIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

import UploadDropzone from "../ui/UploadDropzone";
import { useAppSelector } from "../../redux_toolkit/hooks";

/* ===================== Types ===================== */
export type CategoryConfig = {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  submodule?: string;
  accept?: string;      // per-category accept (e.g. ".csv,.xlsx")
  maxFiles?: number;    // per-category cap
  maxSizeMB?: number;   // per-file cap
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
  accept?: string;        // global accept fallback
  maxSizeMB?: number;     // global per-file size fallback
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
  title,
}: {
  children: React.ReactNode;
  tone?: "default" | "green" | "red" | "blue" | "orange" | "yellow";
  title?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    blue: "bg-sky-50 text-sky-700",
    orange: "bg-orange-50 text-orange-700",
    yellow: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]} ring-1 ring-black/5`}
      title={title}
    >
      {children}
    </span>
  );
}

/* ---------- Status helpers (read validation_status from server payload) ---------- */
type ValidationStatus = "failed" | "error" | string;

const getValidationStatus = (r: FileUploadResult): ValidationStatus | null => {
  const vr = (r as any)?.data?.validation_results;
  const v1 = vr?.validation_status;
  const v2 = (r as any)?.data?.validation_status;
  return (v1 ?? v2) ?? null;
};

const hasErrorStatus = (rs: FileUploadResult[]) =>
  rs.some((r) => !r.success && getValidationStatus(r) === "error");

const hasFailedStatus = (rs: FileUploadResult[]) =>
  rs.some((r) => !r.success && getValidationStatus(r) === "failed");

const canForceUploadForKey = (
  key: string,
  uploadResults: UploadResultsByCategory
) => {
  const rs = uploadResults[key] ?? [];
  return rs.length > 0 && hasFailedStatus(rs) && !hasErrorStatus(rs);
};

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
  tokenGetter,
  onResultsChange,
  initialSelectedKey,
  bulk = { enabled: true, assign: "selected", strategy: "sequential" },
  rightCardsMode = "status-only",
}: MultiCategoryUploaderProps) {
  const reduxToken = useAppSelector((state: any) => state.auth?.token) as
    | string
    | null
    | undefined;
  const getToken = useCallback(
    () => tokenGetter?.() ?? reduxToken ?? null,
    [tokenGetter, reduxToken]
  );
  const [selectedKey, setSelectedKey] = useState<string>(
    initialSelectedKey ?? (categories[0]?.key ?? "")
  );
  const [uploading, setUploading] = useState(false);

  // files & results
  const [filesByKey, setFilesByKey] = useState<Record<string, File[]>>({});
  const [uploadResults, setUploadResults] = useState<UploadResultsByCategory>({});

  // validation gate
  const [validated, setValidated] = useState<null | "ok" | "error">(null);
  const [canUpload, setCanUpload] = useState(false);

  // validation UX
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showProceedModal, setShowProceedModal] = useState(false);

  // Sequential error modals (queue per-category)
  const [errorQueue, setErrorQueue] = useState<
    { categoryKey: string; categoryName: string; results: FileUploadResult[] }[]
  >([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const currentError = errorQueue.length ? errorQueue[0] : null;

  // remember where Upload All halted
  const [haltedAtKey, setHaltedAtKey] = useState<string | null>(null);

  // bulk / picking
  const [dragOver, setDragOver] = useState(false);
  const dragDepthRef = useRef(0);
  const [lastAssignments, setLastAssignments] = useState<{ name: string; key: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- global cursor ---------- */
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

  /* ---------- in-memory cache ---------- */
  const cacheKey = useMemo(() => `mcu:${module}:${workflowId}`, [module, workflowId]);

  useEffect(() => {
    const g: any = (window as any);
    const cache: Map<string, any> = g.__MCU_CACHE__ ?? (g.__MCU_CACHE__ = new Map());
    const memo = cache.get(cacheKey);
    if (memo) {
      setFilesByKey(memo.filesByKey ?? {});
      setUploadResults(memo.uploadResults ?? {});
      if (memo.selectedKey) setSelectedKey(memo.selectedKey);
      if (memo.lastAssignments) setLastAssignments(memo.lastAssignments);
    }
  }, [cacheKey]);

  useEffect(() => {
    const g: any = (window as any);
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

  /* ---------- file ops ---------- */
  const setCategoryFiles = useCallback((key: string, files: File[]) => {
    setFilesByKey((prev) => ({ ...prev, [key]: files }));
    // reset ONLY that category's results (others intact)
    setUploadResults((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
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

  // Whenever ANY category files change  disable upload until re-validated
  useEffect(() => {
    setValidated(null);
    setCanUpload(false);
    setValidationErrors([]);
  }, [filesByKey]);

  /* ---------- validation ---------- */
  const parseAcceptList = (acc?: string): string[] => {
    if (!acc) return [];
    return acc
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  };

  const fileMatchesAccept = (file: File, accepts: string[]) => {
    if (accepts.length === 0) return true;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext) return false;
    return accepts.some((a) => a.startsWith(".") && a.slice(1) === ext);
  };

  const validateNow = useCallback(() => {
    const errs: string[] = [];
    for (const c of categories) {
      const files = filesByKey[c.key] ?? [];

      if (c.required && files.length === 0) {
        errs.push(`${c.label} is required.`);
      }

      const limit = c.maxFiles ?? Infinity;
      if (files.length > limit) {
        errs.push(`${c.label} exceeds maximum of ${limit} file(s).`);
      }

      const cap = (c.maxSizeMB ?? maxSizeMB) * 1024 * 1024;
      const accepts = parseAcceptList(c.accept ?? accept);

      for (const f of files) {
        if (f.size > cap) {
          errs.push(`${c.label}: ${f.name} is larger than ${c.maxSizeMB ?? maxSizeMB} MB.`);
        }
        if (!fileMatchesAccept(f, accepts)) {
          errs.push(`${c.label}: ${f.name} has an unsupported file type.`);
        }
      }
    }

    setValidationErrors(errs);
    const ok = errs.length === 0;
    setValidated(ok ? "ok" : "error");
    if (ok) setShowProceedModal(true);
    return ok;
  }, [categories, filesByKey, maxSizeMB, accept]);

  /* ---------- clear all ---------- */
  const clearAll = useCallback(() => {
    setFilesByKey({});
    setUploadResults({});
    setValidated(null);
    setCanUpload(false);
    setValidationErrors([]);

    const g: any = (window as any);
    const cache: Map<string, any> = g.__MCU_CACHE__ ?? (g.__MCU_CACHE__ = new Map());
    cache.set(cacheKey, { filesByKey: {}, uploadResults: {}, selectedKey, lastAssignments: [] });
  }, [cacheKey, selectedKey]);

  /* ---------- error modal queue helpers ---------- */
  const enqueueError = useCallback(
    (payload: { categoryKey: string; categoryName: string; results: FileUploadResult[] }) => {
      setErrorQueue((prev) => [...prev, payload]);
      setShowErrorModal(true);
    },
    []
  );

  const popError = useCallback(() => {
    setErrorQueue((prev) => {
      const [, ...rest] = prev;
      if (rest.length === 0) {
        setShowErrorModal(false);
      }
      return rest;
    });
  }, []);

  /* ---------- upload (single category) ---------- */
  type UploadOutcome = { ok: boolean; results: FileUploadResult[] };

  const uploadSingleCategory = useCallback(
    async (key: string, files: File[], override = false): Promise<UploadOutcome> => {
      console.log('files: ', files)
      if (!files.length) return { ok: true, results: [] }; // nothing to do
      const token = getToken() ?? undefined;
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

            // guard 204 / non-json
            const text = await response.text();
            const result = text ? JSON.parse(text) : {};

            results.push({
              filename: file.name,
              success: !!(result as any)?.success,
              data: (result as any)?.data,
              msg: (result as any)?.msg,
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

        const allSuccess = results.every((r) => r.success);

        // When not overriding, queue this category's failures for modal.
        if (!override && !allSuccess) {
          enqueueError({
            categoryKey: key,
            categoryName: getCategoryLabel(key),
            results,
          });
        }

        return { ok: allSuccess, results };
      } finally {
        setUploading(false);
      }
    },
    [
      categories,
      context,
      endpoint,
      module,
      onResultsChange,
      pathBuilder,
      getToken,
      workflowId,
      getCategoryLabel,
      enqueueError,
    ]
  );

  /* ---------- Upload range helper (continues from index; halts on failure) ---------- */
  const uploadFromIndex = useCallback(
    async (startIdx: number) => {
      setHaltedAtKey(null);
      for (let i = startIdx; i < categories.length; i++) {
        const c = categories[i];
        const fs = filesByKey[c.key];
        if (!fs?.length) continue;

        const { ok } = await uploadSingleCategory(c.key, fs, false);
        if (!ok) {
          setSelectedKey(c.key);
          setHaltedAtKey(c.key);
          break; // stop; wait for user action
        }
      }
    },
    [categories, filesByKey, uploadSingleCategory]
  );

  /* ---------- Upload All (start from beginning) ---------- */
  const uploadAll = useCallback(async () => {
    if (!canUpload) return;

    if (validated !== "ok" || validationErrors.length > 0) {
      setValidated("error");
      return;
    }
    await uploadFromIndex(0);
  }, [canUpload, validated, validationErrors.length, uploadFromIndex]);

  /* ---------- Force upload (per category, override=true) ---------- */
  const forceUploadCategory = useCallback(
    async (key: string) => {
      const fs = filesByKey[key] ?? [];
      if (!fs.length || uploading) return;
      await uploadSingleCategory(key, fs, true); // override = true
    },
    [filesByKey, uploading, uploadSingleCategory]
  );

  /* ---------- Proceed-anyway flow: force current then continue ---------- */
  const getFailedFilesForKey = useCallback(
    (key: string, results: FileUploadResult[]): File[] => {
      const failedNames = new Set(
        results
          .filter((r) => !r.success && getValidationStatus(r) === "failed")
          .map((r) => r.filename)
      );
      const originals = filesByKey[key] ?? [];
      return originals.filter((f) => failedNames.has(f.name));
    },
    [filesByKey]
  );

  const proceedAnywayAndContinue = useCallback(
    async (categoryKey: string, results: FileUploadResult[]) => {
      // 1) Force upload only the FAILED ones of this category
      const failedFiles = getFailedFilesForKey(categoryKey, results);
      const { ok: forcedOk } = await uploadSingleCategory(categoryKey, failedFiles, true);

      // 2) If still not OK (e.g., backend returns hard error or still fails), halt here.
      if (!forcedOk) {
        // show a new modal if error persists (manual queue; since we call with override, uploadSingleCategory didn't enqueue)
        const rs = (uploadResults[categoryKey] ?? []);
        if (rs.some((r) => !r.success)) {
          enqueueError({
            categoryKey,
            categoryName: getCategoryLabel(categoryKey),
            results: rs,
          });
        }
        setHaltedAtKey(categoryKey);
        return;
      }

      // 3) Continue from next category after the halted one
      const startIdx = Math.max(0, categories.findIndex((c) => c.key === categoryKey) + 1);
      await uploadFromIndex(startIdx);
    },
    [
      categories,
      uploadResults,
      getFailedFilesForKey,
      uploadSingleCategory,
      uploadFromIndex,
      enqueueError,
      getCategoryLabel,
    ]
  );

  /* ---------- DnD handlers (assign only) ---------- */
  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!bulk?.enabled || uploading) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current += 1;
      setDragOver(true);
    },
    [bulk?.enabled, uploading]
  );

  const onDragOverHandler = useCallback(
    (e: React.DragEvent) => {
      if (!bulk?.enabled || uploading) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        (e.dataTransfer as any).dropEffect = "copy";
      } catch {}
    },
    [bulk?.enabled, uploading]
  );

  const onDragLeaveHandler = useCallback(
    (e: React.DragEvent) => {
      if (!bulk?.enabled || uploading) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDragOver(false);
    },
    [bulk?.enabled, uploading]
  );

  const assignFiles = useCallback(
    (files: File[]) => {
      if ((bulk.assign ?? "selected") === "selected") {
        console.log('586',files)
        const key = selectedKey || categories[0]?.key;
        if (!key) return;
        appendCategoryFiles(key, files);
        setSelectedKey(key);
        setLastAssignments(files.map((f) => ({ name: f.name, key })));
      } else {
        const order = categories.map((c) => c.key);
        const strat: BulkStrategy = bulk.strategy ?? "sequential";
        const groups = new Map<string, File[]>();
        const assignments: { name: string; key: string }[] = [];
        const pickKey = (i: number) =>
          strat === "roundrobin"
            ? order[i % order.length]
            : order[i < order.length ? i : i % order.length];

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
        }
        setLastAssignments(assignments);
      }
    },
    [appendCategoryFiles, bulk.assign, bulk.strategy, categories, selectedKey]
  );

  const onDropHandler = useCallback(
    async (e: React.DragEvent) => {
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
      assignFiles(files); // assign only (no auto-validate/upload)
    },
    [bulk?.enabled, uploading, assignFiles]
  );

  const onPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!bulk?.enabled || uploading) return;
      const files = Array.from(e.target.files || []);
      e.currentTarget.value = "";
      if (!files.length) return;
      assignFiles(files); // assign only (no auto-validate/upload)
    },
    [bulk?.enabled, uploading, assignFiles]
  );

  /* ---------- All-files / failed collectors ---------- */
  const summary = useMemo(() => {
    const parts: string[] = [];
    for (const c of categories) {
      const n = filesByKey[c.key]?.length ?? 0;
      if (n) parts.push(`${n} ${c.label.toLowerCase()}`);
    }
    return parts.join("  ");
  }, [categories, filesByKey]);

  const allFiles = useMemo(() => {
    return categories.map((c) => ({
      key: c.key,
      label: c.label,
      files: filesByKey[c.key] ?? [],
    }));
  }, [categories, filesByKey]);

  /* ---------- Render ---------- */
  return (
    <div
      className={`mx-auto p-4 sm:p-6 ${uploading ? "cursor-progress" : "cursor-auto"}`}
      aria-busy={uploading}
    >
      <div className="rounded-3xl border border-slate-200 bg-white/70 backdrop-blur-md shadow-sm relative overflow-hidden">
        {/* Sticky top actions */}
        <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-md  border-slate-200">
          <div className="flex items-center justify-between px-5 py-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">
                {title}
              </h3>
              {subtitle ? (
                <p className="text-xs text-slate-600">{subtitle}</p>
              ) : (
                <p className="text-xs text-slate-600">
                  Accepted: <span className="font-medium">{accept}</span>{" "}
                  <span className="mx-1"></span> Max {maxSizeMB}MB/file
                </p>
              )}
              {!!summary && (
                <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">Selected: {summary}</p>
              )}
              {haltedAtKey && !uploading && (
                <div className="mt-1">
                  <Pill tone="orange" title="Upload All paused until this input succeeds">
                    Halted at {getCategoryLabel(haltedAtKey)}
                  </Pill>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={validateNow}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                <InformationCircleIcon className="h-4 w-4" />
                Validate
              </button>
              <button
                type="button"
                onClick={uploadAll}
                disabled={!canUpload || uploading}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  !canUpload || uploading
                    ? "bg-amber-300/60 text-slate-700 cursor-not-allowed"
                    : "bg-amber-400 text-slate-900 hover:brightness-95 cursor-pointer"
                }`}
                title={!canUpload ? "Validate and proceed first" : "Upload all files"}
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                Upload All
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                <TrashIcon className="h-4 w-4" />
                Clear
              </button>

              {/* Status chip */}
              {uploading ? (
                <Pill tone="blue" title="Uploading in progress">
                  <ArrowUpTrayIcon className="h-4 w-4 mr-1 animate-pulse" />
                  Uploading
                </Pill>
              ) : validated === "ok" ? (
                <Pill tone="green" title="Validation passed (click Proceed to enable upload)">
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Validated
                </Pill>
              ) : validated === "error" ? (
                <Pill tone="red" title="Validation failed">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  Fix issues
                </Pill>
              ) : null}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 p-5">
          {/* LEFT: Work area (drop + lists) */}
          <section aria-labelledby="work-area-title" className="space-y-4">
            <h4 id="work-area-title" className="sr-only">
              Work area
            </h4>

            {/* Drop area (assign only) */}
            <div
              className={`relative rounded-2xl ring-1 ring-inset ring-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 min-h-[360px] ${
                uploading ? "cursor-progress" : "cursor-pointer"
              }`}
              onDragEnter={onDragEnter}
              onDragOver={onDragOverHandler}
              onDragLeave={onDragLeaveHandler}
              onDrop={onDropHandler}
              onClick={() => {
                if (uploading) return;
                fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (uploading) return;
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Drop files here or click to upload"
              aria-disabled={uploading}
            >
              <div className="flex h-full w-full items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-3 w-12 h-12 rounded-xl ring-1 ring-slate-200 bg-white flex items-center justify-center shadow-sm">
                    <CloudArrowUpIcon
                      className={`h-6 w-6 ${uploading ? "animate-pulse text-slate-400" : "text-slate-700"}`}
                    />
                  </div>

                  <div className="mb-2">
                    <Pill tone="yellow">Active: {selectedCategory?.label ?? ""}</Pill>
                    <span className="ml-2 text-[11px] text-slate-600">
                      <code className="text-slate-800">document_type={selectedKey}</code>
                    </span>
                  </div>

                  <p className={`text-sm font-medium ${uploading ? "text-slate-500" : "text-slate-900"}`}>
                    Drop files here or{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        if (uploading) return;
                        e.preventDefault();
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className={`underline decoration-amber-400 underline-offset-2 ${
                        uploading ? "cursor-not-allowed text-slate-400" : "cursor-pointer"
                      }`}
                      disabled={uploading}
                    >
                      browse
                    </button>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {bulk.assign === "selected"
                      ? "Files will be assigned to the active category."
                      : "Files will be assigned to categories in order (1st file  1st category, etc.)."}
                  </p>

                  {!!lastAssignments.length && (
                    <div className="mt-5 text-left">
                      <h4 className="text-xs font-semibold text-slate-800 mb-2">Last assignment</h4>
                      <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {lastAssignments.map((a, i) => (
                          <li key={`${a.name}-${i}`} className="text-xs text-slate-700 flex items-center gap-2">
                            <DocumentIcon className="h-4 w-4 text-slate-500" />
                            <span className="truncate">{a.name}</span>
                            <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                              {getCategoryLabel(a.key)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {dragOver && (
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-amber-400/70 bg-amber-50/40" />
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

            {/* All uploaded files (across ALL categories) */}
            <div className="rounded-2xl ring-1 ring-inset ring-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900 mb-2">All uploaded files</div>
              {allFiles.every((g) => g.files.length === 0) ? (
                <p className="text-sm text-slate-500">
                  No files added yet. Files for every input will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {allFiles.map((group) => {
                    if (group.files.length === 0) return null;
                    const results = uploadResults[group.key] ?? [];
                    return (
                      <div key={group.key} className="border border-slate-200 rounded-xl p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-medium text-slate-900">
                            {getCategoryLabel(group.key)}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedKey(group.key)}
                              className="text-xs rounded-md px-2 py-1 ring-1 ring-slate-200 hover:bg-slate-50 cursor-pointer"
                            >
                              Focus
                            </button>
                            {canForceUploadForKey(group.key, uploadResults) && (
                              <button
                                type="button"
                                onClick={() => forceUploadCategory(group.key)}
                                className="text-xs inline-flex items-center gap-1 rounded-md px-2 py-1 ring-1 ring-slate-200 hover:bg-slate-50 cursor-pointer"
                                title="Force upload this input (override=true)"
                                disabled={uploading}
                              >
                                <BoltIcon className="h-4 w-4" />
                                Force upload
                              </button>
                            )}
                          </div>
                        </div>
                        <ul className="flex flex-wrap gap-2">
                          {group.files.map((file, i) => {
                            const r = results.find((x) => x.filename === file.name);
                            const tone: "default" | "green" | "yellow" | "red" =
                              r?.success ? "green" : r ? "red" : "default";
                            return (
                              <li
                                key={`${file.name}-${file.size}-${i}`}
                                className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800"
                              >
                                <DocumentIcon className="h-4 w-4 text-slate-500" />
                                <span className="max-w-[220px] truncate">{file.name}</span>
                                <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                                <Pill tone={tone}>
                                  {r?.success ? "Uploaded" : r ? "Failed" : "Queued"}
                                </Pill>
                                <button
                                  type="button"
                                  onClick={() => removeFile(group.key, file)}
                                  aria-label={`Remove ${file.name}`}
                                  disabled={uploading}
                                  className="ml-1 rounded-lg p-1 text-slate-500 hover:text-slate-700 hover:bg-white/70 ring-1 ring-transparent hover:ring-slate-200 disabled:opacity-60 cursor-pointer"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Validation errors (inline) */}
            {validated === "error" && validationErrors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Please address the following:
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* RIGHT: categories list */}
          <aside
            className="flex flex-col gap-3 min-h-0 max-h-[calc(90vh-12rem)] overflow-y-auto overscroll-contain"
            role="region"
            aria-label="Upload categories"
          >
            {categories.map((c) => {
              const count = filesByKey[c.key]?.length ?? 0;
              const rs = uploadResults[c.key] ?? [];
              const failures = rs.filter((r) => !r.success);
              const succCount = rs.filter((r) => r.success).length;
              const isActive = selectedKey === c.key;

              if (rightCardsMode === "status-only") {
                return (
                  <div
                    key={c.key}
                    className={`rounded-xl ring-1 ring-inset bg-white p-4 shadow-sm transition-all ${
                      isActive ? "ring-amber-300" : "ring-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-inset ring-slate-200">
                            <DocumentIcon className="h-4 w-4 text-slate-600" />
                          </span>
                          <div className="font-medium text-slate-900 truncate">{c.label}</div>
                        </div>
                        {c.description && (
                          <p className="text-[11px] text-slate-600 pl-9">{c.description}</p>
                        )}
                        <div className="pl-9 flex flex-wrap items-center gap-2 pt-1">
                          {c.required && count === 0 ? (
                            <Pill tone="red">Required</Pill>
                          ) : (
                            <Pill tone="default">
                              {count ? `${count} file${count > 1 ? "s" : ""}` : "No files"}
                            </Pill>
                          )}
                          {succCount > 0 && <Pill tone="green">{succCount} uploaded</Pill>}
                          {failures.length > 0 && <Pill tone="yellow">{failures.length} failed</Pill>}
                          {isActive && <Pill tone="yellow">Active</Pill>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedKey(c.key)}
                          className="rounded-md p-1.5 bg-white ring-1 ring-inset ring-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                          title="Set active"
                          disabled={uploading}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>

                        {count > 0 && (
                          <button
                            type="button"
                            onClick={() => clearCategory(c.key)}
                            className="rounded-md p-1.5 bg-white ring-1 ring-inset ring-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                            title="Clear files"
                            disabled={uploading}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}

                        {canForceUploadForKey(c.key, uploadResults) && (
                          <button
                            type="button"
                            onClick={() => forceUploadCategory(c.key)}
                            className="rounded-md p-1.5 bg-white ring-1 ring-inset ring-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                            title="Force upload this input (override=true)"
                            disabled={uploading}
                          >
                            <BoltIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Interactive card (no auto-upload)
              const _accept = c.accept ?? accept;
              const _maxSizeMB = c.maxSizeMB ?? maxSizeMB;
              const _maxFiles = c.maxFiles ?? 3;

              return (
                <div
                  key={c.key}
                  className={`transition-all duration-200 rounded-xl ${
                    isActive ? "ring-2 ring-amber-300" : "ring-1 ring-inset ring-slate-200"
                  } bg-white`}
                  role="button"
                  onClick={() => !uploading && setSelectedKey(c.key)}
                  aria-current={isActive ? "true" : "false"}
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
                      setCategoryFiles(c.key, files); // replace
                      setSelectedKey(c.key);
                      // No auto validate/upload
                    }}
                    emptyHint={c.emptyHint ?? `Click to upload or drag & drop`}
                    variant="card"
                    hideFileList
                    disabled={uploading}
                  />
                </div>
              );
            })}
          </aside>
        </div>
      </div>

      {/* Proceed Modal (after successful validate) */}
      {showProceedModal && (
        <div className="fixed inset-0 z-50 bg-black/10 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl ring-1 ring-slate-200">
            <div className="px-5 py-4  border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center ring-1 ring-emerald-200">
                <CheckCircleIcon className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Validation passed</h3>
                <p className="text-xs text-slate-600">You can now proceed to enable uploading.</p>
              </div>
            </div>

            <div className="px-5 py-4 text-sm text-slate-800 space-y-2">
              <p className="text-slate-700">Summary:</p>
              <ul className="list-disc pl-5 space-y-1">
                {categories.map((c) => {
                  const n = (filesByKey[c.key] ?? []).length;
                  return (
                    <li key={c.key}>
                      <span className="font-medium">{c.label}:</span> {n} file{n === 1 ? "" : "s"}
                      {c.required && n === 0 ? " (required)" : ""}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowProceedModal(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <XMarkIcon className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setCanUpload(true);
                  setShowProceedModal(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-amber-400 text-slate-900 hover:brightness-95 cursor-pointer"
              >
                Enable Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Error Modal (SEQUENTIAL  shows one category at a time) */}
      {showErrorModal && currentError && (
        <div className="fixed inset-0 z-50 bg-black/10 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between px-5 py-4  border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center ring-1 ring-amber-200">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Some files failed to upload
                  </h3>
                  <p className="text-xs text-slate-600">{currentError.categoryName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={popError}
                className="text-slate-500 hover:text-slate-700 transition-colors p-2 cursor-pointer"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
              <ul className="space-y-2">
                {currentError.results
                  .filter((r) => !r.success)
                  .map((res, idx) => (
                    <li
                      key={`${res.filename}-${idx}`}
                      className="rounded-lg ring-1 ring-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <DocumentIcon className="h-4 w-4 text-amber-700 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 truncate">{res.filename}</p>
                            <Pill tone="yellow">Failed</Pill>
                          </div>
                          {res.msg && (
                            <p className="text-xs text-slate-700 mt-1">
                              <span className="font-medium">Message:</span> {res.msg}
                            </p>
                          )}
                          {res.error && (
                            <p className="text-xs text-slate-700 mt-1">
                              <span className="font-medium">Error:</span> {res.error}
                            </p>
                          )}
                          {res.data && (
                            <details className="mt-2">
                              <summary className="text-xs text-slate-600 cursor-pointer select-none">
                                Server response
                              </summary>
                              <pre className="text-[11px] bg-slate-100 rounded-md p-2 mt-1 overflow-x-auto">
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

            {/* Footer: Proceed anyway shown ONLY if there is at least one 'failed' and NO 'error'. */}
            {(() => {
              const canProceedAnyway =
                hasFailedStatus(currentError.results) && !hasErrorStatus(currentError.results);
              return (
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={popError}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    Close
                  </button>

                  {canProceedAnyway && (
                    <button
                      type="button"
                      onClick={async () => {
                        // Close this modal
                        popError();
                        // Force this category's failed files then continue with next categories
                        await proceedAnywayAndContinue(currentError.categoryKey, currentError.results);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-amber-400 text-slate-900 hover:brightness-95 cursor-pointer"
                    >
                      <ArrowUpTrayIcon className="h-4 w-4" />
                      Proceed anyway
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

