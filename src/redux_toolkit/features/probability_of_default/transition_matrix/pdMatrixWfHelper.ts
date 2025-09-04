import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface Metrics {
  duplicate: number;
  valid: number;
  error: number;
  missing: number;
}

interface PdMatrixState {
  currentStep: number;
  workflowMetrics: Record<string, Record<string, Metrics>>; // workflow -> fileKey -> Metrics
}

const initialState: PdMatrixState = {
  currentStep: 0,
  workflowMetrics: {}, // stores metrics per workflow
};

const pdMatrixWfHelperSlice = createSlice({
  name: "pdMatrixWfHelper",
  initialState,
  reducers: {
    setPdMatrixCurrentStep(state, action: PayloadAction<{ step: number }>) {
      state.currentStep = action.payload.step;
    },
    resetPdMatrixWfHelperData(state) {
      state.currentStep = 0;
      state.workflowMetrics = {};
    },
    setWorkflowMetrics(
      state,
      action: PayloadAction<{ workflow: string; metricsMap: Record<string, Metrics> }>
    ) {
      const { workflow, metricsMap } = action.payload;
      state.workflowMetrics[workflow] = {
        ...state.workflowMetrics[workflow],
        ...metricsMap,
      };
    },
    resetWorkflowMetrics(state, action: PayloadAction<{ workflow: string }>) {
      const { workflow } = action.payload;
      state.workflowMetrics[workflow] = {};
    },
  },
});

export const {
  setPdMatrixCurrentStep,
  resetPdMatrixWfHelperData,
  setWorkflowMetrics,
  resetWorkflowMetrics,
} = pdMatrixWfHelperSlice.actions;

export default pdMatrixWfHelperSlice.reducer;
