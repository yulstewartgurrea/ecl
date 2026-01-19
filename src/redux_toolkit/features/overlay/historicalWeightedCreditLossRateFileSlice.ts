import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface HistoricalWeightedCreditLossRateFileState {
  historical_weighted_credit_loss_rate_file: boolean;
}

const initialState: HistoricalWeightedCreditLossRateFileState = {
  historical_weighted_credit_loss_rate_file: false,
};

const historicalWeightedCreditLossRateFileSlice = createSlice({
  name: "historicalWeightedCreditLossRateFile",
  initialState,
  reducers: {
    setHistoricalWeightedCreditLossRateFile: (
      state,
      action: PayloadAction<boolean>
    ) => {
      state.historical_weighted_credit_loss_rate_file = action.payload;
    },
    resetHistoricalWeightedCreditLossRateFile: () => initialState,
  },
});

export const { setHistoricalWeightedCreditLossRateFile, resetHistoricalWeightedCreditLossRateFile } =
  historicalWeightedCreditLossRateFileSlice.actions;
export default historicalWeightedCreditLossRateFileSlice.reducer;
