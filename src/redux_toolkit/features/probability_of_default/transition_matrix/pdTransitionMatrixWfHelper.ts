import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface wfHelperData {
  [key: string]: any;
}

const initialState: wfHelperData = {
  selectedPdTransitionMatrixEntity: "",
  selectedPdTransitionMatrixReportingPeriod: "",
  pdTransitionMatrixWfName: "",
  currentPdTransitionMatrixWfLogId: null,
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
      let { entity } = action.payload;
      if (entity) {
        state.selectedPdTransitionMatrixEntity = entity;
      }
    },
    setPdTransitionMatrixWfName(
      state,
      action: PayloadAction<{ workflow_name: string }>
    ) {
      let { workflow_name } = action.payload;
      state.pdTransitionMatrixWfName = workflow_name;
    },
    setPdTransitionMatrixSelectedReportingPeriod(
      state,
      action: PayloadAction<{ period: string }>
    ) {
      let { period } = action.payload;
      if (period) {
        state.selectedPdTransitionMatrixReportingPeriod = period;
      }
    },
    setPdTransitionMatrixWfLogId(
      state,
      action: PayloadAction<{ workflow_id: number }>
    ) {
      let { workflow_id } = action.payload;
      state.currentPdTransitionMatrixWfLogId = workflow_id;
    },
    setPdTransitionMatrixIsWfStarted(
      state,
      action: PayloadAction<{ is_workflow_started: boolean }>
    ) {
      let { is_workflow_started } = action.payload;
      state.isPdTransitionMatrixWfStarted = is_workflow_started;
    },
    setPdTransitionMatrixInputFilesIsImportedOnce(
      state,
      action: PayloadAction<{ is_imported_once: boolean }>
    ) {
      let { is_imported_once } = action.payload;
      state.isPdTransitionMatrixImportedOnce = is_imported_once;
    },
    setPdTransitionMatrixIsWfFinish(
      state,
      action: PayloadAction<{ is_workflow_finish: boolean }>
    ) {
      let { is_workflow_finish } = action.payload;
      state.isPdTransitionMatrixWfFinish = is_workflow_finish;
    },
    setPdTransitionMatrixWfData: (
      _state,
      action: PayloadAction<wfHelperData>
    ) => {
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
} = PdTransitionMatrixWfHelperSlice.actions;
export default PdTransitionMatrixWfHelperSlice.reducer;
