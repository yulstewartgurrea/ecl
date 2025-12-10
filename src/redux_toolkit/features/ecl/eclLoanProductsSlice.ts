import { createSlice, nanoid } from "@reduxjs/toolkit";
import type { PayloadAction } from '@reduxjs/toolkit';

export type EclLoanProduct = {
  id: string;
  name: string;         // e.g. "Auto", "Corporate"
  code?: string | null; // optional short code
  description?: string | null;
};

type State = {
  items: EclLoanProduct[];
};

const initialState: State = {
  items: [

  ],
};

const slice = createSlice({
  name: "eclLoanProducts",
  initialState,
  reducers: {
    addLoanProduct: {
      prepare: (payload: { name: string; code?: string; description?: string }) => ({
        payload: {
          id: nanoid(),
          name: payload.name,
          code: payload.code ?? null,
          description: payload.description ?? null,
        } as EclLoanProduct,
      }),
      reducer: (state, action: PayloadAction<EclLoanProduct>) => {
        state.items.push(action.payload);
      },
    },
    updateLoanProduct: (
      state,
      action: PayloadAction<{ id: string; patch: Partial<Omit<EclLoanProduct, "id">> }>
    ) => {
      const i = state.items.findIndex((x) => x.id === action.payload.id);
      if (i >= 0) state.items[i] = { ...state.items[i], ...action.payload.patch };
    },
    deleteLoanProduct: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((x) => x.id !== action.payload);
    },
    resetLoanProducts: (state) => {
      state.items = initialState.items;
    },
  },
});

export const {
  addLoanProduct,
  updateLoanProduct,
  deleteLoanProduct,
  resetLoanProducts,
} = slice.actions;

export default slice.reducer;
