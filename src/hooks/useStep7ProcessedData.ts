import useSWR from "swr";
import { getStep7ProcessedData } from "../services/documents";
import { useAppDispatch } from "../redux_toolkit/hooks";
import { updateModuleData } from "../redux_toolkit/features/workflow/workflowSlice";

export const useStep7ProcessedData = (
  workflowPath: string | null,
  token: string | null
) => {
  const dispatch = useAppDispatch();
  const fetcher = async (path: string, token: string) => {
    const data = await getStep7ProcessedData(path, token);
    if (!Array.isArray(data)) {
      dispatch(
        updateModuleData({
          moduleId: "transitionMatrix",
          data: { odrByPoint: [] },
        })
      );
      return [];
    }
    // Store full API response so Step11 gets breakdowns (industry, branch, income, age)
    dispatch(
      updateModuleData({
        moduleId: "transitionMatrix",
        data: { odrByPoint: data },
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
