// components/about/OverlayDevelopmentAbout.tsx
// "About this table" panels for the Overlay Development workflow steps.
import { useMemo } from "react";
import AboutTablePanel, { CalcExample, ColumnDefinitions, InfoCard, type LegendItem } from "./AboutTablePanel";

import { interpolationExample, logitExample, num, type Row } from "./overlayExamples";

// Interpolation table: truncated to 4 decimals
const fmtTrunc4 = (n: number) =>
  (Math.trunc(n * 1e4) / 1e4).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
// Transformation table: up to 4 decimals
const fmt4 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

const modelQualityLegend: LegendItem[] = [
  { direction: "lower", tone: "good", label: "Lower p-value", text: "The variable's effect is more statistically significant (below 0.05 is the usual cut-off)." },
  { direction: "higher", tone: "good", label: "Higher Adj. R²", text: "The model explains more of the default rate's movement." },
  { direction: "lower", tone: "good", label: "Lower RMSE, MAPE, AIC, BIC", text: "Smaller errors and a better balance between fit and simplicity." },
  { direction: "higher", tone: "bad", label: "Higher VIF", text: "The variables overlap. Above about 5–10 the coefficients become unreliable." },
  { direction: "note", tone: "neutral", label: "ST / BT / BP p-values", text: "Above 0.05 means no problem was found in that residual check." },
];

/* ---------------- Step 1 – Inputs ---------------- */

export function OdInputsAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Upload the historical economic data (monthly and quarterly) and the historical default
          rate that the overlay model will be built from.
        </>
      }
      usedNext={
        <>
          <b>Interpolation</b> turns the quarterly data into monthly values, and{" "}
          <b>Data Transformation</b> joins everything together.
        </>
      }
    >
      <InfoCard title="Required columns">
        <ColumnDefinitions
          items={[
            {
              name: "Monthly MEV",
              text: "year, month (int), month, id (YYYY-Mon), then one column per economic variable.",
            },
            {
              name: "Quarterly MEV",
              text: "year, quarter, month, id, x, then one column per economic variable.",
            },
            { name: "Historical Default Rate", text: "time and odr (the observed default rate)." },
          ]}
        />
      </InfoCard>
      <InfoCard title="Units">
        <p>
          In both MEV files, the second row gives each variable's unit: "rates" for values from 0
          to 100, or "count" for whole numbers.
        </p>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 2 – Interpolation ---------------- */

export function OdInterpolationAbout({ rows }: { rows: Row[] }) {
  // Worked example: the first month after a quarter-end, between two quarter-end values
  const example = useMemo(() => interpolationExample(rows, fmtTrunc4), [rows]);

  return (
    <AboutTablePanel
      description={
        <>
          Converts quarterly economic figures into monthly figures so they line up with the monthly
          default rates.
        </>
      }
      usedNext={
        <>
          <b>Data Transformation</b> joins these monthly values with the monthly economic data.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "year, quarter, month, id", text: "The month of the row (id is YYYY-Mon)." },
            { name: "period id", text: "The same month as YYYY-M." },
            { name: "index", text: "A time counter (0, 0.1, 0.2, …). It is not used as a model variable." },
            { name: "Other columns", text: "The quarterly economic variables, now one value per month." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <ul className="list-disc space-y-1 pl-5">
          <li>Each quarter's value is placed on the quarter's last month (Mar, Jun, Sep, Dec).</li>
          <li>
            The months in between are filled along a straight line: the first month adds ⅓ of the
            change to the next quarter, the second month adds ⅔.
          </li>
          <li>After the last quarter, the last value is repeated. Months before a variable's first value are blank.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 3 – Data Transformation ---------------- */

export function OdTransformationAbout({ defaultRows }: { defaultRows: Row[] }) {
  // Worked example: logit of the default rate
  const example = useMemo(() => logitExample(defaultRows, fmt4), [defaultRows]);

  return (
    <AboutTablePanel
      description={
        <>
          Creates alternative versions of each economic variable (a log version, the change versus
          12 months earlier, and versions delayed by 3 to 12 months) and converts the default rate
          to a log-odds (logit) scale, so a straight-line regression can be fitted.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher logit",
          text: "A higher default rate. The logit keeps the same order on a different scale.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Number of combinations",
          text: "How many variables go into each model tested in the next step (1 to 4).",
        },
      ]}
      usedNext={
        <>
          <b>Multi Factor Analysis</b> fits a regression for every combination of these variables.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "<variable>.ln", text: "Natural log of the variable (only when it is always above 0)." },
            { name: "<variable>.diff_12", text: "Value minus the value 12 months earlier." },
            { name: "<variable>.lag_3 / 6 / 9 / 12", text: "The value 3, 6, 9 or 12 months earlier." },
            { name: "Combined names", text: "Show the order applied, e.g. unemp_rate.ln.lag_3." },
            { name: "<rate>.logit", text: "The default rate on the log-odds scale." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            logit = ln(rate ÷ (1 − rate))
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>A rate of 0 is treated as 0.001 and a rate of 1 as 0.99999, so the logit exists.</li>
          <li>Percentages like "4.5%" are read as 0.045, and "(x)" as −x.</li>
          <li>The Export also includes stationarity (ADF) tests and a correlation matrix.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 4 – Multi Factor Analysis ---------------- */

const mfaColumns = [
  { name: "Y", text: "The target: the default rate's logit." },
  { name: "X1 … Xk", text: "The variables in this model." },
  { name: "Intercept, Coeff Xi", text: "The fitted equation: logit = intercept + Σ coefficient × variable." },
  { name: "Stderr, T-Value", text: "Uncertainty of each coefficient; t = coefficient ÷ standard error." },
  { name: "P-Value", text: "Chance of an effect this large if the variable had no real effect." },
  { name: "Vif Xi", text: "Variance inflation factor: how much Xi overlaps with the other variables." },
  { name: "R Squared, Adj R Squared", text: "Share of the movement explained; Adj R² penalises extra variables." },
  { name: "Num Pts Fitted", text: "Number of months used in the fit." },
  { name: "MSE, RMSE", text: "Average squared error and its square root, on the logit scale." },
  { name: "MAPE", text: "Average error as a share of the actual default rate (0.076 = 7.6%)." },
  { name: "AIC, BIC", text: "Fit scores that penalise complexity. Compare between models; lower is better." },
  { name: "ST / BT / BP Pval", text: "Residual checks: normality (Shapiro–Wilk), autocorrelation (Ljung–Box), uneven variance (Breusch–Pagan)." },
];

export function OdMultiFactorAbout({ rows }: { rows: Row[] }) {
  // Worked example: Adj R² from R², number of months and number of variables
  const example = useMemo(() => {
    const row = rows?.find(
      (r) => Number.isFinite(num(r.R_Squared)) && Number.isFinite(num(r.Adj_R_Squared)) && num(r.num_pts_fitted) > 0
    );
    if (!row) return null;
    const r2 = num(row.R_Squared);
    const n = num(row.num_pts_fitted);
    const k = Object.keys(row).filter((key) => /^X\d+$/.test(key) && row[key] != null && row[key] !== "").length;
    if (!k || n - k - 1 <= 0) return null;
    const adj = 1 - ((1 - r2) * (n - 1)) / (n - k - 1);
    const shown = num(row.Adj_R_Squared);
    const result = fmt4(adj);
    return {
      heading: `Adj R Squared for model ${row.index ?? row.Index ?? ""}`.trim(),
      steps: ["1 − (1 − R²) × (n − 1) ÷ (n − k − 1)", `1 − (1 − ${fmt4(r2)}) × (${n} − 1) ÷ (${n} − ${k} − 1)`],
      result,
      tableValue: Math.abs(adj - shown) < 1e-6 ? result : fmt4(shown),
      footnote: `n = Num Pts Fitted (${n}), k = number of variables (${k}).`,
    };
  }, [rows]);

  return (
    <AboutTablePanel
      description={
        <>
          Fits a straight-line regression for every pre-built combination of variables, with the
          default rate's logit as the target, and records how well each model fits and whether it
          passes standard statistical checks.
        </>
      }
      legend={modelQualityLegend}
      usedNext={
        <>
          <b>Filtering of Models</b> keeps the models that meet your thresholds.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions items={mfaColumns} />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            logit(default rate) = Intercept + Σ Coefficient × Variable
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Fitted by ordinary least squares, using only months that have a default rate.</li>
          <li>Combinations whose variables are highly correlated (0.8 or more) are skipped.</li>
          <li>Results are split into files of 10,000 models; use Files to choose which to view.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 5 – Filtering of Models ---------------- */

export function OdFilteringAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Narrows the tested models to those that meet your thresholds, for example every p-value
          below a cut-off, VIF below a limit or a minimum R². Models are ranked by adjusted R², best
          first. Tick the ones to compare in the next step.
        </>
      }
      legend={[
        ...modelQualityLegend,
        {
          direction: "higher",
          tone: "bad",
          label: "Higher max abs cor",
          text: "The model's variables move together more.",
        },
      ]}
      usedNext={
        <>
          <b>Candidate Models</b> compares the models you tick here.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            ...mfaColumns,
            { name: "max abs cor", text: "The largest correlation between any two variables in the model." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How the filter works">
        <ul className="list-disc space-y-1 pl-5">
          <li>Every rule must pass (rules are combined with AND). A value of 0 switches a rule off.</li>
          <li>A p-value rule applies to every p-value column in the model, including the intercept's.</li>
          <li>A VIF rule applies to every VIF column; a blank VIF fails.</li>
          <li>Models are sorted by adjusted R² within each batch of 10,000 tested models.</li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 6 – Candidate Models ---------------- */

export function OdCandidateModelsAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Side-by-side comparison of the models you ticked in Filtering. Pick one where each
          variable is significant and doesn't overlap with the others, and the model fits well.
        </>
      }
      legend={modelQualityLegend.slice(0, 4)}
      usedNext={
        <>
          <b>Final Model</b> shows the model you select here. Saving it there makes it the model
          Overlay Execution uses.
        </>
      }
    >
      <InfoCard title="Card contents">
        <ColumnDefinitions
          items={[
            { name: "Variable", text: "The intercept and each economic variable in the model." },
            { name: "Coefficient", text: "How much the logit of the default rate moves per unit of the variable." },
            { name: "P-Value, VIF", text: "Significance and overlap of each variable, from Multi Factor Analysis." },
            { name: "Adj. R², RMSE, MAPE", text: "Overall fit of the model." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How to choose">
        <p>
          There is no automatic ranking here. Prefer models where every p-value is low, VIFs are
          low, adjusted R² is high and RMSE and MAPE are low, and where each coefficient's sign
          makes economic sense (for example, higher unemployment should raise the default rate).
        </p>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 7 – Final Model ---------------- */

export function OdFinalModelAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          The model that will drive the overlay. Saving it makes it the model Overlay Execution
          uses to forecast default rates from the economic scenarios.
        </>
      }
      legend={modelQualityLegend.slice(0, 4)}
      usedNext={
        <>
          <b>Overlay Execution</b>: the Forecasted Loss Rate step applies this equation to each
          scenario's forecast economic values, and the Overlay Multiplier step compares the result
          with the latest observed rate.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Variable", text: "The intercept and each economic variable in the model." },
            { name: "Coefficient", text: "The weight of each variable in the equation." },
            { name: "P-Value, VIF", text: "Significance and overlap of each variable." },
            { name: "RMSE, Adj. R², MAPE", text: "Overall fit of the model." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How the model is used">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            log-odds = Intercept + Σ Coefficient × Variable value
          </code>
        </p>
        <p className="mt-1">
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Default rate = e^log-odds ÷ (1 + e^log-odds)
          </code>
        </p>
      </InfoCard>
    </AboutTablePanel>
  );
}
