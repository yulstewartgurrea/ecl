// hooks/useProcessedRowsStep6.ts
import useSWR from "swr";
import { getProcessedConsolidatedRowsStep6 } from "../services/documents";

export const useProcessedRowsStep6 = (
  workflowPath: string | null,
  token: string | null,
  processType: "bucket-dpd-everbad" = "bucket-dpd-everbad"
) => {
  const fetcher = (path: string, token: string) =>
    getProcessedConsolidatedRowsStep6(path, token, processType);

  const { data, error, isLoading } = useSWR(
    workflowPath && token ? ["step6Rows", workflowPath, token] : null,
    ([, path, token]) => fetcher(path, token),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    data: data ?? [],
    error,
    isLoading,
  };
};
