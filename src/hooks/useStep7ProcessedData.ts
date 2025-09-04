import useSWR from "swr";
import { getStep7ProcessedData } from "../services/documents";

export const useStep7ProcessedData = (
  workflowPath: string | null,
  token: string | null
) => {
  const fetcher = async (path: string, token: string) => {
    const data = await getStep7ProcessedData(path, token);

    // Update localStorage as before
    const storageKey = "odr_by_point";
    const raw = localStorage.getItem(storageKey);
    const existing = raw ? JSON.parse(raw) : [];

    data.forEach(
      ({
        "End of performance window": obsPoint,
        ODR,
      }: {
        "End of performance window": string;
        ODR: string;
      }) => {
        const idx = existing.findIndex(
          (e: any) => e["End of performance window"] === obsPoint
        );
        if (idx >= 0) existing[idx].ODR = ODR;
        else existing.push({ "End of performance window": obsPoint, ODR });
      }
    );

    localStorage.setItem(storageKey, JSON.stringify(existing));

    return data;
  };

  const { data, error, isLoading } = useSWR(
    workflowPath && token ? ["step7Data", workflowPath, token] : null,
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
