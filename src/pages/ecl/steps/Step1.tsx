// ==========================
// pages/flowrate/steps/Step1.tsx
// ==========================
import MultiCategoryUploader, {
  type CategoryConfig,
  type PathBuilderContext,
  type UploadResultsByCategory,
} from "../../../components/uploader/MultiCategoryUploader";
import { useAppSelector } from "../../../redux_toolkit/hooks";

const categories: CategoryConfig[] = [
  {
    key: "CREDIT_LOSS_RATE",
    label: "CREDIT LOSS RATE",
    description: "CSV or Excel. Upload your aging report data.",
    required: true,
  },
];

/**
 * 🔗 Align upload path with workflow path:
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

  console.log("Step1 - Workflow Data:", currentPdTransitionMatrixWorkflowData);

  // Prefer Redux workflowId, then localStorage, finally fallback to 1
  const workflowIdFromRedux = currentPdTransitionMatrixWorkflowId;

  let workflowIdFromLS: number | null = null;
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem("current_workflow_id");
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed > 0) {
        workflowIdFromLS = parsed;
      }
    }
  }

  const workflowId: number =
    workflowIdFromRedux ??
    (workflowIdFromLS !== null ? workflowIdFromLS : 1);

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
    subdir: "input/ecl",
  };

  console.log("Uploader context:", context);
  console.log("Step1 - final workflowId:", workflowId);

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
        module="CREDIT_LOSS_RATE"
        workflowId={String(workflowId)}
        context={context}
        pathBuilder={pathBuilder}
        initialSelectedKey="CREDIT_LOSS_RATE"
        onResultsChange={handleResults}
        bulk={{ enabled: true, assign: "selected", strategy: "sequential" }}
        rightCardsMode="status-only"
      />
    </div>
  );
}
