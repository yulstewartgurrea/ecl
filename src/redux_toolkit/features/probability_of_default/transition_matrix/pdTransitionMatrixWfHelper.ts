import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface wfHelperData {
  [key: string]: any;
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
  isPdTransitionMatrixWfStarted: false,
  isPdTransitionMatrixWfFinish: false,
  isPdTransitionMatrixImportedOnce: false,
  currentStep: 0,
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

    setPdTransitionMatrixWfData: (_state, action: PayloadAction<wfHelperData>) => {
      return action.payload;
    },

    resetPdTransitionMatrixWfHelperData: () => {
      return initialState;
    },

    setPdTransitionMatrixCurrentStep(
      state,
      action: PayloadAction<{ step: number }>
    ) {
      state.currentStep = action.payload.step;
    },

    setPdTransitionMatrixWorkflowId(
      state,
      action: PayloadAction<{ workflow_id: number | null }>
    ) {
      state.currentPdTransitionMatrixWorkflowId = action.payload.workflow_id;
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
  setPdTransitionMatrixWorkflowId,
  // NEW exports
  setPdTransitionMatrixSelectedLoanProduct,
  setPdTransitionMatrixReportDateStart,
} = PdTransitionMatrixWfHelperSlice.actions;

export default PdTransitionMatrixWfHelperSlice.reducer;
