import { createSlice, nanoid } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type EclReportingPeriod = {
  id: string;
  name: string;         // e.g. "Monthly", "Quarterly"
  code?: string | null; // optional short code (e.g., "M", "Q")
  description?: string | null;
};

type State = {
  items: EclReportingPeriod[];
};

/**
 * DEFAULTS:
 * - Monthly (this is the primary default)
 * - Quarterly
 * - Semi-Annually
 * - Annually
 */
const defaultItems: EclReportingPeriod[] = [
  {
    id: "monthly",
    name: "Monthly",
    code: "M",
    description: "Report every month (default)",
  }
];

const initialState: State = {
  items: defaultItems,
};

const slice = createSlice({
  name: "eclReportingPeriods",
  initialState,
  reducers: {
    addReportingPeriod: {
      prepare: (payload: {
        name: string;
        code?: string;
        description?: string;
      }) => ({
        payload: {
          id: nanoid(),
          name: payload.name,
          code: payload.code ?? null,
          description: payload.description ?? null,
        } as EclReportingPeriod,
      }),
      reducer: (state, action: PayloadAction<EclReportingPeriod>) => {
        state.items.push(action.payload);
      },
    },
    updateReportingPeriod: (
      state,
      action: PayloadAction<{
        id: string;
        patch: Partial<Omit<EclReportingPeriod, "id">>;
      }>
    ) => {
      const i = state.items.findIndex((x) => x.id === action.payload.id);
      if (i >= 0) {
        state.items[i] = { ...state.items[i], ...action.payload.patch };
      }
    },
    deleteReportingPeriod: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((x) => x.id !== action.payload);
    },
    resetReportingPeriods: (state) => {
      state.items = defaultItems;
    },
  },
});

export const {
  addReportingPeriod,
  updateReportingPeriod,
  deleteReportingPeriod,
  resetReportingPeriods,
} = slice.actions;

export default slice.reducer;
