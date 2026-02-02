// ==========================
// pages/flowrate/steps/Step1.tsx
// ==========================
import { useState, useEffect, useCallback } from "react";
import MultiCategoryUploader, {
  type CategoryConfig,
  type PathBuilderContext,
  type UploadResultsByCategory,
} from "../../../components/uploader/MultiCategoryUploader";
import { useAppSelector } from "../../../redux_toolkit/hooks";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const categories: CategoryConfig[] = [
  {
    key: "FLOWRATE_APPROACH_AGING_REPORT",
    label: "Aging Report",
    description: "CSV or Excel. Upload your aging report data.",
    required: true,
  },
];

/**
 * Align upload path with workflow path:
 *   entity / loanProduct / period / report_date_start / workflowName / subdir
 */
const pathBuilder = (ctx: PathBuilderContext) => {
  const anyCtx = ctx as any;

  const entity = anyCtx.entity; // e.g. "Entity 1"
  const loanProduct = anyCtx.loanProduct; // e.g. "Home"
  const period = anyCtx.cadence; // e.g. "Monthly"
  const wf = anyCtx.wf; // workflow name
  const subdir = anyCtx.subdir; // e.g. "input/flowrate_approach"

  return [
    entity,
    period,
    wf ? String(wf) : undefined,
    loanProduct,
    subdir,
  ]
    .filter(Boolean)
    .join("/");
};

export default function Step1() {
  // Get workflow data + selected fields from Redux
  const {
    currentPdTransitionMatrixWorkflowId,
    currentPdTransitionMatrixWorkflowData,
    selectedPdTransitionMatrixLoanProduct,
    selectedPdTransitionMatrixReportDateStart,
  } = useAppSelector((state: any) => state.pdTransitionMatrixWfHelper);
  
  const token = useAppSelector((state: any) => state.auth?.token) as string | null;
  const [initialFiles, setInitialFiles] = useState<Record<string, File[]>>({});

  console.log("Step1 - Workflow Data:", currentPdTransitionMatrixWorkflowData);

  // Prefer Redux workflowId, then fallback to 1
  const workflowIdFromRedux =
    currentPdTransitionMatrixWorkflowId ?? currentPdTransitionMatrixWorkflowData?.id;
  const workflowId: number = Number.isFinite(Number(workflowIdFromRedux))
    ? Number(workflowIdFromRedux)
    : 1;

  // Prefer values from persisted workflowData; fall back to selected values; finally to sane defaults
  const entity = currentPdTransitionMatrixWorkflowData?.entity || "Entity 1";
  const period =
    currentPdTransitionMatrixWorkflowData?.reporting_period || "Monthly";
  const wfName =
    currentPdTransitionMatrixWorkflowData?.workflow_name || "wf3";
  const loanProduct =
    currentPdTransitionMatrixWorkflowData?.loan_product ||
    selectedPdTransitionMatrixLoanProduct ||
    "GenericLoan";
  const reportDateStart =
    currentPdTransitionMatrixWorkflowData?.report_date_start ||
    selectedPdTransitionMatrixReportDateStart ||
    "2025-01-01";

  const context = {
    entity,
    cadence: period,
    wf: wfName,
    loanProduct,
    reportDateStart,
    subdir: "input/flowrate_approach",
  };

  console.log("Uploader context:", context);
  console.log("Step1 - final workflowId:", workflowId);

  // Fetch existing documents for the workflow
  const fetchExistingDocuments = useCallback(async () => {
    if (!workflowId || !token) {
      setInitialFiles({});
      return;
    }

    const documentTypes = categories.map((c) => c.key).join(",");

    try {
      const response = await fetch(
        `${API_BASE}/documents/workflow-documents/?workflow_id=${workflowId}&document_types=${documentTypes}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        setInitialFiles({});
        return;
      }

      const result = await response.json();

      if (result?.success && Array.isArray(result.data)) {
        const filesByCategory: Record<string, File[]> = {};

        result.data.forEach((doc: any) => {
          const mime =
            doc.filename.endsWith(".csv")
              ? "text/csv"
              : doc.filename.endsWith(".xlsx")
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/vnd.ms-excel";

          const file = new File([], doc.filename, { type: mime }) as File & {
            isExisting?: boolean;
            documentId?: number | string;
          };
          (file as any).isExisting = true;
          (file as any).documentId = doc.id;

          const categoryKey = doc.document_type || categories[0]?.key;
          console.log("Processing document:", { 
            filename: doc.filename, 
            document_type: doc.document_type, 
            categoryKey,
            categoryKeys: categories.map(c => c.key)
          });
          
          if (categoryKey) {
            if (!filesByCategory[categoryKey]) {
              filesByCategory[categoryKey] = [];
            }
            filesByCategory[categoryKey].push(file);
          }
        });

        console.log("Setting initialFiles:", filesByCategory);
        setInitialFiles(filesByCategory);
      } else {
        setInitialFiles({});
      }
    } catch (err) {
      console.error("Failed to fetch existing documents:", err);
      setInitialFiles({});
    }
  }, [workflowId, token]);

  // Fetch existing documents when workflowId or token changes
  useEffect(() => {
    fetchExistingDocuments();
  }, [fetchExistingDocuments]);

  const handleResults = (results: UploadResultsByCategory) => {
    console.log("Upload results merged:", results);
  };

  return (
    <div className="min-h-dvh p-4 ">
      <MultiCategoryUploader
        title="Input Files"
        subtitle="Accepted types: .csv, .xlsx, .xls"
        categories={categories}
        accept=".csv,.xlsx,.xls"
        maxSizeMB={20}
        endpoint="http://localhost:8000/api/document/upload"
        module="FLOWRATE_APPROACH"
        workflowId={String(workflowId)}
        context={context}
        pathBuilder={pathBuilder}
        initialSelectedKey="FLOWRATE_APPROACH_AGING_REPORT"
        onResultsChange={handleResults}
        bulk={{ enabled: true, assign: "selected", strategy: "sequential" }}
        rightCardsMode="status-only"
        initialFiles={initialFiles}
      />
    </div>
  );
}
