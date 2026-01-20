import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type ModuleKey =
  | "flowrate"
  | "overlayDevelopment"
  | "overlayExecution"
  | "ecl";

type ModuleProgressEntry = {
  step: number;
  data: Record<string, unknown>;
};

type ModuleProgressState = {
  modules: Record<string, Record<string, ModuleProgressEntry>>;
};

const DEFAULT_CONTEXT = "__default__";

const initialState: ModuleProgressState = {
  modules: {},
};

type SetModuleProgressPayload = {
  moduleKey: ModuleKey;
  contextKey?: string;
  step?: number;
  data?: Record<string, unknown>;
};

type ClearModuleProgressPayload = {
  moduleKey: ModuleKey;
  contextKey?: string;
};

const moduleProgressSlice = createSlice({
  name: "moduleProgress",
  initialState,
  reducers: {
    setModuleProgress: (
      state,
      action: PayloadAction<SetModuleProgressPayload>
    ) => {
      const { moduleKey, contextKey, step, data } = action.payload;
      const key = contextKey || DEFAULT_CONTEXT;
      const moduleMap = state.modules[moduleKey] ?? {};
      const current = moduleMap[key] ?? { step: 0, data: {} };

      moduleMap[key] = {
        step: step ?? current.step,
        data: data ? { ...current.data, ...data } : current.data,
      };

      state.modules[moduleKey] = moduleMap;
    },
    clearModuleProgress: (
      state,
      action: PayloadAction<ClearModuleProgressPayload>
    ) => {
      const { moduleKey, contextKey } = action.payload;
      if (!state.modules[moduleKey]) return;

      if (contextKey) {
        delete state.modules[moduleKey][contextKey];
        return;
      }

      state.modules[moduleKey] = {};
    },
  },
});

export const { setModuleProgress, clearModuleProgress } =
  moduleProgressSlice.actions;

export const selectModuleProgress = (
  state: { moduleProgress: ModuleProgressState },
  moduleKey: ModuleKey,
  contextKey?: string
) => {
  const key = contextKey || DEFAULT_CONTEXT;
  return state.moduleProgress.modules[moduleKey]?.[key];
};

export default moduleProgressSlice.reducer;
