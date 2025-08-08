import useSWR from "swr";
import { getConsolidatedRows } from "../services/documents";

export const useConsolidatedRows = (
  workflowPath: string | null,
  token: string | null
) => {
  const fetcher = (path: string, token: string) =>
    getConsolidatedRows(path, token);

  const { data, error, isLoading } = useSWR(
    workflowPath && token ? ["consolidatedRows", workflowPath, token] : null,
    ([, path, token]) => fetcher(path, token),
    {
      revalidateOnFocus: true,
      refreshInterval: 0,
    }
  );

  return {
    data: data ?? [],
    error,
    isLoading,
  };
};
