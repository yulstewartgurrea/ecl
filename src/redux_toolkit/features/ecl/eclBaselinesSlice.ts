import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type EclBaseline = {
  id: string;
  label: string;   // e.g., "Corporate Default Baseline", or "2025-Q3"
  value: number;   // percentage (2.5 = 2.5%)
};

type State = { items: EclBaseline[] };
const initialState: State = { items: [] };

const rid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const eclBaselinesSlice = createSlice({
  name: "eclBaselines",
  initialState,
  reducers: {
    addBaseline: (state, action: PayloadAction<{ label: string; value: number }>) => {
      state.items.push({ id: rid(), ...action.payload });
    },
    updateBaseline: (state, action: PayloadAction<EclBaseline>) => {
      const i = state.items.findIndex(x => x.id === action.payload.id);
      if (i >= 0) state.items[i] = action.payload;
    },
    deleteBaseline: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(x => x.id !== action.payload);
    },
    resetStateEclBaselines: () => initialState,
  },
});

export const { addBaseline, updateBaseline, deleteBaseline, resetStateEclBaselines } =
  eclBaselinesSlice.actions;
export default eclBaselinesSlice.reducer;
