import { useCallback, useMemo, useState } from "react";
import type { IssueRow } from "../components/modals/OverlayUploadResultModal";

type UploadFnArgs = {
  file: File;
  override?: boolean;
};

type UseUploadManagerArgs = {
  uploadFn: (args: UploadFnArgs) => Promise<void>;
};

export function useUploadManager({ uploadFn }: UseUploadManagerArgs) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // --------------------------------------------------
  // Reset all upload-related state
  // --------------------------------------------------
  const reset = useCallback(() => {
    setUploading(new Set());
    setUploaded(new Set());
    setFailed(new Set());
    setIssues([]);
    setModalOpen(false);
    setSuccessBanner(null);
  }, []);

  // --------------------------------------------------
  // Upload a single file
  // --------------------------------------------------
  const startUpload = useCallback(
    async (file: File, override = false) => {
      const name = file.name;

      // Only block if currently uploading (NOT failed / uploaded)
      if (uploading.has(name)) return;

      setUploading((prev) => new Set(prev).add(name));

      try {
        await uploadFn({ file, override });

        setUploaded((prev) => new Set(prev).add(name));
        setFailed((prev) => {
          const ns = new Set(prev);
          ns.delete(name);
          return ns;
        });

        setIssues([]);
        setModalOpen(false);
        setSuccessBanner(`${name} uploaded successfully.`);
      } catch (err: any) {
        const issue: IssueRow = {
          fileName: err?.fileName ?? name,
          status: err?.status ?? 0,
          ok: false,
          kind: "error", // ✅ matches modal contract
          payload: err?.payload ?? err,
          normalized: err?.normalized,
        };

        setFailed((prev) => new Set(prev).add(name));
        setUploaded((prev) => {
          const ns = new Set(prev);
          ns.delete(name);
          return ns;
        });

        // FORCE modal refresh even if same error repeats
        setModalOpen(false);
        setIssues([]);

        setTimeout(() => {
          setIssues([issue]);
          setModalOpen(true);
        }, 0);

        setSuccessBanner(null);
      } finally {
        setUploading((prev) => {
          const ns = new Set(prev);
          ns.delete(name);
          return ns;
        });
      }
    },
    [uploadFn, uploading]
  );

  // --------------------------------------------------
  // Called when files are selected from dropzone
  // --------------------------------------------------
  const onFilesSelected = useCallback(
    async (nextFiles: File[]) => {
      const single = nextFiles.slice(-1);

      reset();
      setFiles(single);

      for (const f of single) {
        if (!(f as any).isExisting) {
          await startUpload(f);
        }
      }
    },
    [reset, startUpload]
  );

  // --------------------------------------------------
  // Derived status
  // --------------------------------------------------
  const status = useMemo(() => {
    if (files.length === 0) return "empty";
    if (uploading.size > 0) return "uploading";
    if (failed.size > 0) return "error";
    if (uploaded.size === files.length) return "success";
    return "idle";
  }, [files.length, uploading.size, failed.size, uploaded.size]);

  return {
    // state
    files,
    uploading,
    uploaded,
    failed,
    issues,
    modalOpen,
    successBanner,
    status,

    // actions
    setFiles,
    setIssues,
    setModalOpen,
    reset,
    onFilesSelected,
    startUpload,
  };
}
