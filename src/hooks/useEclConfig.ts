import useSWR from "swr";
import { useAppSelector } from "../redux_toolkit/hooks";
import { listEntities, listLoanProducts } from "../services/eclConfig";

// SWR shares these caches app-wide, so a change saved on the Configuration page
// shows up in the Workflows and Flowrate dropdowns too.

export const useEntities = () => {
  const token = useAppSelector((state) => state.auth.token);
  const { data, error, isLoading, mutate } = useSWR(
    token ? ["eclEntities", token] : null,
    () => listEntities(token!)
  );
  return { entities: data ?? [], error, isLoading, reload: mutate };
};

export const useLoanProducts = () => {
  const token = useAppSelector((state) => state.auth.token);
  const { data, error, isLoading, mutate } = useSWR(
    token ? ["eclLoanProducts", token] : null,
    () => listLoanProducts(token!)
  );
  return { loanProducts: data ?? [], error, isLoading, reload: mutate };
};
