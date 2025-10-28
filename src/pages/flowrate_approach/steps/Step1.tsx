// ==========================
// pages/flowrate/steps/Step1.tsx (WRAPPED with yellow background)
// ==========================
import MultiCategoryUploader, { type CategoryConfig, type PathBuilderContext, type UploadResultsByCategory } from "../../../components/uploader/MultiCategoryUploader";

const categories: CategoryConfig[] = [

  { key: "FLOWRATE_APPROACH_AGING_REPORT", label: "Aging Report", description: "CSV or Excel. Upload your aging report data.", required: true },

];

const pathBuilder = ({ entity, cadence, wf, subdir }: PathBuilderContext) => [entity, cadence, String(wf), subdir].filter(Boolean).join("/");

export default function Step1() {
  const context = { entity: "Entity 1", cadence: "Monthly", wf: "wf3", subdir: "input/flowrate_approach" };
  const handleResults = (results: UploadResultsByCategory) => { console.log("Upload results merged:", results); };

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
        workflowId="1"
        context={context}
        pathBuilder={pathBuilder}
        initialSelectedKey="FLOWRATE_APPROACH_AGING_REPORT"
        onResultsChange={handleResults}
        bulk={{ enabled: true, assign: "selected", strategy: "sequential" }}
        rightCardsMode="status-only"
      />
    </div>
  );
}