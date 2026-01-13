import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface ExecutionInputFileState {
  execution_input_file: "forecast_mev" | "manual_upload" | null;
}

const initialState: ExecutionInputFileState = {
  execution_input_file: "manual_upload",
};

const executionInputFileSlice = createSlice({
  name: "executionInputFile",
  initialState,
  reducers: {
    setExecutionInputFile: (
      state,
      action: PayloadAction<"forecast_mev" | "manual_upload">
    ) => {
      state.execution_input_file = action.payload;
    },
    resetExecutionInputFile: () => initialState,
  },
});

export const { setExecutionInputFile, resetExecutionInputFile } =
  executionInputFileSlice.actions;
export default executionInputFileSlice.reducer;

