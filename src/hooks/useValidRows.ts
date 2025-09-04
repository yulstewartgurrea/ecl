import useSWR from "swr";
import { getValidRows } from "../services/documents";

export const useValidRows = (workflowPath: string | null) => {
  const fetcher = (path: string) => getValidRows(path);
  const storageKey = "for_step_3";
  const forStep3 = localStorage.getItem(storageKey) === "true";
  const { data, error, isLoading } = useSWR(
    workflowPath ? ["validRows", workflowPath] : null,
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
