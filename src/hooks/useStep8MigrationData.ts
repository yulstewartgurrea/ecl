import useSWR from "swr";
import { getStep8MigrationData } from "../services/documents";

export const useStep8MigrationData = (
  workflowPath: string | null,
  token: string | null
) => {
  const fetcher = (path: string, token: string) =>
    getStep8MigrationData(path, token);

  const { data, error, isLoading } = useSWR(
    workflowPath && token ? ["step8MigrationData", workflowPath, token] : null,
    ([, path, token]) => fetcher(path, token),
    { revalidateOnFocus: false }
  );

  return {
    data: data ?? {
      migrationMatrixData: [],
      migrationMatrixPercentage: [],
      migrationMatrixAverage: [],
    },
    error,
    isLoading,
  };
};
