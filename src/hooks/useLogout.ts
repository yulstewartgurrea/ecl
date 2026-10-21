import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../redux_toolkit/hooks";
import { resetStateAuth } from "../redux_toolkit/features/general/auth";
import { resetStateNavUIState } from "../redux_toolkit/features/general/navUIState";
import { resetPdTransitionMatrixWfHelperData } from "../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

export const useLogout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return () => {
    dispatch(resetStateAuth());
    dispatch(resetPdTransitionMatrixWfHelperData());
    dispatch(resetStateNavUIState());
    navigate("/");
    // Clear persisted auth and in-memory uploader caches to avoid stale sessions
    localStorage.removeItem("persist:root");
    const { __MCU_CACHE__ } = window as { __MCU_CACHE__?: { clear?: () => void } };
    __MCU_CACHE__?.clear?.();
  };
};
