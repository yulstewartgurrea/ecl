// components/asa/table/DistributionInfoPanel.tsx
import { useMemo } from "react";
import type { AnyRow } from "./aging.types";
import { fmtDate, fmtNum, fmtPctFraction, toNum } from "./aging.types";
import AboutTablePanel, { CalcExample, ColumnDefinitions, InfoCard } from "./AboutTablePanel";
import {
  bucketKeys,
  bucketLabels,
  columnDefinitions,
  findCurrentKey,
  findDateKey,
  findTotalKey,
  rangeExamples,
  sortNewestFirst,
} from "./agingBuckets";

export default function DistributionInfoPanel({
  rows,
  principalRows = [],
}: {
  rows: AnyRow[];
  /** Principal Matrix rows, used for the worked example */
  principalRows?: AnyRow[];
}) {
  const labels = useMemo(() => bucketLabels(rows), [rows]);
  const columns = useMemo(
    () =>
      columnDefinitions(rows, {
        date: "The report date of the aging report.",
        current: () => "Share of the total balance that is not past due.",
        pastDue: ({ cols }) =>
          `Share of the total balance that is past due. Each column runs up to the next one: ${rangeExamples(cols)}.`,
        last: ({ last }) => `${last.range}, the oldest bucket.`,
        total: "Always 100%: the whole portfolio.",
      }),
    [rows]
  );

  // Worked example: the 0 day column on the latest date, from the Principal Matrix amounts
  const example = useMemo(() => {
    const dateKey = findDateKey(principalRows);
    const totalKey = findTotalKey(principalRows);
    const currentKey = findCurrentKey(principalRows);
    if (!dateKey || !totalKey || !currentKey) return null;

    const latest = sortNewestFirst(principalRows, dateKey)[0];
    const total = latest ? toNum(latest[totalKey]) : 0;
    if (!total) return null;
    const date = fmtDate(latest[dateKey]);
    const balance = toNum(latest[currentKey]);

    // What the table shows for the same cell (it divides by the sum of the buckets)
    const distDateKey = findDateKey(rows);
    const tableRow = distDateKey ? rows.find((r) => fmtDate(r[distDateKey]) === date) : undefined;
    const tableSum = tableRow ? bucketKeys(rows).reduce((sum, k) => sum + toNum(tableRow[k]), 0) : 0;

    return {
      heading: `${currentKey} on ${date}`,
      steps: [
        `${currentKey} balance ÷ Total loan balance with C/P`,
        `${fmtNum(balance)} ÷ ${fmtNum(total)}`,
      ],
      result: fmtPctFraction(balance / total),
      tableValue:
        tableRow && tableSum ? fmtPctFraction(toNum(tableRow[currentKey]) / tableSum) : null,
    };
  }, [rows, principalRows]);

  if (!rows?.length) return null;

  return (
    <AboutTablePanel
      description={
        <>
          Shows how the total loan balance is split across delinquency buckets on each report
          date. Each percentage is that bucket's share of the total, so every row adds up to 100%.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "good",
          label: `Higher ${labels.current}`,
          text: "A larger share of the portfolio is being paid on time.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: `Higher ${labels.pastDue}`,
          text: "A larger share of the portfolio is overdue. The later the bucket, the higher the risk of loss.",
        },
      ]}
      usedNext={
        <>
          In <b>Step 3 (Credit Loss Rate Approach)</b>, these percentages are the weights for each
          bucket's loss rate when calculating the <b>Weighted Credit Loss Rate</b>.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions items={columns} />
      </InfoCard>

      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Bucket % = Bucket balance ÷ Total loan balance with C/P
          </code>
        </p>
        <p className="mt-2">
          Based on <b>loan balance</b> (amount owed), not the number of accounts. The amounts are
          on the <b>Principal Matrix</b> tab.
        </p>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}
