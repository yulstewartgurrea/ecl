import useSWR from "swr";
import { getValidRows } from "../services/documents";

export const useValidRows = (workflowPath: string | null) => {
  const fetcher = (path: string) => getValidRows(path);

  const { data, error, isLoading } = useSWR(
    workflowPath ? ["validRows", workflowPath] : null,
    () => fetcher(workflowPath!),
    {
      refreshInterval: 0,
    }
  );

  return {
    data: data ?? [],
    isLoading,
    error,
  };
};
