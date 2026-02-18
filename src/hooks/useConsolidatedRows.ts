import useSWR from "swr";
import { getConsolidatedRows } from "../services/documents";
import { useAppSelector } from "../redux_toolkit/hooks";

export const useConsolidatedRows = (
  workflowPath: string | null,
  token: string | null
) => {
  const fetcher = (path: string, token: string) =>
    getConsolidatedRows(path, token);
  const forStep3 = useAppSelector(
    (state) => state.workflow.modules.transitionMatrix.data.forStep3 === true
  );
  const { data, error, isLoading } = useSWR(
    workflowPath && token ? ["consolidatedRows", workflowPath, token] : null,
    ([, path, token]) => fetcher(path, token),
    {
      revalidateOnFocus: forStep3 ? true : false,
      revalidateIfStale: forStep3 ? true : false,
      refreshInterval: 0,
    }
  );

  return {
    data: data ?? [],
    error,
    isLoading,
  };
};
