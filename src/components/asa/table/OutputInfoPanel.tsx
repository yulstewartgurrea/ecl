// components/asa/table/OutputInfoPanel.tsx
import { useMemo } from "react";
import type { AnyRow } from "./aging.types";
import { deriveKeys, fmtDate, toFraction } from "./aging.types";
import AboutTablePanel, { ColumnDefinitions, InfoCard } from "./AboutTablePanel";
import { bucketLabels, findDateKey } from "./agingBuckets";

const isReportDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}/.test(fmtDate(v));

// Same 2-decimal format as the Step 3 table
const fmtTablePct = (f: number) =>
  `${(f * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** About panel for the Flowrate Approach Output step (charts of the Step 3 results). */
export default function OutputInfoPanel({ rows }: { rows: AnyRow[] }) {
  const labels = useMemo(() => bucketLabels(rows), [rows]);

  // Last point on the Weighted chart, so the user can match it against the Step 3 table
  const lastPoint = useMemo(() => {
    const dateKey = findDateKey(rows);
    const weightedKey = deriveKeys(rows).find((k) => /weighted/i.test(k));
    if (!dateKey || !weightedKey) return null;
    const latest = rows
      .filter((r) => isReportDate(r?.[dateKey]))
      .sort((a, b) => fmtDate(b[dateKey]).localeCompare(fmtDate(a[dateKey])))[0];
    if (!latest) return null;
    const f = toFraction(latest[weightedKey]);
    return typeof f === "number" ? { date: fmtDate(latest[dateKey]), value: fmtTablePct(f) } : null;
  }, [rows]);

  if (!rows?.length) return null;

  return (
    <AboutTablePanel
      description={
        <>
          Charts the Step 3 credit loss rates over time. The <b>Weighted</b> tab shows the Weighted
          Credit Loss Rate per Month for the whole portfolio, and the <b>Bucket trend</b> tab shows
          each bucket's loss rate per month so buckets can be compared.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Line going up",
          text: "Expected losses are rising: more of the balance is expected to be lost.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Line going down",
          text: "Expected losses are falling.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Starts at 0%",
          text: "The earliest month has no flow rates, so every line starts at 0% there.",
        },
      ]}
      usedNext={
        <>
          This is the last step of the Flowrate Approach. The <b>ECL</b> module's credit loss
          rates step uses the latest Step 3 run for this workflow: the Average row's{" "}
          {labels.current} to last-bucket loss rates become the historical credit loss rates.
        </>
      }
    >
      <InfoCard title="Chart guide">
        <ColumnDefinitions
          items={[
            {
              name: "Weighted tab",
              text: "One line: the Weighted Credit Loss Rate per Month from Step 3.",
            },
            {
              name: "Bucket trend tab",
              text: `One line per bucket's loss rate (${labels.current}, ${labels.pastDue} columns). "Bucket" picks the thick line and "Compare" adds more; the first three buckets are shown at the start.`,
            },
            { name: "Horizontal axis", text: "Report date." },
            { name: "Vertical axis", text: "Loss rate, in %." },
            { name: "Average row", text: "Not plotted. It is only shown in the Step 3 table." },
          ]}
        />
      </InfoCard>

      <InfoCard title="Where the numbers come from">
        <p>
          The charts plot the <b>Step 3</b> table values as they are; nothing is recalculated
          here. See the About section in Step 3 for how each loss rate is calculated.
        </p>
        {lastPoint && (
          <p className="mt-2">
            For example, the last point on the Weighted line is <b>{lastPoint.date}</b> at{" "}
            <b>{lastPoint.value}</b>, the same as Step 3's Weighted Credit Loss Rate per Month for
            that date.
          </p>
        )}
      </InfoCard>
    </AboutTablePanel>
  );
}
