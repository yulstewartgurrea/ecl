import { combineReducers } from '@reduxjs/toolkit';

//slices
import auth from './features/general/auth';
import navUIState from './features/general/navUIState';
import pdTransitionMatrixWfHelper from './features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper';

export const rootReducer = combineReducers({
  auth,
  navUIState,
  pdTransitionMatrixWfHelper
})
