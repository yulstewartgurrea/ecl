// components/about/TransitionMatrixAbout.tsx
// "About this table" panels for the PD Transition Matrix workflow steps.
import { useMemo } from "react";
import AboutTablePanel, { CalcExample, ColumnDefinitions, InfoCard } from "./AboutTablePanel";
import { fmtNum } from "../asa/table/aging.types";
import { formatValueGeneral } from "../../utils/CommonHelper";

type Row = Record<string, unknown>;

const REQUIRED_FIELDS =
  "report date, loan segment, cis number, pn number, loan amount, outstanding balance, amortization, booking date, maturity date, eir, monthly payments, dpd";

const BUCKET_RULE = "0 days → 0 · 1–30 → 1 · 31–60 → 2 · 61–90 → 3 · more than 90 → 4 · no value → NA";

const bucketLegend = [
  {
    direction: "higher" as const,
    tone: "bad" as const,
    label: "Higher bucket",
    text: "Further behind on payments. Bucket 4 (more than 90 days past due) counts as default.",
  },
  {
    direction: "lower" as const,
    tone: "good" as const,
    label: "Bucket 0",
    text: "The loan was current (not past due) that month.",
  },
  {
    direction: "note" as const,
    tone: "neutral" as const,
    label: "NA",
    text: "The loan wasn't in that month's report.",
  },
];

/* ---------------- Step 1 – Input Files ---------------- */

export function TmInputFilesAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Upload one transactional report per month for this workflow. These loan-level reports are
          the starting point for every later step, from data validation to the default rates.
        </>
      }
      usedNext={
        <>
          <b>Step 2 (Data Validation)</b> reads every uploaded file and checks each row.
        </>
      }
    >
      <InfoCard title="File requirements">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            One Excel file per month, named <b>Transactional Report &lt;Month&gt; &lt;YYYY&gt;.xlsx</b>.
          </li>
          <li>At least 3 consecutive years, with all 12 months for each year.</li>
        </ul>
      </InfoCard>
      <InfoCard title="Columns each file should have">
        <p>{REQUIRED_FIELDS}.</p>
        <p className="mt-2">
          Optional: economic activity, branch, monthly income range and age. When present, they
          are used for the breakdowns in Step 11.
        </p>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 2 – Data Validation ---------------- */

export function TmValidationAbout({ rows }: { rows: Row[] }) {
  // Worked example: a row flagged for a payment mismatch, or else one with missing fields
  const example = useMemo(() => {
    const label = (r: Row) => `${r.pn_number ?? "row"} on ${r.report_date ?? "?"}`;
    const mismatch = rows.find(
      (r) => Array.isArray(r.errors) && (r.errors as unknown[]).includes("payment_mismatch_dpd_0")
    );
    if (mismatch) {
      const result = "Error (they don't match)";
      return {
        heading: `Status of ${label(mismatch)}`,
        steps: [
          "DPD is 0, so monthly payments should equal amortization",
          `monthly payments ${fmtNum(mismatch.monthly_payments)} vs amortization ${fmtNum(mismatch.amortization)}`,
        ],
        result,
        tableValue: mismatch.status === "error" ? result : String(mismatch.status ?? ""),
      };
    }
    const missing = rows.find(
      (r) => Array.isArray(r.missing_fields) && (r.missing_fields as unknown[]).length > 0
    );
    if (missing) {
      const result = "Missing";
      return {
        heading: `Status of ${label(missing)}`,
        steps: [`empty required field(s): ${(missing.missing_fields as unknown[]).join(", ")}`],
        result,
        tableValue: missing.status === "missing" ? result : String(missing.status ?? ""),
      };
    }
    return null;
  }, [rows]);

  return (
    <AboutTablePanel
      description={
        <>
          Shows every row of each uploaded month with a quality status. Valid rows passed every
          check, Error rows have an unreadable date or number or a payment mismatch, and Missing
          rows are missing a required field.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "good",
          label: "Higher % Valid",
          text: "Cleaner data, with fewer rows to review.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: "Higher % Error or Missing",
          text: "More rows to fix or delete before continuing.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Rows are not removed",
          text: "Every row, whatever its status, goes into Data Consolidation. Edit or delete rows here to change that.",
        },
      ]}
      usedNext={
        <>
          <b>Step 3 (Data Consolidation)</b> combines the latest saved version of every file, with
          all of its rows.
        </>
      }
    >
      <InfoCard title="Status definitions">
        <ColumnDefinitions
          items={[
            { name: "Valid", text: "Passed every check below." },
            {
              name: "Missing",
              text: `At least one required field is empty (or "NA", "null", "none"). Required: ${REQUIRED_FIELDS}.`,
            },
            {
              name: "Error",
              text: "Report, booking or maturity date can't be read; dpd, amortization or monthly payments isn't a number; or DPD is 0 but monthly payments ≠ amortization.",
            },
            {
              name: "Duplicate",
              text: "Rows with the same report date, CIS number and PN number in one file are flagged as duplicates in the row's errors.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How the status is decided">
        <p>
          Missing is checked first. Rows with no missing fields are then checked for errors, and
          rows that pass are Valid. The percentages are each status's share of the rows shown.
        </p>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 3 – Data Consolidation ---------------- */

export function TmConsolidationAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          All months' loan rows combined into one table, using the latest saved version of each
          file and only the fields needed for the next steps. Rows are not filtered by their
          validation status.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher dpd",
          text: "The loan is further behind on payments.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "All rows included",
          text: "Error and Missing rows from Step 2 are here too, unless they were fixed or deleted.",
        },
      ]}
      usedNext={
        <>
          <b>Steps 4 to 8</b> all start from this table.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "report date", text: "Month of the report the row came from." },
            { name: "loan segment", text: "Loan product or segment." },
            { name: "cis number", text: "Borrower (customer) number." },
            { name: "pn number", text: "Loan account (promissory note) number." },
            { name: "loan amount", text: "Original amount of the loan." },
            { name: "outstanding balance", text: "Amount still owed at the report date." },
            { name: "amortization", text: "Scheduled payment amount." },
            { name: "booking date", text: "Date the loan was released." },
            { name: "dpd", text: "Days past due at the report date." },
            {
              name: "economic activity, branch, monthly income range, age",
              text: "Optional. Kept when present and used for the breakdowns in Step 11.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How the table is built">
        <p>
          Values are copied unchanged from Step 2. Maturity date, EIR and monthly payments are left
          out because the later steps don't use them.
        </p>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 4 – Pivoting ---------------- */

export function TmPivotingAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          One row per loan (PN number and loan segment), with its days past due for each report
          date side by side, so each loan's history can be read across the months.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher days past due",
          text: "The loan is further behind on payments that month.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "NA",
          text: "The loan wasn't in that month's report.",
        },
      ]}
      usedNext={
        <>
          <b>Step 5 (Bucketing)</b> groups these days past due into delinquency buckets.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "pn number", text: "Loan account number." },
            { name: "loan segment", text: "Loan product or segment." },
            {
              name: "<date>-dpd columns",
              text: "One column per report date: the loan's days past due in that month's report.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How the table is built">
        <ul className="list-disc space-y-1 pl-5">
          <li>Each loan's rows from Data Consolidation are lined up by report date.</li>
          <li>If a loan appears more than once in a month, the first value is used.</li>
          <li>Rows with an unreadable report date, or no PN number or loan segment, are left out.</li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 5 – Bucketing ---------------- */

export function TmBucketingAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          The pivoted table with each month's days past due turned into a delinquency bucket, from
          0 (current) to 4 (more than 90 days past due).
        </>
      }
      legend={bucketLegend}
      usedNext={
        <>
          <b>Step 6 (Everbad)</b> uses the same buckets and adds the ever-bad rule.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "pn number", text: "Loan account number." },
            { name: "loan segment", text: "Loan product or segment." },
            {
              name: "<date>-dpd columns",
              text: "One column per report date: the loan's bucket that month. The column names end in -dpd, but the values are buckets.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each bucket is assigned">
        <p>Days past due → bucket:</p>
        <p className="mt-1 font-mono text-xs">{BUCKET_RULE}</p>
        <p className="mt-2">Example: a loan 45 days past due is in bucket 2.</p>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 6 – Everbad ---------------- */

export function TmEverbadAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Like Bucketing, but once a loan is more than 90 days past due it stays in bucket 4 for
          every later month, even if it catches up. This is the "ever bad" rule.
        </>
      }
      legend={[
        ...bucketLegend.slice(0, 2),
        {
          direction: "note",
          tone: "neutral",
          label: "Bucket 4 is permanent",
          text: "After a loan first reaches bucket 4, every later month shows 4. Months with no data stay NA.",
        },
      ]}
      usedNext={
        <>
          <b>Step 7 (Default Rate)</b> and <b>Step 8 (Matrix Construction)</b> are built from this
          table. The economic activity, branch, income range and age columns are used for the
          breakdowns in Step 11.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "pn number", text: "Loan account number." },
            { name: "loan segment", text: "Loan product or segment." },
            {
              name: "<date>-dpd columns",
              text: "One column per report date: the loan's bucket that month after applying the ever-bad rule.",
            },
            {
              name: "economic activity, branch, monthly income range, age",
              text: "Optional. The loan's value from the uploaded reports, used for breakdowns in Step 11.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each bucket is assigned">
        <p>Days past due → bucket, as in Step 5:</p>
        <p className="mt-1 font-mono text-xs">{BUCKET_RULE}</p>
        <p className="mt-2">
          Then, going month by month: once a loan is more than 90 days past due, every later month
          with data is set to bucket 4. Months with no data stay NA.
        </p>
        <p className="mt-2">
          Example: a loan in buckets 1, 4, 2 over three months shows 1, 4, 4 here.
        </p>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- shared helpers for steps 7–11 ---------------- */

const DPD_COLS = ["0 DPD_0", "1-30 DPD_1", "31-60 DPD_2", "61-90 DPD_3", "91+ DPD_4"];
const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(/[,%]/g, "")));
// Same display as the matrix tables: round to 4 dp like the backend, then truncate to 2 dp
const fmtMatrixPct = (f: number) => formatValueGeneral(Math.round(f * 1e4) / 1e4, "percentage", 2);
const bucketKeyOf = (r: Row) => Object.keys(r).find((k) => k.endsWith("_Bucket"));

const transitionLegend = [
  {
    direction: "note" as const,
    tone: "neutral" as const,
    label: "Diagonal",
    text: "Loans that stayed in the same bucket.",
  },
  {
    direction: "note" as const,
    tone: "bad" as const,
    label: "Right of the diagonal",
    text: "Loans that rolled into a worse bucket. The 91+ DPD column is movement into default.",
  },
  {
    direction: "note" as const,
    tone: "good" as const,
    label: "Left of the diagonal",
    text: "Loans that cured: they moved to a better bucket.",
  },
];

/* ---------------- Step 7 – Default Rate ---------------- */

export function TmDefaultRateAbout({ rows }: { rows: Row[] }) {
  const example = useMemo(() => {
    const row = rows.find((r) => num(r["Number of Good"]) > 0);
    if (!row) return null;
    const good = num(row["Number of Good"]);
    const bad = num(row["Number of Good that turned Bad"]);
    const result = `${((bad / good) * 100).toFixed(2)}%`;
    const shown = String(row["ODR"] ?? "");
    return {
      heading: `Observed Default Rate for ${row["Observation point"]}`,
      steps: ["Number of Good that turned Bad ÷ Number of Good × 100", `${fmtNum(bad)} ÷ ${fmtNum(good)} × 100`],
      result,
      tableValue: shown === result ? result : shown || null,
    };
  }, [rows]);

  return (
    <AboutTablePanel
      description={
        <>
          For each observation month, takes the loans that were performing (0–90 days past due)
          and shows what share of them were in default (more than 90 days past due) 12 months
          later.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher default rate",
          text: "More of the performing loans defaulted within the year.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Lower default rate",
          text: "Fewer performing loans defaulted.",
        },
      ]}
      usedNext={
        <>
          <b>Step 11 (Historical Default Rate)</b> charts these rates over time, for the whole
          portfolio or by segment.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Observation point", text: "The month the loans are observed as Good." },
            { name: "Start of performance window", text: "One month after the observation point." },
            { name: "End of performance window", text: "12 months after the observation point." },
            { name: "Number of Good", text: "Loans in buckets 0–3 (up to 90 days past due) at the observation point." },
            {
              name: "Number of Good that turned Bad",
              text: "Good loans that are in bucket 4 (more than 90 days past due) at the end of the window.",
            },
            { name: "Observed Default Rate", text: "Number of Good that turned Bad ÷ Number of Good × 100." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Observed Default Rate = Good that turned Bad ÷ Good × 100
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Buckets come from Step 6, so a loan that reached bucket 4 stays bad.</li>
          <li>
            If a loan has no data for a month in the window, it is treated as having no data from
            then on, so it is not counted as Bad at the end of the window.
          </li>
          <li>At least 13 months of data are needed for one 12-month window.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 8 – Matrix Construction ---------------- */

export function TmMatrixConstructionAbout({
  countBlocks,
  percentBlocks,
}: {
  countBlocks: Row[][];
  percentBlocks: Row[][];
}) {
  // Worked example: first month pair, bucket 0 → 0 DPD (loans that stayed current)
  const example = useMemo(() => {
    const counts = countBlocks?.[0];
    const percents = percentBlocks?.[0];
    if (!counts?.length || !percents?.length) return null;
    const row = counts.find((r) => {
      const k = bucketKeyOf(r);
      return k !== undefined && num(r[k]) === 0;
    });
    const pRow = percents.find((r) => {
      const k = bucketKeyOf(r);
      return k !== undefined && num(r[k]) === 0;
    });
    if (!row || !pRow) return null;
    const total = num(row["Total Accounted Evaluated"]);
    const stayed = num(row["0 DPD_0"]);
    if (!total) return null;
    const toKey = bucketKeyOf(row) ?? "";
    const fromKey = Object.keys(row).find(
      (k) => k !== toKey && !DPD_COLS.includes(k) && k !== "Indeterminate_NA" && k !== "Total Accounted Evaluated"
    );
    const result = fmtMatrixPct(stayed / total);
    const shown = formatValueGeneral(num(pRow["0 DPD_0"]), "percentage", 2);
    return {
      heading: `Bucket 0 → 0 DPD, ${fromKey ?? "first month"} to ${toKey.replace("_Bucket", "")}`,
      steps: ["loans that stayed in bucket 0 ÷ Total Accounted Evaluated", `${fmtNum(stayed)} ÷ ${fmtNum(total)}`],
      result,
      tableValue: shown === result ? result : shown,
    };
  }, [countBlocks, percentBlocks]);

  return (
    <AboutTablePanel
      description={
        <>
          For each pair of consecutive months, shows how loans in each delinquency bucket moved to
          each bucket one month later, first as counts and then as percentages. The Average
          Transition Matrix is the typical one-month movement across all months.
        </>
      }
      legend={transitionLegend}
      usedNext={
        <>
          <b>Step 9 (Markov Chain)</b> uses the Average Transition Matrix.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "First date column (counts)", text: "Number of loans in the bucket at the earlier month." },
            { name: "Bucket", text: "The bucket the loans started in." },
            {
              name: "0 DPD … 91+ DPD",
              text: "Loans (or share of loans) in each bucket one month later.",
            },
            { name: "Indeterminate NA", text: "Loans with no record in the later month." },
            {
              name: "Total Accounted Evaluated",
              text: "Loans that landed in buckets 0–4, excluding NA. This is the base for the percentages.",
            },
            {
              name: "Average Transition Matrix",
              text: "For each cell, the simple average of that cell's percentage across all month pairs.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Percentage = loans that moved to the bucket ÷ Total Accounted Evaluated
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The NA percentage uses the same base, so it is shown on top of the 100%.</li>
          <li>
            A month pair with no loans in a starting bucket counts as 0% in the average, so some
            Average rows can total less than 100%.
          </li>
          <li>Bucket 4 always stays in 91+ DPD because of the ever-bad rule in Step 6.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 9 – Markov Chain ---------------- */

export function TmMarkovChainAbout({
  average,
  month2,
  month12 = [],
  percentBlocks = [],
}: {
  average: Row[];
  month2: Row[];
  month12?: Row[];
  /** Step 8 month-pair percentage tables */
  percentBlocks?: Row[][];
}) {
  // Worked example: Average, bucket 0 → 0 DPD = simple average of that cell over all month pairs
  const averageExample = useMemo(() => {
    const target = average?.find((r) => num(r.Bucket) === 0);
    if (!target || !percentBlocks?.length) return null;
    const values = percentBlocks
      .map((block) => {
        const row = block?.find((r) => {
          const k = bucketKeyOf(r);
          return k !== undefined && num(r[k]) === 0;
        });
        return row ? num(row["0 DPD_0"]) : NaN;
      })
      .filter(Number.isFinite);
    if (!values.length) return null;
    const pct = (v: number) => formatValueGeneral(v, "percentage", 2);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const result = pct(sum / values.length);
    const shown = pct(num(target["0 DPD_0"]));
    const listed =
      values.length > 4
        ? `${values.slice(0, 3).map(pct).join(" + ")} + … + ${pct(values[values.length - 1])}`
        : values.map(pct).join(" + ");
    const zeros = values.filter((v) => v === 0).length;
    return {
      heading: "Average Transition Matrix · Bucket 0 → 0 DPD",
      steps: [
        `average of this cell in the ${values.length} month-pair percentage tables (Step 8)`,
        `(${listed}) ÷ ${values.length}`,
        `${pct(sum)} ÷ ${values.length}`,
      ],
      result,
      tableValue: shown === result ? result : shown,
      footnote: zeros
        ? `${zeros} of the ${values.length} month pairs had no loans in bucket 0 and count as 0%.`
        : "Every month pair counts equally, however many loans it had.",
    };
  }, [average, percentBlocks]);

  // "Reading your numbers": a few cells read out in words, formatted like the tables
  const readings = useMemo(() => {
    const cell = (rows: Row[], bucket: number, col: string) => {
      const r = rows?.find((x) => num(x.Bucket) === bucket);
      const v = r ? num(r[col]) : NaN;
      return Number.isFinite(v) ? formatValueGeneral(v, "percentage", 2) : null;
    };
    return {
      stayCurrent: cell(average, 0, "0 DPD_0"),
      lateToDefault: cell(average, 3, "91+ DPD_4"),
      currentDefault12: cell(month12, 0, "91+ DPD_4"),
    };
  }, [average, month12]);

  // Worked example: Month 2, bucket 0 → 0 DPD = Σ_k Avg[0][k] × Avg[k][0]
  const example = useMemo(() => {
    if (!average?.length || !month2?.length) return null;
    const sorted = [...average].sort((a, b) => num(a.Bucket) - num(b.Bucket));
    const from0 = sorted.find((r) => num(r.Bucket) === 0);
    const target = month2.find((r) => num(r.Bucket) === 0);
    if (!from0 || !target || sorted.length !== DPD_COLS.length) return null;
    const terms = sorted.map((rowK, k) => {
      const a = num(from0[DPD_COLS[k]]);
      const b = num(rowK["0 DPD_0"]);
      return { label: `via bucket ${num(rowK.Bucket)}`, a, b, product: a * b };
    });
    const sum = terms.reduce((s, t) => s + t.product, 0);
    const result = fmtMatrixPct(sum);
    const shown = formatValueGeneral(num(target["0 DPD_0"]), "percentage", 2);
    return {
      heading: "Month 2 · Bucket 0 → 0 DPD",
      steps: ["Σ over buckets k: (Average, bucket 0 → k) × (Average, bucket k → 0)"],
      // average values shown as in the Average Transition Matrix table; the result as in Month 2
      terms: terms.map((t) => ({
        label: t.label,
        parts: `${formatValueGeneral(t.a, "percentage", 2)} × ${formatValueGeneral(t.b, "percentage", 2)}`,
        value: formatValueGeneral(t.product, "percentage", 2),
      })),
      result,
      tableValue: shown === result ? result : shown,
      footnote: "Uses the unrounded average values, so the rounded numbers may not add up exactly.",
    };
  }, [average, month2]);

  return (
    <AboutTablePanel
      description={
        <>
          The Average Transition Matrix shows the chance a loan moves from one delinquency bucket
          to another in one month. Matrix Multiplication applies it month after month to show where
          loans in each bucket are likely to be 1 to 12 months from now.
        </>
      }
      legend={[
        {
          direction: "note",
          tone: "neutral",
          label: "Diagonal (same bucket)",
          text: "Higher: loans tend to stay where they are. Good for 0 DPD (staying current); for past-due buckets it means they stay behind.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: "Right of the diagonal",
          text: "Higher: more loans roll into a worse bucket.",
        },
        {
          direction: "higher",
          tone: "good",
          label: "Left of the diagonal",
          text: "Higher: more loans cure (catch up) and move to a better bucket.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: "91+ DPD column",
          text: "Higher: a bigger chance the loan is in default by that month.",
        },
        {
          direction: "higher",
          tone: "good",
          label: "0 DPD column",
          text: "Higher: a bigger chance the loan is current (not past due).",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Total below 100%",
          text: "Some loans aren't accounted for, because the average matrix rows from Step 8 total less than 100%.",
        },
      ]}
      usedNext={
        <>
          <b>Step 10 (TTC PD)</b> takes the 91+ DPD column of Month 12.
        </>
      }
    >
      <InfoCard title="Reading the two tables" wide>
        <ColumnDefinitions
          items={[
            {
              name: "Average Transition Matrix",
              text: "Each row is the bucket a loan is in today; each column is where it is one month later. A cell is the chance of that move in one month. For example, row 1–30 DPD, column 31–60 DPD is the chance a loan 1–30 days late is 31–60 days late next month.",
            },
            {
              name: "Matrix Multiplication (Month 1 … Month 12)",
              text: "The same layout, but that many months ahead. Over the months the diagonal shrinks and the 91+ DPD column grows, because loans that reach default stay there.",
            },
          ]}
        />
        {(readings.stayCurrent || readings.lateToDefault || readings.currentDefault12) && (
          <>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Reading your numbers
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {readings.stayCurrent && (
                <li>
                  A loan that is current today has a <b>{readings.stayCurrent}</b> chance of still
                  being current next month (Average Transition Matrix, bucket 0, 0 DPD).
                </li>
              )}
              {readings.lateToDefault && (
                <li>
                  A loan 61–90 days late has a <b>{readings.lateToDefault}</b> chance of being 91+
                  days late next month (bucket 3, 91+ DPD).
                </li>
              )}
              {readings.currentDefault12 && (
                <li>
                  A loan that is current today has a <b>{readings.currentDefault12}</b> chance of
                  being 91+ days late in 12 months (Month 12, bucket 0, 91+ DPD). This is its TTC PD
                  on the next page.
                </li>
              )}
            </ul>
          </>
        )}
      </InfoCard>
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Bucket", text: "The loan's bucket today." },
            {
              name: "0 DPD … 91+ DPD",
              text: "The estimated chance the loan is in each bucket after that many months.",
            },
            { name: "Total", text: "Sum of the row. Should be close to 100%." },
            { name: "Month 1 … Month 12", text: "How many months ahead. Month 1 is the Average Transition Matrix itself." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Month n = Average matrix multiplied by itself n times
          </code>
        </p>
        <p className="mt-2">
          Each month's matrix is the previous month's matrix × the average matrix. This assumes
          every future month behaves like the average historical month.
        </p>
        <p className="mt-2">
          The Average Transition Matrix itself is the simple average of each cell across all the
          month-pair percentage tables in Step 8.
        </p>
        {averageExample && <CalcExample {...averageExample} />}
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 10 – TTC PD ---------------- */

export function TmTtcPdAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          For each current delinquency bucket, the estimated probability that a loan will be in
          default (more than 90 days past due) within 12 months, based on the average monthly
          movements across the whole history.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher TTC PD",
          text: "Loans in that bucket are more likely to default within a year.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Rises with the bucket",
          text: "Later buckets should have higher PDs. The 91+ DPD bucket is already in default, so it is 100%.",
        },
      ]}
      usedNext={
        <>
          This is a final result of the Transition Matrix workflow. Step 11 continues with the
          default rates from Step 7.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Aging bucket", text: "The loan's current delinquency bucket." },
            {
              name: "TTC PD",
              text: "Through-the-cycle probability of default: the chance of being 91+ days past due within 12 months.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            TTC PD (bucket) = Month 12 matrix, that bucket's row, 91+ DPD column
          </code>
        </p>
        <p className="mt-2">
          It is "through the cycle" because the monthly matrix averages every month in the history,
          good and bad periods alike. To trace a value, open Step 9, go to Month 12, and read the
          bucket's row in the 91+ DPD column.
        </p>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 11 – Historical Default Rate ---------------- */

export function TmHistoricalDefaultRateAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          The 12-month observed default rate over time, for the whole portfolio or for chosen
          segments (industry, branch, income class, age), filtered by year and month.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher default rate",
          text: "More performing loans defaulted within the year.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Lower default rate",
          text: "Fewer performing loans defaulted.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Comparing segments",
          text: "Select categories in one group to compare a segment against the whole portfolio.",
        },
      ]}
      usedNext={
        <>
          The downloaded table has the Time and ODR columns that the{" "}
          <b>Overlay Development</b> Historical Default Rate input expects.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Time", text: "End of the 12-month performance window (from Step 7)." },
            {
              name: "Observed Default Rate",
              text: "The default rate for that window: the whole portfolio, or the selected segment.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <ul className="list-disc space-y-1 pl-5">
          <li>Whole portfolio: the Observed Default Rate from Step 7 for the same window.</li>
          <li>
            Segment: Good loans in the selected categories that turned Bad ÷ Good loans in those
            categories.
          </li>
          <li>The year and month filters apply to the end of the window.</li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}
