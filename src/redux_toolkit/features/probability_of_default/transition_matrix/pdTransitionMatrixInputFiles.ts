import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface stateInputFiles {
  fileName: string;
  file: FileState;
  validateStatus: string;
  validationResult: any;
}
interface inputFiles {
  [key: string]: stateInputFiles;
}

interface FileState {
  content: string | null;
  metadata: Partial<File> | null;
}

const initialState: inputFiles = {};

const PdTransitionMatrixInputFilesSlice = createSlice({
  name: "pd_transition_matrix_input_files",
  initialState,
  reducers: {
    setPdTransitionMatrixInputFilesName(
      state,
      action: PayloadAction<{ file_name: string }>
    ) {
      let { file_name } = action.payload;
      file_name = file_name?.trim().toUpperCase();
      state[file_name].fileName = file_name;
      
    },
    setPdTransitionMatrixInputFilesData(
      state,
      action: PayloadAction<{
        file_content: string | null;
        file_metadata: Partial<File> | null;
        file_name: string
      }>
    ) {
      let {  file_content, file_metadata, file_name } = action.payload;
      file_name = file_name?.trim().toUpperCase();
        state[file_name].file.content = file_content;
        state[file_name].file.metadata = file_metadata;
      
    },
    setPdTransitionMatrixInputFilesValidateStatus(
      state,
      action: PayloadAction<{ file_name: string; validate_status: string }>
    ) {
      let { file_name, validate_status } = action.payload;
      file_name = file_name?.trim().toUpperCase();
      if (file_name) {
        state[file_name].validateStatus = validate_status;
      }
    },
    setPdTransitionMatrixInputFilesValidationResult(
      state,
      action: PayloadAction<{ file_name: string; validate_result: any }>
    ) {
      let { file_name, validate_result } = action.payload;
      file_name = file_name?.trim().toUpperCase();
      if (file_name) {
        state[file_name].validationResult = validate_result;
      }
    },    
    setPdTransitionMatrixInputFilesHelperData: (
      _state,
      action: PayloadAction<inputFiles>
    ) => {
      return action.payload;
    },
    resetPdTransitionMatrixInputFilesHelperData: () => {
      return initialState;
    },
  },
});

export const {
  setPdTransitionMatrixInputFilesName,
  setPdTransitionMatrixInputFilesData,
  setPdTransitionMatrixInputFilesValidateStatus,
  setPdTransitionMatrixInputFilesValidationResult,
  setPdTransitionMatrixInputFilesHelperData,
  resetPdTransitionMatrixInputFilesHelperData,
} = PdTransitionMatrixInputFilesSlice.actions;
export default PdTransitionMatrixInputFilesSlice.reducer;
