import useSWR from "swr";
import { getValidRows } from "../services/documents";
import { useAppSelector } from "../redux_toolkit/hooks";

export const useValidRows = (workflowPath: string | null) => {
  const authToken = useAppSelector((state) => state.auth.token);
  const fetcher = (path: string) => getValidRows(path, authToken!);
  const forStep3 = useAppSelector(
    (state) => state.workflow.modules.transitionMatrix.data.forStep3 === true
  );
  const { data, error, isLoading } = useSWR(
    workflowPath && authToken ? ["validRows", workflowPath] : null,
    () => fetcher(workflowPath!),
    {
      refreshInterval: 0,
      revalidateOnFocus: forStep3 ? true : false,
      revalidateIfStale: forStep3 ? true : false,
    }
  );

  return {
    data: data ?? [],
    isLoading,
    error,
  };
};
