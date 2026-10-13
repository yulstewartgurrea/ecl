// components/asa/table/CreditLossInfoPanel.tsx
import { useMemo } from "react";
import type { AnyRow } from "./aging.types";
import { deriveKeys, fmtDate, fmtPctFraction, toFraction, toNum } from "./aging.types";
import AboutTablePanel, { CalcExample, ColumnDefinitions, InfoCard } from "../../about/AboutTablePanel";
import {
  agingColumns,
  bucketLabels,
  columnDefinitions,
  findCurrentKey,
  findDateKey,
} from "./agingBuckets";

// The backend renamed "Monotonic?" to "Strictly Increasing?"; older outputs still have the old name
const findMonotonicKey = (rows: AnyRow[]) =>
  deriveKeys(rows).find((k) => /monotonic|strictly increasing/i.test(k));
const findWeightedKey = (rows: AnyRow[]) => deriveKeys(rows).find((k) => /weighted/i.test(k));

const isReportDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}/.test(fmtDate(v));

// Same 2-decimal format as the Credit Loss Rate table
const fmtTablePct = (f: number) =>
  `${(f * 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const asFraction = (v: unknown) => {
  const f = toFraction(v);
  return typeof f === "number" ? f : 0;
};

export default function CreditLossInfoPanel({
  rows,
  distributionRows = [],
}: {
  rows: AnyRow[];
  /** Step 2 Distribution rows (bucket ÷ total), used for the worked example */
  distributionRows?: AnyRow[];
}) {
  const labels = useMemo(() => bucketLabels(rows), [rows]);
  const monotonicKey = useMemo(() => findMonotonicKey(rows), [rows]);
  const weightedKey = useMemo(() => findWeightedKey(rows), [rows]);

  const columns = useMemo(() => {
    const defs = columnDefinitions(rows, {
      date: "The report date. The Average row averages every month except the earliest, which has no flow rates.",
      current: () => "Loss rate for balance that is not past due.",
      pastDue: () => "Loss rate for balance in that past-due bucket. Older buckets usually have higher loss rates.",
      last: () => "Always 100%: balance that reaches the last bucket is treated as lost.",
    });
    if (monotonicKey) {
      defs.push({
        name: monotonicKey,
        text: "Yes when each bucket's loss rate is higher than the one before it. No means at least one bucket is not higher, for example two buckets both at 100%.",
      });
    }
    if (weightedKey) {
      defs.push({
        name: weightedKey,
        text: "One loss rate for the whole portfolio that month: each bucket's loss rate × its share of the balance, added up.",
      });
    }
    return defs;
  }, [rows, monotonicKey, weightedKey]);

  // Worked example: the Weighted Credit Loss Rate on the latest date
  const example = useMemo(() => {
    const dateKey = findDateKey(rows);
    const distDateKey = findDateKey(distributionRows);
    const currentKey = findCurrentKey(rows);
    if (!dateKey || !distDateKey || !weightedKey) return null;

    const latest = rows
      .filter((r) => isReportDate(r?.[dateKey]))
      .sort((a, b) => fmtDate(b[dateKey]).localeCompare(fmtDate(a[dateKey])))[0];
    if (!latest) return null;
    const date = fmtDate(latest[dateKey]);
    const dist = distributionRows.find((r) => fmtDate(r[distDateKey]) === date);
    if (!dist) return null;

    const keys = [...(currentKey ? [currentKey] : []), ...agingColumns(rows).map((c) => c.key)];
    const terms = keys.map((k) => {
      const loss = asFraction(latest[k]);
      const share = toNum(dist[k]);
      return { label: k, loss, share, product: loss * share };
    });
    const sum = terms.reduce((s, t) => s + t.product, 0);
    const result = fmtTablePct(sum);
    const tableValue = fmtTablePct(asFraction(latest[weightedKey]));

    return {
      heading: `Weighted Credit Loss Rate on ${date}`,
      steps: ["Σ (loss rate × share of balance), for each bucket"],
      terms: terms.map((t) => ({
        label: t.label,
        parts: `${fmtTablePct(t.loss)} × ${fmtPctFraction(t.share)}`,
        value: fmtPctFraction(t.product),
      })),
      result,
      tableValue,
      footnote:
        "Shares are from the Distribution tab. Products use unrounded values, so the rounded numbers may not add up exactly.",
    };
  }, [rows, distributionRows, weightedKey]);

  if (!rows?.length) return null;

  return (
    <AboutTablePanel
      description={
        <>
          Shows the credit loss rate for each delinquency bucket on each report date: the share of
          that bucket's balance expected to end up in the last bucket and be lost. The Weighted
          Credit Loss Rate per Month combines them into one rate for the whole portfolio.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher loss rate",
          text: "A larger part of that bucket's balance is expected to be lost.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Lower loss rate",
          text: "Less of that bucket's balance is expected to be lost.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: "Higher weighted rate",
          text: "A larger expected loss for the whole portfolio that month.",
        },
      ]}
      usedNext={
        <>
          <b>Step 4 (Output)</b> charts these results. The <b>ECL</b> module's credit loss rates
          step uses the latest run of this step for the workflow: the Average row's{" "}
          {labels.current} to last-bucket loss rates become the historical credit loss rates.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions items={columns} />
      </InfoCard>

      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Loss rate (bucket) = Flow rate of this bucket × flow rates of every later bucket
          </code>
        </p>
        <p className="mt-1">
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Weighted Credit Loss Rate = Σ (Loss rate × bucket's share of balance)
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Flow rates come from the <b>Flow Rate Calc</b> tab and shares from the{" "}
            <b>Distribution</b> tab in Step 2.
          </li>
          <li>Flow rates of 0% are skipped when multiplying.</li>
          <li>The earliest month shows 0% because it has no flow rates.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}
