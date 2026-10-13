// components/asa/table/PrincipalMatrixInfoPanel.tsx
import { useMemo } from "react";
import type { AnyRow } from "./aging.types";
import { fmtDate, toNum } from "./aging.types";
import AboutTablePanel, { ColumnDefinitions, InfoCard } from "./AboutTablePanel";
import {
  bucketKeys,
  bucketLabels,
  columnDefinitions,
  findDateKey,
  findTotalKey,
  fmtAmount,
  rangeExamples,
} from "./agingBuckets";

export default function PrincipalMatrixInfoPanel({ rows }: { rows: AnyRow[] }) {
  const labels = useMemo(() => bucketLabels(rows), [rows]);
  const columns = useMemo(
    () =>
      columnDefinitions(rows, {
        date: "The report date of the aging report.",
        current: () => "Balance that is not past due.",
        pastDue: ({ cols }) =>
          `Balance that is past due. Each column runs up to the next one: ${rangeExamples(cols)}.`,
        last: ({ last }) => `${last.range}, the oldest bucket.`,
        total: "The whole portfolio. The buckets add up to this.",
      }),
    [rows]
  );

  // Report dates where the bucket balances don't add up to the reported total
  const mismatches = useMemo(() => {
    const dateKey = findDateKey(rows);
    const totalKey = findTotalKey(rows);
    const keys = bucketKeys(rows);
    if (!dateKey || !totalKey || !keys.length) return [];

    return rows
      .map((r) => ({
        date: fmtDate(r[dateKey]),
        buckets: keys.reduce((sum, k) => sum + toNum(r[k]), 0),
        total: toNum(r[totalKey]),
      }))
      .filter((m) => Math.abs(m.buckets - m.total) >= 1);
  }, [rows]);

  if (!rows?.length) return null;

  const notice = mismatches.length ? (
    <>
      On {mismatches.length === 1 ? "1 report date" : `${mismatches.length} report dates`} the
      buckets don't add up to the Total loan balance with C/P (e.g. {mismatches[0].date}: buckets{" "}
      {fmtAmount(mismatches[0].buckets)} vs total {fmtAmount(mismatches[0].total)}). Check the
      aging report input file.
    </>
  ) : undefined;

  return (
    <AboutTablePanel
      notice={notice}
      description={
        <>
          Shows the outstanding loan balance (amount still owed) in each delinquency bucket on each
          report date, taken from the uploaded aging report. {labels.current} is the balance that
          is not past due, and the {labels.pastDue} columns are the balance that is past due.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "good",
          label: `Higher ${labels.current}`,
          text: "More of the balance is being paid on time.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: `Higher ${labels.pastDue}`,
          text: "More of the balance is overdue. The later the bucket, the higher the risk of loss.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Keep in mind",
          text: "Amounts also grow when the portfolio grows. Compare shares on the Distribution tab.",
        },
      ]}
      usedNext={
        <>
          The <b>Distribution</b> tab turns these amounts into percentages, and the{" "}
          <b>Flow Rate Calc</b> tab compares each bucket with the next bucket one month later.
          Both feed <b>Step 3 (Credit Loss Rate Approach)</b>.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions items={columns} />
      </InfoCard>

      <InfoCard title="What the numbers are">
        <p>
          Each value is the <b>outstanding principal balance</b> of the loans in that bucket, not
          the number of loans. Total loan balance with C/P is the whole portfolio. The values come
          straight from the uploaded aging report and are not calculated by the app.
        </p>
      </InfoCard>
    </AboutTablePanel>
  );
}
