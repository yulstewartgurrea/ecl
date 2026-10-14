// components/about/OverlayExecutionAbout.tsx
// "About this table" panels for the Overlay Execution workflow steps.
import { useMemo } from "react";
import AboutTablePanel, { CalcExample, ColumnDefinitions, DefinitionTable, InfoCard } from "./AboutTablePanel";
import { interpolationExample, logitExample, type Row } from "./overlayExamples";

type ScenarioRow = { date: string; upside: number; base: number; downside: number };
type ModelTerm = { variable: string; coefficient: number };
type MevRow = { period: string; base: Record<string, string> };

// "2026-12-31" or "12/31/2026" -> "2026-12-31", so MLR rows and scenario values can be matched
const toYmd = (d: string) => {
  const s = String(d ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : s;
};

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
      <InfoCard title="How ARIMA forecasts (Forecast MEV)">
        <p>
          ARIMA guesses each indicator's next values from its own history, assuming its past
          pattern continues. It doesn't use any other information about the economy.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>Recent values matter:</b> if unemployment was high last month, it's probably still
            high this month.
          </li>
          <li>
            <b>Changes, not just levels:</b> it looks at how much a value moves each month, so a
            steady rise doesn't confuse it.
          </li>
          <li>
            <b>Learns from misses:</b> if the last guess was too low, it nudges the next one up.
          </li>
          <li>
            <b>Seasons:</b> it picks up patterns that repeat every year, like a December spike.
          </li>
          <li>
            For each indicator the app tries many versions and keeps the one that fits the history
            best without being overly complicated.
          </li>
        </ul>
      </InfoCard>
      <InfoCard title="What you get">
        <ul className="list-disc space-y-1 pl-5">
          <li>A forecast for the next 12 months (monthly data) or 4 quarters (quarterly data).</li>
          <li>
            <b>Point Forecast:</b> the single best guess. This is the only value used in the later
            steps.
          </li>
          <li>
            <b>Lo/Hi 80 and Lo/Hi 95:</b> the likely range around the guess. It gets wider the
            further ahead you look, like a weather forecast. These ranges aren't used later.
          </li>
          <li>For past months, all of these columns simply equal the actual value.</li>
        </ul>
      </InfoCard>
      <InfoCard title="Keep in mind">
        <ul className="list-disc space-y-1 pl-5">
          <li>It can't see surprises coming, such as a crisis or a sudden policy change.</li>
          <li>
            Each indicator is forecast on its own: it doesn't know that GDP and unemployment affect
            each other.
          </li>
          <li>With only a few years of history, forecasts tend to flatten out.</li>
          <li>
            It gives one "most likely" path. Upside, Base and Downside all start from it and only
            differ if you change them in <b>MEV Config</b> (Data Transformation step).
          </li>
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

// "unemp_rate.lag_3" -> "value from 3 months earlier"
const describeModelVariable = (v: string) => {
  const parts: string[] = [];
  if (/\.ln\b/.test(v)) parts.push("log of the value");
  if (/\.diff_12\b/.test(v)) parts.push("change vs 12 months earlier");
  const lag = v.match(/\.lag_(\d+)/);
  if (lag) parts.push(`value from ${lag[1]} months earlier`);
  return parts.length ? parts.join(", ") : "value of the same month";
};

export function OeMevForecastAbout({ modelTerms = [] }: { modelTerms?: ModelTerm[] }) {
  const terms = modelTerms.filter((t) => t.variable.toLowerCase() !== "intercept" && Number.isFinite(t.coefficient));
  const strongest = terms.reduce<ModelTerm | null>(
    (best, t) => (!best || Math.abs(t.coefficient) > Math.abs(best.coefficient) ? t : best),
    null
  );

  return (
    <AboutTablePanel
      description={
        <>
          Shows each scenario's forecast values for the economic indicators used by the final
          model, shifted by the time lag the model uses for each one. Each number is the
          indicator's value for that month and scenario; rates are decimals (0.06 = 6%).
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "neutral",
          label: "Higher value",
          text: "Raises the forecast loss rate if the model's coefficient for that indicator is positive, and lowers it if negative. See the table below.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "Downside vs Base",
          text: "The further Downside is from Base (in the direction that raises losses), the harsher the stress scenario.",
        },
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
      <InfoCard title="What a higher value does in this model" wide>
        {terms.length > 0 ? (
          <>
            <DefinitionTable
              headers={["Indicator", "Used in the model as", "Coefficient", "A higher value…"]}
              rows={terms.map((t) => [
                t.variable.split(".")[0],
                `${t.variable} (${describeModelVariable(t.variable)})`,
                `${t.coefficient > 0 ? "+" : ""}${fmt4(t.coefficient)}`,
                t.coefficient > 0 ? (
                  <span className="font-semibold text-red-700">raises the forecast loss rate (worse)</span>
                ) : t.coefficient < 0 ? (
                  <span className="font-semibold text-green-700">lowers the forecast loss rate (better)</span>
                ) : (
                  "has no effect"
                ),
              ])}
            />
            {strongest && (
              <p className="mt-2">
                The size matters too: the effect is coefficient × change in value. For example, if{" "}
                {strongest.variable.split(".")[0]} rises by 0.01 (one percentage point for a rate),
                the model score on the next page (MLR) changes by {fmt4(strongest.coefficient * 0.01)},
                which {strongest.coefficient > 0 ? "raises" : "lowers"} the forecast loss rate.
              </p>
            )}
          </>
        ) : (
          <p>
            It depends on the indicator and the final model: if the model's coefficient for an
            indicator is positive, a higher value raises the forecast loss rate; if negative, it
            lowers it. The coefficients are shown on the next page.
          </p>
        )}
      </InfoCard>
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            { name: "Period", text: "The forecast month." },
            {
              name: "Upside / Base / Downside",
              text: "One column per model indicator for each scenario. Rates are decimals, shown to 2 places (0.06 = 6%).",
            },
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
  finalModel = [],
  mevRows = [],
}: {
  mlrRows: ScenarioRow[];
  forecastRows: ScenarioRow[];
  /** Intercept and coefficients shown in the Final Overlay Model table */
  finalModel?: ModelTerm[];
  /** Scenario values from MEVs Forecast Transformation */
  mevRows?: MevRow[];
}) {
  // Worked example: the Base MLR in the last month = intercept + Σ coefficient × Base value.
  // Like the backend, a variable such as unemp_rate.lag_3 uses the "Base unemp_rate" value
  // (already shifted for the lag), and a missing value counts as 0.
  const mlrExample = useMemo(() => {
    const mlr = mlrRows?.[mlrRows.length - 1];
    const intercept = finalModel.find((t) => t.variable.toLowerCase() === "intercept");
    const terms = finalModel.filter((t) => t.variable.toLowerCase() !== "intercept");
    if (!mlr || !intercept || !terms.length || !mevRows.length) return null;
    const values = mevRows.find((r) => toYmd(r.period) === toYmd(mlr.date))?.base;
    if (!values) return null;

    const lines = terms.map((t) => {
      const name = t.variable.split(".")[0];
      const raw = Number(String(values[name] ?? "").replace(/,/g, ""));
      const value = Number.isFinite(raw) && String(values[name] ?? "").trim() !== "" ? raw : 0;
      return { variable: t.variable, name, coefficient: t.coefficient, value, product: t.coefficient * value };
    });
    const total = intercept.coefficient + lines.reduce((sum, l) => sum + l.product, 0);
    const result = total.toFixed(2);
    const shown = mlr.base.toFixed(2);
    return {
      heading: `Base MLR for ${mlr.date}`,
      steps: ["Intercept + Σ (coefficient × Base value of the variable)"],
      terms: [
        { label: "Intercept", parts: "", value: fmt4(intercept.coefficient) },
        ...lines.map((l) => ({
          label: l.variable,
          parts: `${fmt4(l.coefficient)} × ${fmt4(l.value)}`,
          value: fmt4(l.product),
        })),
      ],
      result,
      tableValue: shown === result ? result : shown,
      footnote:
        "Base values come from MEVs Forecast Transformation (the Base column of each variable, already shifted for any lag).",
    };
  }, [mlrRows, finalModel, mevRows]);

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
          forecast monthly loss rate for Upside, Base and Downside. The MLR table is the model's
          raw score; the Forecasted PDs table turns that score into a percentage.
        </>
      }
      legend={[
        {
          direction: "higher",
          tone: "bad",
          label: "Higher MLR (closer to 0)",
          text: "A higher forecast loss rate. MLR and the rate always move together.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Lower MLR (more negative)",
          text: "A lower forecast loss rate.",
        },
        {
          direction: "higher",
          tone: "bad",
          label: "Higher Forecasted PD",
          text: "A larger share of the balance is expected to be lost in that month and scenario.",
        },
        {
          direction: "lower",
          tone: "good",
          label: "Lower Forecasted PD",
          text: "A smaller share of the balance is expected to be lost.",
        },
        {
          direction: "note",
          tone: "neutral",
          label: "MLR is not a percentage",
          text: "Read it through the Forecasted PDs table: 0 means 50%, and negative numbers mean below 50%.",
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
      <InfoCard title="Reading the Forecasted PDs">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Each value is the share of the balance expected to be lost (the forecast loss or
            default rate) in that month, under that scenario.
          </li>
          <li>
            Compare them with the latest observed loss rate. Higher than today means the model
            expects losses to rise; lower means it expects them to fall.
          </li>
          <li>
            The last month (12 months ahead) is the one the Overlay Multiplier step uses. If it is
            above the latest observed loss rate, the multiplier is above 1, which raises ECL.
          </li>
        </ul>
      </InfoCard>
      <InfoCard title="Column definitions">
        <ColumnDefinitions
          items={[
            {
              name: "Final Overlay Model",
              text: "The intercept and each variable's coefficient. A positive coefficient means the forecast rate rises when that variable rises; a negative one means it falls.",
            },
            { name: "Multiple Linear Regression (MLR)", text: "The model's score for each month and scenario, on the log-odds scale." },
            { name: "Forecasted PDs (%)", text: "The MLR score converted to a percentage: the forecast loss rate." },
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
        {mlrExample && <CalcExample {...mlrExample} />}
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}

/* ---------------- Step 7 – Overlay Multiplier ---------------- */

type MultiplierRow = {
  reportDate: string;
  base: number;
  observedRate?: number;
  forecastUpside?: number;
  forecastBase?: number;
  forecastDownside?: number;
};

export function OeOverlayMultiplierAbout({ rows = [] }: { rows?: MultiplierRow[] }) {
  // Worked example: Base multiplier = Base forecast rate (last forecast month) ÷ latest observed rate
  const example = useMemo(() => {
    const row = rows[0];
    const obs = row?.observedRate;
    if (!row || !obs || row.forecastBase === undefined) return null;
    const result = (row.forecastBase / obs).toFixed(2);
    const shown = row.base.toFixed(2);
    const other = (label: string, f?: number) =>
      f === undefined ? "" : `${label}: ${fmtPct(f)} ÷ ${fmtPct(obs)} = ${(f / obs).toFixed(2)}. `;
    return {
      heading: `Base overlay multiplier (report date ${row.reportDate})`,
      steps: [
        "Base forecast rate in the last forecast month ÷ latest observed rate",
        `${fmtPct(row.forecastBase)} ÷ ${fmtPct(obs)}`,
      ],
      result,
      tableValue: shown === result ? result : shown,
      footnote: `${other("Upside", row.forecastUpside)}${other("Downside", row.forecastDownside)}Same formula with each scenario's own forecast rate.`.trim(),
    };
  }, [rows]);

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
        {example && <CalcExample {...example} />}
      </InfoCard>
    </AboutTablePanel>
  );
}
