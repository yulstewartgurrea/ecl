import useSWR from "swr";
import { getStep7ProcessedData } from "../services/documents";
import { useAppDispatch, useAppSelector } from "../redux_toolkit/hooks";
import { updateModuleData } from "../redux_toolkit/features/workflow/workflowSlice";

export const useStep7ProcessedData = (
  workflowPath: string | null,
  token: string | null
) => {
  const dispatch = useAppDispatch();
  const existingCache = useAppSelector(
    (state) => state.workflow.modules.transitionMatrix.data.odrByPoint ?? []
  );
  const fetcher = async (path: string, token: string) => {
    const data = await getStep7ProcessedData(path, token);
    const existing = Array.isArray(existingCache) ? [...existingCache] : [];
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
    dispatch(
      updateModuleData({
        moduleId: "transitionMatrix",
        data: { odrByPoint: existing },
      })
    );

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
