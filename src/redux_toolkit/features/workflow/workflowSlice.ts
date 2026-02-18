import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ModuleId =
  | "flowrateApproach"
  | "overlayDevelopment"
  | "overlayExecution"
  | "transitionMatrix"
  | "ecl"
  | "chatbot";

export type ModuleWorkflowState = {
  currentStep: number;
  data: Record<string, any>;
  uploads: Record<string, any>;
  errors: Record<string, any>;
  statuses: Record<string, any>;
};

export type WorkflowState = {
  modules: Record<ModuleId, ModuleWorkflowState>;
};

const createModuleState = (): ModuleWorkflowState => ({
  currentStep: 0,
  data: {},
  uploads: {},
  errors: {},
  statuses: {},
});

const initialState: WorkflowState = {
  modules: {
    flowrateApproach: createModuleState(),
    overlayDevelopment: createModuleState(),
    overlayExecution: createModuleState(),
    transitionMatrix: createModuleState(),
    ecl: createModuleState(),
    chatbot: createModuleState(),
  },
};

const workflowSlice = createSlice({
  name: "workflow",
  initialState,
  reducers: {
    setModuleStep: (
      state,
      action: PayloadAction<{ moduleId: ModuleId; step: number }>
    ) => {
      const { moduleId, step } = action.payload;
      state.modules[moduleId].currentStep = step;
    },
    updateModuleData: (
      state,
      action: PayloadAction<{ moduleId: ModuleId; data: Record<string, any> }>
    ) => {
      const { moduleId, data } = action.payload;
      state.modules[moduleId].data = {
        ...state.modules[moduleId].data,
        ...data,
      };
    },
    updateModuleUploads: (
      state,
      action: PayloadAction<{ moduleId: ModuleId; uploads: Record<string, any> }>
    ) => {
      const { moduleId, uploads } = action.payload;
      state.modules[moduleId].uploads = {
        ...state.modules[moduleId].uploads,
        ...uploads,
      };
    },
    updateModuleErrors: (
      state,
      action: PayloadAction<{ moduleId: ModuleId; errors: Record<string, any> }>
    ) => {
      const { moduleId, errors } = action.payload;
      state.modules[moduleId].errors = {
        ...state.modules[moduleId].errors,
        ...errors,
      };
    },
    updateModuleStatuses: (
      state,
      action: PayloadAction<{ moduleId: ModuleId; statuses: Record<string, any> }>
    ) => {
      const { moduleId, statuses } = action.payload;
      state.modules[moduleId].statuses = {
        ...state.modules[moduleId].statuses,
        ...statuses,
      };
    },
    clearModuleErrors: (
      state,
      action: PayloadAction<{ moduleId: ModuleId }>
    ) => {
      const { moduleId } = action.payload;
      state.modules[moduleId].errors = {};
    },
    resetModuleWorkflow: (
      state,
      action: PayloadAction<{ moduleId: ModuleId }>
    ) => {
      const { moduleId } = action.payload;
      state.modules[moduleId] = createModuleState();
    },
  },
});

export const {
  setModuleStep,
  updateModuleData,
  updateModuleUploads,
  updateModuleErrors,
  updateModuleStatuses,
  clearModuleErrors,
  resetModuleWorkflow,
} = workflowSlice.actions;

export default workflowSlice.reducer;
