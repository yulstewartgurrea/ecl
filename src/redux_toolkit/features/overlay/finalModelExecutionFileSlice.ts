import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface FinalModelExecutionFileState {
  final_model_execution_file: boolean;
}

const initialState: FinalModelExecutionFileState = {
  final_model_execution_file: false,
};

const finalModelExecutionFileSlice = createSlice({
  name: "finalModelExecutionFile",
  initialState,
  reducers: {
    setFinalModelExecutionFile: (
      state,
      action: PayloadAction<boolean>
    ) => {
      state.final_model_execution_file = action.payload;
    },
    resetFinalModelExecutionFile: () => initialState,
  },
});

export const { setFinalModelExecutionFile, resetFinalModelExecutionFile } =
  finalModelExecutionFileSlice.actions;
export default finalModelExecutionFileSlice.reducer;
