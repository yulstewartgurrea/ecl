// Redux-backed helpers for Step4/Step5
import { store } from "../../redux_toolkit/store";
import {
  selectModuleProgress,
  setModuleProgress,
} from "../../redux_toolkit/features/progress/moduleProgressSlice";
export type FilterLogic = "AND" | "OR";
export type FilterRule = {
  id: string;
  column: string;
  value: string;
  operator?: ">" | "<" | ">=" | "<=" | "==" | "!=";
};
export function loadFilterLogic(wfId: number | string): FilterLogic {
  const entry = selectModuleProgress(
    store.getState() as any,
    "overlayDevelopment",
    String(wfId)
  );
  const data = (entry?.data ?? {}) as Record<string, unknown>;
  return (data.step5FilterLogic as FilterLogic) ?? "AND";
}
export type Step3Config = {
  numOfVars: number;
};
export function saveFilterLogic(wfId: number | string, logic: FilterLogic) {
  store.dispatch(
    setModuleProgress({
      moduleKey: "overlayDevelopment",
      contextKey: String(wfId),
      data: { step5FilterLogic: logic },
    })
  );
}
export function saveHeaders(wfId: number | string, headers: string[]) {
  store.dispatch(
    setModuleProgress({
      moduleKey: "overlayDevelopment",
      contextKey: String(wfId),
      data: { step4Headers: headers },
    })
  );
}

export function loadHeaders(wfId: number | string): string[] {
  const entry = selectModuleProgress(
    store.getState() as any,
    "overlayDevelopment",
    String(wfId)
  );
  const data = (entry?.data ?? {}) as Record<string, unknown>;
  return (data.step4Headers as string[]) ?? [];
}

export function saveFilters(wfId: number | string, rules: FilterRule[]) {
  store.dispatch(
    setModuleProgress({
      moduleKey: "overlayDevelopment",
      contextKey: String(wfId),
      data: { step5Filters: rules },
    })
  );
}

export function loadFilters(wfId: number | string): FilterRule[] {
  const entry = selectModuleProgress(
    store.getState() as any,
    "overlayDevelopment",
    String(wfId)
  );
  const data = (entry?.data ?? {}) as Record<string, unknown>;
  return (data.step5Filters as FilterRule[]) ?? [];
}

export function saveStep3Config(wfId: number | string, config: Step3Config) {
  store.dispatch(
    setModuleProgress({
      moduleKey: "overlayDevelopment",
      contextKey: String(wfId),
      data: { step3Config: config },
    })
  );
}

export function loadStep3Config(wfId: number | string): Step3Config | null {
  const entry = selectModuleProgress(
    store.getState() as any,
    "overlayDevelopment",
    String(wfId)
  );
  const data = (entry?.data ?? {}) as Record<string, unknown>;
  return (data.step3Config as Step3Config) ?? null;
}