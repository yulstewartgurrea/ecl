import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface InputFileItem {
  name: string;
  is_folder: boolean;
  is_sync?: boolean;
}

interface wfHelperData {
  [key: string]: any;
  // map: "/Entity/Loan/Period/Date/WorkflowName" -> step index
  stepsByWorkflowPath?: Record<string, number>;
  // map: "/Entity/Period/WorkflowName" -> uploaded input files
  inputFilesByWorkflowPath?: Record<string, InputFileItem[]>;
}

const initialState: wfHelperData = {
  selectedPdTransitionMatrixEntity: "",
  selectedPdTransitionMatrixReportingPeriod: "",
  // NEW fields
  selectedPdTransitionMatrixLoanProduct: "",
  selectedPdTransitionMatrixReportDateStart: "",

  pdTransitionMatrixWfName: "",
  currentPdTransitionMatrixWfLogId: null,
  currentPdTransitionMatrixWorkflowId: null,
  currentPdTransitionMatrixWorkflowData: null, // Store full workflow data
  isPdTransitionMatrixWfStarted: false,
  isPdTransitionMatrixWfFinish: false,
  isPdTransitionMatrixImportedOnce: false,

  // generic “last used” step (still kept for backwards-compat)
  currentStep: 0,

  // NEW: per-workflow step map
  stepsByWorkflowPath: {},

  // NEW: per-workflow uploaded input files (survives step navigation / reload)
  inputFilesByWorkflowPath: {},
};

const PdTransitionMatrixWfHelperSlice = createSlice({
  name: "pd_transition_matrix_workflow_helper",
  initialState,
  reducers: {
    setPdTransitionMatrixSelectedEntity(
      state,
      action: PayloadAction<{ entity: string }>
    ) {
      const { entity } = action.payload;
      if (entity !== undefined) {
        state.selectedPdTransitionMatrixEntity = entity;
      }
    },

    setPdTransitionMatrixWfName(
      state,
      action: PayloadAction<{ workflow_name: string }>
    ) {
      state.pdTransitionMatrixWfName = action.payload.workflow_name;
    },

    setPdTransitionMatrixSelectedReportingPeriod(
      state,
      action: PayloadAction<{ period: string }>
    ) {
      const { period } = action.payload;
      if (period !== undefined) {
        state.selectedPdTransitionMatrixReportingPeriod = period;
      }
    },

    // NEW: save Loan Product in Redux
    setPdTransitionMatrixSelectedLoanProduct(
      state,
      action: PayloadAction<{ loan_product: string }>
    ) {
      state.selectedPdTransitionMatrixLoanProduct = action.payload.loan_product;
    },

    // NEW: save Report Date Start in Redux (YYYY-MM-DD)
    setPdTransitionMatrixReportDateStart(
      state,
      action: PayloadAction<{ report_date_start: string }>
    ) {
      state.selectedPdTransitionMatrixReportDateStart =
        action.payload.report_date_start;
    },

    setPdTransitionMatrixWfLogId(
      state,
      action: PayloadAction<{ workflow_id: number }>
    ) {
      state.currentPdTransitionMatrixWfLogId = action.payload.workflow_id;
    },

    setPdTransitionMatrixIsWfStarted(
      state,
      action: PayloadAction<{ is_workflow_started: boolean }>
    ) {
      state.isPdTransitionMatrixWfStarted = action.payload.is_workflow_started;
    },

    setPdTransitionMatrixInputFilesIsImportedOnce(
      state,
      action: PayloadAction<{ is_imported_once: boolean }>
    ) {
      state.isPdTransitionMatrixImportedOnce = action.payload.is_imported_once;
    },

    setPdTransitionMatrixIsWfFinish(
      state,
      action: PayloadAction<{ is_workflow_finish: boolean }>
    ) {
      state.isPdTransitionMatrixWfFinish = action.payload.is_workflow_finish;
    },

    setPdTransitionMatrixWfData: (
      _state,
      action: PayloadAction<wfHelperData>
    ) => {
      return action.payload;
    },

    resetPdTransitionMatrixWfHelperData: () => {
      // full reset including per-workflow steps
      return {
        ...initialState,
        stepsByWorkflowPath: {},
        inputFilesByWorkflowPath: {},
      };
    },

    // 🔥 NEW: store step globally + per workflowPath
    setPdTransitionMatrixCurrentStep(
      state,
      action: PayloadAction<{ step: number; workflowPath?: string }>
    ) {
      const { step, workflowPath } = action.payload;
      state.currentStep = step;

      if (workflowPath) {
        if (!state.stepsByWorkflowPath) {
          state.stepsByWorkflowPath = {};
        }
        state.stepsByWorkflowPath[workflowPath] = step;
      }
    },

    // 🔥 NEW: store the uploaded input files per workflowPath so they
    // survive the Step1 unmount/remount when navigating between steps.
    setPdTransitionMatrixInputFiles(
      state,
      action: PayloadAction<{ workflowPath: string; files: InputFileItem[] }>
    ) {
      const { workflowPath, files } = action.payload;
      if (!workflowPath) return;
      if (!state.inputFilesByWorkflowPath) {
        state.inputFilesByWorkflowPath = {};
      }
      state.inputFilesByWorkflowPath[workflowPath] = files;
    },

    clearPdTransitionMatrixWorkflowStep(
      state,
      action: PayloadAction<{ workflowPath?: string }>
    ) {
      const { workflowPath } = action.payload;
      if (!workflowPath) {
        state.stepsByWorkflowPath = {};
        return;
      }
      if (state.stepsByWorkflowPath) {
        delete state.stepsByWorkflowPath[workflowPath];
      }
    },

    setPdTransitionMatrixWorkflowId(
      state,
      action: PayloadAction<{ workflow_id: number | null }>
    ) {
      state.currentPdTransitionMatrixWorkflowId = action.payload.workflow_id;
    },

    setPdTransitionMatrixWorkflowData(
      state,
      action: PayloadAction<{ workflow_data: any }>
    ) {
      state.currentPdTransitionMatrixWorkflowData =
        action.payload.workflow_data;
    },
  },
});

export const {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWfLogId,
  setPdTransitionMatrixIsWfStarted,
  setPdTransitionMatrixInputFilesIsImportedOnce,
  setPdTransitionMatrixIsWfFinish,
  setPdTransitionMatrixWfData,
  resetPdTransitionMatrixWfHelperData,
  setPdTransitionMatrixCurrentStep,
  setPdTransitionMatrixInputFiles,
  clearPdTransitionMatrixWorkflowStep,
  setPdTransitionMatrixWorkflowId,
  setPdTransitionMatrixWorkflowData,
  // NEW exports
  setPdTransitionMatrixSelectedLoanProduct,
  setPdTransitionMatrixReportDateStart,
} = PdTransitionMatrixWfHelperSlice.actions;

export default PdTransitionMatrixWfHelperSlice.reducer;
