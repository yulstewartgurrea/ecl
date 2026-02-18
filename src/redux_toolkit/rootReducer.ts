import { combineReducers } from "@reduxjs/toolkit";

//slices
import auth from "./features/general/auth";
import navUIState from "./features/general/navUIState";
import pdTransitionMatrixWfHelper from "./features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
import pdMatrixWfHelper from "./features/probability_of_default/transition_matrix/pdMatrixWfHelper";
import eclEntitiesReducer from "./features/ecl/eclConfigSlice";
import eclBaselinesReducer from "./features/ecl/eclBaselinesSlice";
import eclDpdBucketsSlice from "./features/ecl/eclDpdBucketsSlice";
import eclLoanProductsReducer from "./features/ecl/eclLoanProductsSlice";
import eclReportingPeriodsReducer from "./features/ecl/eclReportingPeriodsSlice";
import executionInputFileReducer from "./features/overlay/executionInputFileSlice";
import finalModelExecutionFileReducer from "./features/overlay/finalModelExecutionFileSlice";
import historicalWeightedCreditLossRateFileReducer from "./features/overlay/historicalWeightedCreditLossRateFileSlice";
import flowrateStep5Reducer from "./features/asa/flowrateStep5Slice";
import moduleProgressReducer from "./features/progress/moduleProgressSlice";
import workflow from "./features/workflow/workflowSlice";
export const rootReducer = combineReducers({
  auth,
  navUIState,
  pdTransitionMatrixWfHelper,
  pdMatrixWfHelper,
  eclEntitiesReducer,
  eclBaselinesReducer,
  eclDpdBucketsSlice,
  eclLoanProductsReducer,
  eclReportingPeriodsReducer,
  workflow,
  executionInputFile: executionInputFileReducer,
  finalModelExecutionFile: finalModelExecutionFileReducer,
  historicalWeightedCreditLossRateFile:
    historicalWeightedCreditLossRateFileReducer,
  flowrateStep3: flowrateStep5Reducer,
  moduleProgress: moduleProgressReducer,
});
