// redux_toolkit/features/ecl/eclDpdBucketsSlice.ts
import { createSlice, nanoid } from "@reduxjs/toolkit";
import type { PayloadAction } from '@reduxjs/toolkit';
/** One DPD bucket (Days Past Due).  max=null means open-ended (e.g., 91+). */
export type DpdBucket = {
  id: string;
  bucket: number;
  min: number;
  max: number | null;
};

type State = { items: DpdBucket[] };

const DEFAULTS: DpdBucket[] = [
  { id: "b0", bucket: 0, min: 0,  max: 0   },
  { id: "b1", bucket: 1, min: 1,  max: 30  },
  { id: "b2", bucket: 2, min: 31, max: 60  },
  { id: "b3", bucket: 3, min: 61, max: 90  },
  { id: "b4", bucket: 4, min: 91, max: null },
];

const initialState: State = {
  items: DEFAULTS,
};

const slice = createSlice({
  name: "eclDpdBuckets",
  initialState,
  reducers: {
    addBucket: {
      prepare: (bucket: Omit<DpdBucket, "id">) => ({
        payload: { ...bucket, id: nanoid() } as DpdBucket,
      }),
      reducer: (state, action: PayloadAction<DpdBucket>) => {
        state.items.push(action.payload);
      },
    },
    updateBucket: (
      state,
      action: PayloadAction<{ id: string; patch: Partial<Omit<DpdBucket, "id">> }>
    ) => {
      const idx = state.items.findIndex((x) => x.id === action.payload.id);
      if (idx >= 0) state.items[idx] = { ...state.items[idx], ...action.payload.patch };
    },
    deleteBucket: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((x) => x.id !== action.payload);
    },
    setBuckets: (state, action: PayloadAction<DpdBucket[]>) => {
      state.items = action.payload;
    },
    resetDefault: (state) => {
      state.items = DEFAULTS.map((d) => ({ ...d, id: nanoid() }));
    },
  },
});

export const { addBucket, updateBucket, deleteBucket, setBuckets, resetDefault } = slice.actions;
export default slice.reducer;
