import { useState, useEffect } from "react";
import { getMonth12Bucket4 } from "../services/documents";

type DpdRow = {
  "Aging bucket": string;
  "TTC PD": number;
};

export const useMonth12Bucket4 = (): DpdRow[] => {
  const [ttcData, setTtcData] = useState<DpdRow[]>([]);

  useEffect(() => {
    const dpd4Arr = getMonth12Bucket4();
    if (!dpd4Arr) return;

    const labels = [
      "0 DPD",
      "1 - 30 DPD",
      "31 - 60 DPD",
      "61 - 90 DPD",
      "91+ DPD",
    ];

    const transformed: DpdRow[] = dpd4Arr.map((val, idx) => ({
      "Aging bucket": labels[idx],
      "TTC PD": val,
    }));

    setTtcData(transformed);
  }, []);

  return ttcData;
};
