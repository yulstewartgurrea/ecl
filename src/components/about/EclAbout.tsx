// components/about/EclAbout.tsx
// "About this table" panels for the ECL workflow steps.
import { useMemo } from "react";
import AboutTablePanel, { CalcExample, ColumnDefinitions, DefinitionTable, InfoCard } from "./AboutTablePanel";

type PortfolioRow = { agingCategory: string; loanBalance: number; weightedEcl: number };

// Same currency format as the portfolio ECL table
const fmtPhp = (n: number) =>
  n.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });

const SHOWN_ONLY = "Shown in the ECL output; not used in the calculation.";

// Required columns of the Client Loan Balances upload (see server/helpers/file_validations/ecl.py)
const LOAN_COLUMN_DEFINITIONS = [
  { column: "date", meaning: "The reporting (as-of) date of the listing.", format: "Date, MM/DD/YYYY", usedFor: SHOWN_ONLY },
  { column: "client_ref_no", meaning: "The borrower's ID. One borrower can have several loans.", format: "Text", usedFor: SHOWN_ONLY },
  { column: "loan_ref_no", meaning: "The loan account's ID, one per loan.", format: "Text", usedFor: SHOWN_ONLY },
  { column: "ServiceCode", meaning: "Code of the loan product or service type.", format: "Number", usedFor: SHOWN_ONLY },
  { column: "principal_loan_balance", meaning: "The principal portion still owed on the loan.", format: "Number", usedFor: SHOWN_ONLY },
  {
    column: "loan_balance",
    meaning: "The outstanding balance of the loan.",
    format: "Number",
    usedFor: "Calculation: ECL = loan_balance × the loan's loss rate. Also summed per bucket.",
  },
  { column: "past_due_amount", meaning: "The part of the loan that is overdue.", format: "Number", usedFor: SHOWN_ONLY },
  {
    column: "TotalSavings",
    meaning: "The borrower's total savings with the institution (the same on each of the borrower's loans).",
    format: "Number",
    usedFor: SHOWN_ONLY,
  },
  { column: "no_payment", meaning: "Number of missed payments.", format: "Whole number", usedFor: SHOWN_ONLY },
  { column: "delinquent_days", meaning: "How many days the loan is past due.", format: "Whole number", usedFor: SHOWN_ONLY },
  {
    column: "Aging Category",
    meaning: "The loan's delinquency bucket, for example PAR 30.",
    format: "Text matching a bucket in the Credit Loss Rate step",
    usedFor: "Calculation: picks the loan's loss rate, and groups loans into buckets for the summary.",
  },
];

const isMetaRow = (r: PortfolioRow) => r.agingCategory === "TOTAL" || r.agingCategory === "ECL RATE";

/* ---------------- Stepper 1 – Inputs ---------------- */

export function EclInputsAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Upload the loan-level balance listing (client loan balances) for the reporting date. Each
          loan's aging category and loan balance drive every ECL figure that follows.
        </>
      }
      usedNext={
        <>
          <b>ECL Calculations</b> applies a loss rate to each loan in this file, and the total loan
          balance at the top of the file sets the current (0 DAY) bucket in the portfolio summary.
        </>
      }
    >
      <InfoCard title="Required columns" wide>
        <DefinitionTable
          headers={["Column", "What it means", "Format", "Used for"]}
          rows={LOAN_COLUMN_DEFINITIONS.map((c) => [c.column, c.meaning, c.format, c.usedFor])}
        />
      </InfoCard>
      <InfoCard title="File layout">
        <ul className="list-disc space-y-1 pl-5">
          <li>Row 1: a label containing "Total loan" and the total loan balance of the portfolio.</li>
          <li>Row 2: blank. Row 3: column headers. Row 4 onward: one row per loan.</li>
          <li>Dates in MM/DD/YYYY format.</li>
        </ul>
      </InfoCard>
      <InfoCard title="Good to know">
        <ul className="list-disc space-y-1 pl-5">
          <li>Column names are matched without regard to upper or lower case.</li>
          <li>A column that is more than 10% empty fails the upload check.</li>
          <li>
            A loan whose Aging Category has no matching rate in the Credit Loss Rate step is given
            a 100% loss rate.
          </li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Stepper 2 – Credit Loss Rate ---------------- */

export function EclCreditLossRateAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          For each aging bucket, shows the historical credit loss rate and the forward-looking
          credit loss rates. Forward-looking means the historical rate is adjusted for where the
          economy is expected to go over the next 12 months, under three scenarios: upside,
          baseline and downside.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher loss rate",
          text: "A larger share of that bucket's balance is expected to be lost, so a bigger ECL provision.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Lower loss rate",
          text: "A smaller share of that bucket's balance is expected to be lost.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: "Forward-looking above historical",
          text: "The economic outlook is worse than today, so more losses are expected than in the past.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Forward-looking below historical",
          text: "The economic outlook is better than today, so fewer losses are expected than in the past.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Rises with the bucket",
          text: "Rates should increase with days past due. The last bucket is always 100%.",
        },
      ]}
      usedNext={
        <>
          <b>ECL Calculations</b> applies these rates to each loan by its aging category. The
          probability weights entered here are used there to blend the three scenarios.
        </>
      }
    >
      <InfoCard title="What forward-looking means">
        <p>
          The <b>historical</b> rate shows how much of each bucket was lost in the past. The{" "}
          <b>forward-looking</b> rates adjust it for the expected economy, because past losses
          alone can understate (or overstate) what will happen next. IFRS 9 (PFRS 9) requires ECL
          to reflect past experience, current conditions and reasonable forecasts of the future.
        </p>
        <p className="mt-2 text-xs text-gray-500">Illustration (made-up numbers), historical rate 20%:</p>
        <DefinitionTable
          headers={["Scenario", "Overlay multiplier", "Forward-looking rate"]}
          rows={[
            ["Upside", "0.90", "20% × 0.90 = 18%"],
            ["Baseline", "1.10", "20% × 1.10 = 22%"],
            ["Downside", "1.40", "20% × 1.40 = 28%"],
          ]}
        />
      </InfoCard>
      <InfoCard title="The three scenarios">
        <ColumnDefinitions
          items={[
            { name: "Upside", text: "The economy turns out better than expected. Usually the lowest rates." },
            { name: "Baseline", text: "The expected, most likely path of the economy." },
            { name: "Downside", text: "The economy turns out worse than expected. Usually the highest rates." },
          ]}
        />
        <p className="mt-2">
          Normally Downside ≥ Baseline ≥ Upside. Rates capped at 100% are the same in every
          scenario. If the three are also the same below 100%, the scenario values in Overlay
          Execution's MEV Config were left at their defaults. The probability weights you enter
          here (for example 30/50/20) blend the three into one ECL in the next step.
        </p>
      </InfoCard>
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Aging Category", text: "Delinquency bucket from the Flowrate aging report." },
            {
              name: "Historical Credit Loss Rate",
              text: "The Average row of the Flowrate Credit Loss Rate Approach (Step 3) for that bucket.",
            },
            {
              name: "Upside / Baseline / Downside",
              text: "Forward-looking credit loss rate for each economic scenario.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Forward-looking rate = Historical rate × Overlay multiplier (capped at 100%)
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            The overlay multiplier for each scenario comes from Overlay Execution (Overlay
            Multiplier step). Above 1 raises the rate, below 1 lowers it, exactly 1 leaves it
            unchanged.
          </li>
          <li>The last bucket is set to 100% in every scenario.</li>
          <li>The probability weights don't change this table.</li>
          <li>
            To trace a rate: Baseline = Historical Credit Loss Rate × the Base overlay multiplier
            shown in Overlay Execution.
          </li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Stepper 3 – ECL Calculations ---------------- */

export function EclCalculationsAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Each loan's balance is multiplied by the forward-looking loss rate for its aging bucket
          under each scenario, and the three results are blended using the scenario probability
          weights.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher Weighted ECL",
          text: "A larger expected loss, and so a larger provision, for that loan.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "ECL equal to the balance",
          text: "The loan's rate is 100%, as in the last bucket.",
        },
      ]}
      usedNext={
        <>
          <b>Credit Loss Rate Approach</b> (the next step) adds these up by aging bucket.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "date … Aging Category", text: "Copied from the uploaded loan file." },
            {
              name: "Credit Loss Rates (Upside / Baseline / Downside)",
              text: "The forward-looking rate for the loan's aging category, from the Credit Loss Rate step.",
            },
            {
              name: "Expected Credit Loss (Upside / Baseline / Downside)",
              text: "loan_balance × that scenario's rate.",
            },
            {
              name: "Weighted ECL",
              text: "The three scenario ECLs blended with the probability weights.",
            },
            {
              name: "TOTAL LOAN BALANCE",
              text: "The Total loan figure from the top of the uploaded file, not the sum of the loans listed.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            ECL (scenario) = loan_balance × scenario rate
          </code>
        </p>
        <p className="mt-1">
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Weighted ECL = ECL Upside × w₁ + ECL Baseline × w₂ + ECL Downside × w₃
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>w₁, w₂, w₃ are the probability weights ÷ 100.</li>
          <li>Uses loan_balance, not principal_loan_balance.</li>
          <li>A loan whose aging category has no rate in the Credit Loss Rate step gets 100%.</li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Stepper 4 – Credit Loss Rate Approach (portfolio summary) ---------------- */

export function EclPortfolioSummaryAbout({
  rows,
  eclRatePercent,
}: {
  rows: PortfolioRow[];
  eclRatePercent: number;
}) {
  // Worked example: ECL Rate = TOTAL Weighted ECL ÷ TOTAL Loan Balance × 100
  const example = useMemo(() => {
    const usable = rows.filter((r) => !isMetaRow(r));
    if (!usable.length) return null;
    const total = rows.find((r) => r.agingCategory === "TOTAL");
    const loan = total ? total.loanBalance : usable.reduce((s, r) => s + r.loanBalance, 0);
    const weighted = total ? total.weightedEcl : usable.reduce((s, r) => s + r.weightedEcl, 0);
    if (!loan) return null;
    const result = `${((weighted / loan) * 100).toFixed(2)}%`;
    const shown = `${eclRatePercent.toFixed(2)}%`;
    return {
      heading: "ECL Rate",
      steps: ["TOTAL Weighted ECL ÷ TOTAL Loan Balance × 100", `${fmtPhp(weighted)} ÷ ${fmtPhp(loan)} × 100`],
      result,
      tableValue: shown === result ? result : shown,
    };
  }, [rows, eclRatePercent]);

  return (
    <AboutTablePanel
      description={
        <>
          The loan-level ECL rolled up by aging bucket, with each bucket's share of the portfolio
          and the overall ECL rate. The current (0 DAY) bucket is the part of the total loan
          balance that isn't in the past-due listing.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher ECL Rate",
          text: "A larger allowance relative to the size of the portfolio.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: "More balance in later buckets",
          text: "Weaker credit quality: those buckets carry higher loss rates.",
        },
      ]}
      usedNext={
        <>
          <b>Output</b> charts the loan balance and ECL rate of each bucket.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Aging Category", text: "Delinquency bucket. 0 DAY is the current (not past due) balance." },
            { name: "Count", text: "Number of loans in the bucket from the uploaded listing." },
            { name: "Loan Balance", text: "Sum of loan_balance in the bucket." },
            { name: "Distribution", text: "Bucket loan balance ÷ total loan balance × 100." },
            {
              name: "Expected Credit Loss (Upside / Baseline / Downside)",
              text: "Sum of the loans' ECL for that scenario.",
            },
            { name: "Weighted ECL", text: "Scenario ECLs blended with the probability weights." },
            { name: "ECL Rate", text: "TOTAL Weighted ECL ÷ TOTAL Loan Balance × 100." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <ul className="list-disc space-y-1 pl-5">
          <li>Count, Loan Balance and the ECL columns are sums of the loans in ECL Calculations.</li>
          <li>
            0 DAY: Loan Balance = the file's Total loan − the past-due balances; its ECL uses the
            first bucket's rate from the Credit Loss Rate step.
          </li>
          <li>Weighted ECL = Σ scenario ECL × probability weight ÷ 100.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Stepper 5 – Output ---------------- */

export function EclOutputAbout({ rows }: { rows: PortfolioRow[] }) {
  // Worked example: one bucket's ECL Rate, preferring a past-due bucket below 100%
  const example = useMemo(() => {
    const candidates = rows.filter((r) => !isMetaRow(r) && r.loanBalance > 0);
    const row =
      candidates.find((r) => r.agingCategory !== "0 DAY" && r.weightedEcl > 0 && r.weightedEcl < r.loanBalance) ??
      candidates.find((r) => r.agingCategory !== "0 DAY") ??
      candidates[0];
    if (!row) return null;
    return {
      heading: `ECL Rate for ${row.agingCategory}`,
      steps: ["Weighted ECL ÷ Loan Balance × 100", `${fmtPhp(row.weightedEcl)} ÷ ${fmtPhp(row.loanBalance)} × 100`],
      result: `${((row.weightedEcl / row.loanBalance) * 100).toFixed(2)}%`,
      tableValue: null,
      footnote: "Weighted ECL and Loan Balance are the values for this bucket in the previous step's table.",
    };
  }, [rows]);

  return (
    <AboutTablePanel
      description={
        <>
          Compares how much loan balance sits in each aging bucket (bars) with the
          probability-weighted ECL rate applied to it (line).
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher line",
          text: "A larger share of that bucket's balance is expected to be lost.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Rising line",
          text: "Expected: the ECL rate should rise with days past due.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Very tall bars",
          text: "The axis may be capped so smaller buckets stay visible, so the 0 DAY bar can be cut off.",
        },
      ]}
      usedNext={<>This is the final view of the ECL module. Use Export in the earlier steps for the detailed files.</>}
    >
      <InfoCard title="Chart guide">
        <ColumnDefinitions
          items={[
            { name: "Bars – Loan Balance", text: "Loan balance of each aging bucket, in millions of pesos (left axis)." },
            { name: "Line – ECL Rate", text: "Weighted ECL ÷ Loan Balance × 100 for each bucket (right axis)." },
            { name: "Horizontal axis", text: "Aging category." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            ECL Rate (bucket) = Weighted ECL ÷ Loan Balance × 100
          </code>
        </p>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}
