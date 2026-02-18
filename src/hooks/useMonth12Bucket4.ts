import { useMemo } from "react";
import { useAppSelector } from "../redux_toolkit/hooks";

type DpdRow = {
  "Aging bucket": string;
  "TTC PD": number;
};

export const useMonth12Bucket4 = (): DpdRow[] => {
  const month12Bucket4 = useAppSelector(
    (state) => state.workflow.modules.transitionMatrix.data.month12Bucket4 ?? []
  );

  const ttcData = useMemo(() => {
    const dpd4Arr = Array.isArray(month12Bucket4) ? month12Bucket4 : [];
    if (!dpd4Arr.length) return [];
    const labels = [
      "0 DPD",
      "1 - 30 DPD",
      "31 - 60 DPD",
      "61 - 90 DPD",
      "91+ DPD",
    ];

    return dpd4Arr.map((val, idx) => ({
      "Aging bucket": labels[idx],
      "TTC PD": val,
    }));
  }, [month12Bucket4]);

  return ttcData;
};
