import useSWR from "swr";
import { getPivotedConsolidatedRows } from "../services/documents";

export const usePivotedConsolidatedRows = (
  workflowPath: string | null,
  token: string | null
) => {
  const fetcher = (path: string, token: string) =>
    getPivotedConsolidatedRows(path, token);

  const { data, error, isLoading } = useSWR(
    workflowPath && token ? ["pivotedRows", workflowPath, token] : null,
    ([, path, token]) => fetcher(path, token),
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
    }
  );

  return {
    data: data ?? [],
    error,
    isLoading,
  };
};
