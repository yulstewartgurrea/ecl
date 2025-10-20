import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type EclEntity = {
  id: string;
  name: string;
  code?: string;
  description?: string;
};

type State = { items: EclEntity[] };
const initialState: State = { items: [] };

// simple id
const rid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const eclEntitiesSlice = createSlice({
  name: "eclEntities",
  initialState,
  reducers: {
    addEntity: (
      state,
      action: PayloadAction<{ name: string; code?: string; description?: string }>
    ) => {
      state.items.push({ id: rid(), ...action.payload });
    },
    updateEntity: (state, action: PayloadAction<EclEntity>) => {
      const i = state.items.findIndex((x) => x.id === action.payload.id);
      if (i >= 0) state.items[i] = action.payload; // replace with full row (name/code/description)
    },
    deleteEntity: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((x) => x.id !== action.payload);
    },
    resetStateEclEntities: () => initialState,
  },
});

export const { addEntity, updateEntity, deleteEntity, resetStateEclEntities } =
  eclEntitiesSlice.actions;
export default eclEntitiesSlice.reducer;
