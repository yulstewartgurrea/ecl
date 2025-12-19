// src/redux_toolkit/features/asa/flowrateStep5Slice.ts
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type Step5Bundle = {
  workflowId: number;
  rows?: any[];                 // dynamic
  rateSets?: any[];             // dynamic
  distribution?: any;           // dynamic
  fetchedAt: string;
};

type State = {
  byWorkflowId: Record<number, Step5Bundle>;
};

const initialState: State = { byWorkflowId: {} };

const slice = createSlice({
  name: "flowrateStep5",
  initialState,
  reducers: {
    setStep5Bundle(state, action: PayloadAction<Step5Bundle>) {
      state.byWorkflowId[action.payload.workflowId] = action.payload;
    },
    clearStep5Bundle(state, action: PayloadAction<number | undefined>) {
      if (action.payload != null) delete state.byWorkflowId[action.payload];
      else state.byWorkflowId = {};
    },
  },
});

export const { setStep5Bundle, clearStep5Bundle } = slice.actions;
export default slice.reducer;

export const selectStep5ByWorkflow = (s: any, workflowId: number) =>
  (s.flowrateStep5?.byWorkflowId ?? {})[workflowId] as Step5Bundle | undefined;
