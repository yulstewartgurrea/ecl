// components/asa/table/FlowRateInfoPanel.tsx
import { useMemo } from "react";
import type { AnyRow } from "./aging.types";
import { fmtDate, fmtNum, fmtPctFraction, toFraction, toNum } from "./aging.types";
import AboutTablePanel, { CalcExample, ColumnDefinitions, InfoCard } from "./AboutTablePanel";
import {
  agingColumns,
  bucketLabels,
  columnDefinitions,
  findCurrentKey,
  findDateKey,
  sortNewestFirst,
} from "./agingBuckets";

export default function FlowRateInfoPanel({
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
        date: "The month being compared with the month before.",
        current: ({ current, cols }) =>
          `Share of last month's ${current} balance that became past due this month (${current} → ${cols[0]?.key ?? "next bucket"}).`,
        pastDue: ({ cols }) =>
          `Share of last month's balance in that bucket that moved into the next bucket this month${
            cols.length > 1 ? ` (e.g. ${cols[0].key} → ${cols[1].key})` : ""
          }.`,
        last: () => "Always 100%: balance that reaches the last bucket is treated as fully lost.",
      }),
    [rows]
  );

  // Flow rates come back in the uploaded row order. The calculation compares each row with
  // the row below it as "last month", so it is only correct when the newest month is on top.
  const isNewestFirst = useMemo(() => {
    const dateKey = findDateKey(rows);
    if (!dateKey) return true;
    const dates = rows.filter((r) => r?.[dateKey]).map((r) => fmtDate(r[dateKey]));
    return dates.every((d, i) => i === 0 || dates[i - 1].localeCompare(d) >= 0);
  }, [rows]);

  // Worked example: the 0 day column on the latest date (0 day -> first past-due bucket),
  // from the Principal Matrix amounts. Skipped when the upload order is wrong, since the table
  // values would not match the correct months anyway.
  const example = useMemo(() => {
    if (!isNewestFirst) return null;
    const dateKey = findDateKey(principalRows);
    const currentKey = findCurrentKey(principalRows);
    const next = agingColumns(principalRows)[0];
    if (!dateKey || !currentKey || !next) return null;

    const [latest, prev] = sortNewestFirst(principalRows, dateKey);
    if (!latest || !prev) return null;
    const date = fmtDate(latest[dateKey]);
    const prevDate = fmtDate(prev[dateKey]);
    const moved = toNum(latest[next.key]);
    const lastMonth = toNum(prev[currentKey]);

    // Same rules as the backend: no balance last month -> 100%, otherwise capped at 100%
    const ratio = lastMonth ? moved / lastMonth : null;
    const result =
      ratio === null
        ? "100% (no balance last month)"
        : ratio > 1
          ? `${fmtPctFraction(ratio)} → capped at 100.00%`
          : fmtPctFraction(ratio);
    const shown = ratio === null || ratio > 1 ? 1 : ratio;

    const flowDateKey = findDateKey(rows);
    const tableRow = flowDateKey ? rows.find((r) => fmtDate(r[flowDateKey]) === date) : undefined;
    const tableFrac = tableRow ? toFraction(tableRow[currentKey]) : null;

    return {
      heading: `${currentKey} on ${date}`,
      steps: [
        `${next.key} balance on ${date} ÷ ${currentKey} balance on ${prevDate}`,
        `${fmtNum(moved)} ÷ ${fmtNum(lastMonth)}`,
      ],
      result,
      tableValue:
        typeof tableFrac === "number"
          ? fmtPctFraction(tableFrac) === fmtPctFraction(shown)
            ? result
            : fmtPctFraction(tableFrac)
          : null,
    };
  }, [rows, principalRows, isNewestFirst]);

  if (!rows?.length) return null;

  const notice = isNewestFirst ? undefined : (
    <>
      The uploaded file lists the oldest month first, but flow rates are calculated as if the
      newest month is on top, so these values compare the wrong months. Re-upload the aging report
      with the newest month in the first row, then click <b>Run</b>.
    </>
  );

  return (
    <AboutTablePanel
      notice={notice}
      description={
        <>
          Shows how much of the loan balance in each bucket moved into the next, later bucket one
          month later. For example, the {labels.current} column shows how much of last month's
          current balance became past due this month.
        </>
      }
      legend={[
        {
          direction: "lower",
          tone: "good",
          label: "Lower",
          text: "Less of the balance is falling further behind.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: "Higher",
          text: "More of the balance is moving into a later, riskier bucket.",
        },
      ]}
      usedNext={
        <>
          In <b>Step 3 (Credit Loss Rate Approach)</b>, each bucket's flow rate is multiplied by
          the flow rates of all later buckets to get that bucket's loss rate. Higher flow rates
          mean higher loss rates.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions items={columns} />
      </InfoCard>

      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Flow rate = Next bucket's balance this month ÷ This bucket's balance last month
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Values are capped at 100%. A bucket with no balance last month is also set to 100%.
          </li>
          <li>The earliest month shows 0% because there is no earlier month to compare with.</li>
          <li>
            The balances come from the <b>Principal Matrix</b> tab.
          </li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}
