import useSWR from "swr";
import {
  getMigrationMatrixAverage,
  getMigrationMatrix12Months,
} from "../services/documents";

type Step9Data = {
  migrationMatrixAverage: any[];
  matrixByMonth: Record<string, any[]>;
};

export const useStep9MigrationMatrix = (
  workflowPath: string | null,
  token: string | null
) => {
  const fetcher = async (path: string, token: string): Promise<Step9Data> => {
    const migrationAverage = await getMigrationMatrixAverage(path, token);
    const get12MonthResponse = await getMigrationMatrix12Months(
      path,
      migrationAverage,
      token
    );

    const groupedByMonth = get12MonthResponse.reduce(
      (acc: Record<string, any[]>, row: any) => {
        const month = row.Month;
        if (!acc[month]) acc[month] = [];
        acc[month].push(row);
        return acc;
      },
      {}
    );

    return {
      migrationMatrixAverage: migrationAverage,
      matrixByMonth: groupedByMonth,
    };
  };

  const { data, error, isLoading } = useSWR(
    workflowPath && token
      ? ["step9MigrationMatrix", workflowPath, token]
      : null,
    ([, path, token]) => fetcher(path, token),
    { revalidateOnFocus: false }
  );

  return {
    data: data ?? { migrationMatrixAverage: [], matrixByMonth: {} },
    error,
    isLoading,
  };
};
