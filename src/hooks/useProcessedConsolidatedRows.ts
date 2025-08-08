import useSWR from "swr";
import { getProcessedConsolidatedRows } from "../services/documents";

// Define the allowed process types explicitly
type ProcessType = "bucket-dpd" | "pivot-dpd";

export const useProcessedConsolidatedRows = (
  workflowPath: string | null,
  token: string | null,
  processType: ProcessType = "bucket-dpd"
) => {
  const fetcher = (path: string, token: string) =>
    getProcessedConsolidatedRows(path, token, processType);

  const { data, error, isLoading } = useSWR(
    workflowPath && token ? ["bucketRows", workflowPath, token] : null,
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
