// components/about/OverlayExecutionAbout.tsx
// "About this table" panels for the Overlay Execution workflow steps.
import { useMemo } from "react";
import AboutTablePanel, { CalcExample, ColumnDefinitions, InfoCard } from "./AboutTablePanel";
import { interpolationExample, logitExample, type Row } from "./overlayExamples";

type ScenarioRow = { date: string; upside: number; base: number; downside: number };

// Execution interpolation table: up to 2 decimals
const fmt2 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmt4 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
// Forecasted rates table: percentage with 2 decimals
const fmtPct = (f: number) => `${(f * 100).toFixed(2)}%`;

const FORECAST_BANDS =
  "<variable>.Point Forecast, .Lo 80, .Hi 80, .Lo 95, .Hi 95: the ARIMA forecast and its 80% and 95% ranges. Only the Point Forecast is used later. For past months all five equal the actual value.";

/* ---------------- Step 1 – Inputs ---------------- */

export function OeInputsAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Upload the economic data and model files for this run, or let the tool forecast each
          economic variable forward with a time-series (ARIMA) model.
        </>
      }
      usedNext={
        <>
          <b>Forecast Interpolation</b> turns the quarterly forecasts into monthly values.
        </>
      }
    >
      <InfoCard title="Files">
        <ColumnDefinitions
          items={[
            {
              name: "Monthly / Quarterly MEV (ARIMA) Input",
              text: "Economic variables with their forecasts. In Forecast MEV mode they are generated from the uploaded history.",
            },
            {
              name: "Final Model (optional)",
              text: 'With "Use Final Model" on, this file is used instead of the model saved in Overlay Development.',
            },
            {
              name: "Historical Weighted Credit Loss Rates (optional)",
              text: "With its switch on, this is used as the observed loss rate instead of the Development default rate or the Flowrate output.",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How the forecast works (Forecast MEV)">
        <ul className="list-disc space-y-1 pl-5">
          <li>Each variable gets its own seasonal ARIMA model, chosen automatically.</li>
          <li>The forecast runs 12 months (monthly) or 4 quarters (quarterly) past the latest data.</li>
          <li>{FORECAST_BANDS}</li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 2 – Forecast Interpolation ---------------- */

export function OeForecastInterpolationAbout({ rows }: { rows: Row[] }) {
  const example = useMemo(() => interpolationExample(rows, fmt2), [rows]);

  return (
    <AboutTablePanel
      description={
        <>
          Spreads the quarterly economic forecasts into monthly values, to match the monthly
          loss-rate history.
        </>
      }
      usedNext={
        <>
          The next step joins these with the monthly forecasts into one timeline.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Date, Year, Month, ID, Period ID", text: "The month of the row (ID is YYYY-Mon)." },
            { name: "x", text: "A row counter. It isn't used in any calculation." },
            { name: "Forecast columns", text: FORECAST_BANDS },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <ul className="list-disc space-y-1 pl-5">
          <li>Each quarter's value is placed on the quarter's last month (Mar, Jun, Sep, Dec).</li>
          <li>The months in between are filled along a straight line: +⅓ and +⅔ of the change to the next quarter.</li>
          <li>After the last quarter, the last value is repeated until the forecast period ends.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 3 – Combine forecasted MEV and interpolation ---------------- */

export function OeCombineAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Joins the monthly forecasts and the interpolated quarterly forecasts into one monthly
          timeline, keeping only the variables used in the final model.
        </>
      }
      usedNext={
        <>
          <b>Data Transformation</b> uses this timeline as the starting point for each scenario's
          values.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Date, year, month, id", text: "The month of the row." },
            { name: "x", text: "A row counter. It isn't used in any calculation." },
            { name: "Forecast columns", text: FORECAST_BANDS },
          ]}
        />
      </InfoCard>
      <InfoCard title="How the table is built">
        <ul className="list-disc space-y-1 pl-5">
          <li>Rows are matched by month (id). Nothing is recalculated here.</li>
          <li>
            A variable is kept when its name before the first "." matches a final-model variable,
            for example unemp_rate for unemp_rate.lag_3.
          </li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 4 – Data Transformation ---------------- */

export function OeTransformationAbout({ defaultRows }: { defaultRows: Row[] }) {
  const example = useMemo(() => logitExample(defaultRows, fmt4), [defaultRows]);

  return (
    <AboutTablePanel
      description={
        <>
          Set the forecast economic values for each scenario (Upside, Base, Downside) with MEV
          Config. The tool builds each scenario's history plus forecast, and shows the standard
          transformations for reference.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher logit",
          text: "A higher loss rate. The logit keeps the same order on a different scale.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Scenarios start the same",
          text: "All three scenarios default to the ARIMA point forecast until you change them in MEV Config.",
        },
      ]}
      usedNext={
        <>
          <b>MEVs Forecast Transformation</b> takes the Upside, Base and Downside values of each
          variable.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Upside / Base / Downside <variable>", text: "The scenario's value for that month." },
            { name: "<variable>.ln or .asinh", text: "Log of the variable (asinh when it can be 0 or negative)." },
            { name: "<variable>.diff_12", text: "Value minus the value 12 months earlier." },
            { name: "<variable>.lag_3 / 6 / 9 / 12", text: "The value 3, 6, 9 or 12 months earlier." },
            { name: "<rate>.logit", text: "The observed loss rate on the log-odds scale." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            MEV Config covers the 12 month-ends after the latest loss-rate date. Earlier months use
            the actual history.
          </li>
          <li>Enter rates in MEV Config as decimals, for example 0.056 for 5.6%.</li>
          <li>logit = ln(rate ÷ (1 − rate)); a rate of 0 is treated as 0.001 and 1 as 0.99999.</li>
        </ul>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 5 – MEVs Forecast Transformation ---------------- */

export function OeMevForecastAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          Shifts each scenario's forecast values by the time lag the final model uses for that
          variable, so each month lines up with the model's inputs.
        </>
      }
      legend={[
        {
          direction: "note",
          tone: "neutral",
          label: "Upside, Base and Downside",
          text: "They differ only if you changed the scenario values in MEV Config.",
        },
      ]}
      usedNext={
        <>
          <b>Forecasted Loss Rate Calculation</b> plugs these values into the final model.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Period", text: "The forecast month." },
            { name: "Upside / Base / Downside", text: "One column per model variable for each scenario." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            If the model uses a lagged variable (for example unemp_rate.lag_3), the value shown for
            a month is the scenario's value from that many months earlier.
          </li>
          <li>Variables without a lag pass through unchanged. Only lags are applied here.</li>
          <li>
            To trace a value: Base unemp_rate for December (model variable unemp_rate.lag_3) equals
            Base unemp_rate for September in Data Transformation.
          </li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 6 – Forecasted Loss Rate Calculation ---------------- */

export function OeForecastedLossRateAbout({
  mlrRows,
  forecastRows,
}: {
  mlrRows: ScenarioRow[];
  forecastRows: ScenarioRow[];
}) {
  // Worked example: the Base forecast rate in the last month, from that month's MLR value
  const example = useMemo(() => {
    const mlr = mlrRows?.[mlrRows.length - 1];
    if (!mlr || !Number.isFinite(mlr.base)) return null;
    const forecast = forecastRows?.find((r) => r.date === mlr.date);
    const rate = Math.exp(mlr.base) / (1 + Math.exp(mlr.base));
    const result = fmtPct(rate);
    const shown = forecast ? fmtPct(forecast.base) : null;
    return {
      heading: `Base forecast rate for ${mlr.date}`,
      steps: ["e^MLR ÷ (1 + e^MLR)", `e^${mlr.base.toFixed(4)} ÷ (1 + e^${mlr.base.toFixed(4)})`],
      result,
      tableValue: shown === null ? null : shown === result ? result : shown,
    };
  }, [mlrRows, forecastRows]);

  return (
    <AboutTablePanel
      description={
        <>
          Applies the final model's equation to each scenario's forecast economic values, giving a
          forecast monthly loss rate for Upside, Base and Downside.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher forecast rate",
          text: "A larger share of the balance is expected to be lost in that scenario.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Scenario order",
          text: "Usually Downside ≥ Base ≥ Upside. All three match unless MEV Config was changed.",
        },
      ]}
      usedNext={
        <>
          <b>Overlay Multiplier</b> compares the last forecast month with the latest observed loss
          rate.
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Final Overlay Model", text: "The intercept and coefficient of each model variable." },
            { name: "Multiple Linear Regression (MLR)", text: "The model's result for each month and scenario, on the log-odds scale." },
            { name: "Forecasted PDs (%)", text: "The MLR value converted back to a rate." },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            MLR = Intercept + Σ Coefficient × scenario value
          </code>
        </p>
        <p className="mt-1">
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Forecast rate = e^MLR ÷ (1 + e^MLR)
          </code>
        </p>
        <p className="mt-2">Scenario values come from MEVs Forecast Transformation; a missing value counts as 0.</p>
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 7 – Overlay Multiplier ---------------- */

export function OeOverlayMultiplierAbout() {
  return (
    <AboutTablePanel
      description={
        <>
          For each scenario, compares the forecast loss rate 12 months ahead with the latest
          observed loss rate. The ratio scales the historical loss rates used for ECL.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Above 1",
          text: "Losses are expected to rise from current levels, which increases ECL.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Below 1",
          text: "Losses are expected to fall, which lowers ECL.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Exactly 1",
          text: "No change from the historical loss rates.",
        },
      ]}
      usedNext={
        <>
          <b>ECL – Credit Loss Rate</b>: each bucket's historical loss rate × this multiplier
          (capped at 100%).
        </>
      }
    >
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Report date", text: "Date of the latest observed loss rate." },
            {
              name: "Upside / Base / Downside",
              text: "The multiplier for each scenario, shown as a ratio (1.65 means 65% above the latest observed rate).",
            },
          ]}
        />
      </InfoCard>
      <InfoCard title="How each number is calculated">
        <p>
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            Multiplier = forecast rate in the last forecast month ÷ latest observed rate
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Forecast rate: the last row of Forecasted Loss Rate Calculation, for each scenario.</li>
          <li>
            Observed rate: the uploaded Historical Weighted Credit Loss Rates if switched on in
            Inputs, otherwise the latest Weighted Credit Loss Rate per Month from the Flowrate
            approach.
          </li>
          <li>The scenarios aren't weighted here; the probability weights are applied in ECL.</li>
        </ul>
      </InfoCard>
    </AboutTablePanel>
  );
}
