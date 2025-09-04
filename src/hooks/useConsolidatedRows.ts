import useSWR from "swr";
import { getConsolidatedRows } from "../services/documents";

export const useConsolidatedRows = (
  workflowPath: string | null,
  token: string | null
) => {
  const fetcher = (path: string, token: string) =>
    getConsolidatedRows(path, token);
  const storageKey = "for_step_3";
  const forStep3 = localStorage.getItem(storageKey) === "true";
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
