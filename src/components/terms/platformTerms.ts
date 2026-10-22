// Text of the platform terms shown after login. Users accept a SHA-256 of TERMS_CONTENT,
// so any change here asks every user to accept again.
// Each statement about the calculation was checked against the code; keep them in step with it.

export const TERMS_VERSION = "1.1";
export const TERMS_EFFECTIVE_DATE = "October 22, 2026";

export type TermsIcon =
  | "document"
  | "cog"
  | "warning"
  | "users"
  | "notCovered"
  | "scale"
  | "shield"
  | "record";

export type TermsSection = {
  id: string;
  icon: TermsIcon;
  title: string;
  body: string;
  points?: string[];
  footer?: string;
};

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "purpose",
    icon: "document",
    title: "Purpose of the Application",
    body: "The ECL Automation application assists users in calculating Expected Credit Loss (ECL) under PFRS 9 (IFRS 9 as adopted in the Philippines). It is designed to support data-driven risk management and is not a substitute for professional judgment.",
  },
  {
    id: "methodology",
    icon: "cog",
    title: "Methodology and Assumptions",
    body: "The application uses predefined calculation methodologies, default parameter values, and assumptions. Some assumptions are fixed in the system and cannot be modified by users. Others come from SGV's reference method, from the values you enter, or from the files you upload. These assumptions may affect the ECL results. The key platform assumptions are listed in the next step, Platform Assumptions.",
  },
  {
    id: "limitations",
    icon: "warning",
    title: "Limitations",
    body: "The output from this application is a working calculation and should not be used for financial reporting or booking purposes without appropriate validation, review and approval in accordance with the client's policies and applicable regulatory requirements. In particular:",
    points: [
      "The application does not separate the preparer of a run from its approver, and it does not lock a run once it is approved. Review and approval must be done and documented outside the application.",
      "Outputs do not list the input files, parameter values or platform version used. Each calculation step uses the most recent file saved in the workflow folder.",
      "Some default values are applied without a warning. They are listed in Platform Assumptions.",
      "The models are not validated, back-tested or monitored within the application.",
    ],
  },
  {
    id: "responsibilities",
    icon: "users",
    title: "User Responsibilities",
    body: "Users are responsible for the accuracy and completeness of input data, the review of calculation parameters, and the appropriate use of the results. Users must ensure that the output is reviewed and approved by authorized personnel before it is used for financial reporting. In particular, you must:",
    points: [
      "Check that uploaded balances agree with the general ledger or another control total.",
      "Check that the aging buckets in each uploaded aging report are in the right order. The application uses the columns in the order they appear and does not check it.",
      "Record, outside the application, the reason and the approver whenever you change a default value or proceed with a file that failed validation. The application does not record reasons.",
      "Use only your own account and keep your password private.",
    ],
  },
  {
    id: "not-covered",
    icon: "notCovered",
    title: "What the Application Does Not Cover",
    body: "The following PFRS 9 requirements are not performed by the application. The client's approved policy must address them, or they must be handled outside the application.",
    points: [
      "Staging and significant increase in credit risk (PFRS 9 5.5.3, 5.5.5, 5.5.11). There is no Stage 1, 2 or 3 and no 12-month ECL. One loss rate per aging bucket is applied to the full balance of every loan.",
      "Time value of money (PFRS 9 5.5.17(b), B5.5.44). Expected losses are not discounted, and the effective interest rate is not used in the calculation.",
      "Exposure beyond the current balance. Only the outstanding loan balance is used. Undrawn commitments and expected repayments are not considered.",
      "Recoveries. Write-offs and recoveries are not modelled. The last aging bucket is treated as a complete write-off with a 100% loss rate.",
      "BSP minimum allowance (MORB Appendix 15). For BSP-supervised institutions, the result is not compared with the BSP minimum allowance rates.",
    ],
  },
  {
    id: "standards",
    icon: "scale",
    title: "Applicable Standards and Client Type",
    body: "The method is designed for PFRS 9. The governance requirements that apply depend on the client's regulator:",
    points: [
      "Banks and other BSP-supervised financial institutions: BSP Circular 1011 and the Manual of Regulations for Banks apply, with BCBS d350 as international guidance.",
      "Microfinance NGOs accredited by the MNRC, and lenders supervised by the SEC or the CDA: confirm the reporting framework the client applies before relying on the results.",
    ],
    footer:
      "The application does not record the client type, regulator or reporting framework. Record them in the engagement file.",
  },
  {
    id: "privacy",
    icon: "shield",
    title: "Data Privacy and AI Mode",
    body: "Client data can include personal information protected by the Data Privacy Act of 2012 (RA 10173). Handle it in line with the engagement terms and SGV's data privacy policies.",
    points: [
      "AI Mode sends your questions and any files you attach to an external server (brain-sam.sgvnexus.uk). Do not use AI Mode with client data unless its use has been approved.",
    ],
  },
  {
    id: "record",
    icon: "record",
    title: "Record of Your Acceptance",
    body: "When you accept these terms, the application records your username, the platform version, the version and fingerprint of these terms, and the date and time. You will be asked to accept again when the platform is updated or these terms change.",
  },
];

export const TERMS_STATEMENT =
  "I have read, understood, and accept the above terms and acknowledge the application's methodology, assumptions, limitations, and my responsibilities as a user.";

// Who sets an assumption: the platform code, SGV's reference method, the analyst, or an uploaded file
export type AssumptionSource = "PLT" | "REF" | "USR" | "DAT";

export const ASSUMPTION_SOURCES: Record<
  AssumptionSource,
  { label: string; setBy: string; canChange: string }
> = {
  PLT: {
    label: "Platform",
    setBy: "Fixed in the application code.",
    canChange: "You cannot change it.",
  },
  REF: {
    label: "Reference method",
    setBy: "Taken from SGV's reference method, as a default value or as part of the design.",
    canChange: "Defaults can be changed; the design cannot.",
  },
  USR: {
    label: "You (analyst)",
    setBy: "Entered by you on a screen or by your choice of file.",
    canChange: "Yes. Record the reason for any change.",
  },
  DAT: {
    label: "Uploaded data",
    setBy: "Fixed by the content of a file you upload.",
    canChange: "Only by uploading a different file.",
  },
};

export type Assumption = {
  item: string;
  value: string;
  source: AssumptionSource;
  canChange: string;
};

export const ASSUMPTION_GROUPS: { title: string; rows: Assumption[] }[] = [
  {
    title: "Default and aging buckets",
    rows: [
      {
        item: "Default definition",
        value:
          "A loan is in default when it is more than 90 days past due. Once a loan is more than 90 days past due, it stays in default for all later months.",
        source: "PLT",
        canChange: "No",
      },
      {
        item: "PD aging buckets",
        value: "0, 1–30, 31–60, 61–90 and 91+ days past due. The bucket settings screen is turned off.",
        source: "PLT",
        canChange: "No",
      },
      {
        item: "Flow-rate aging buckets",
        value:
          "Taken from the columns of the uploaded aging report, in the order they appear. The order is not checked.",
        source: "DAT",
        canChange: "Only by uploading a different file",
      },
      {
        item: "Last aging bucket",
        value: "Treated as a complete write-off: its loss rate is 100%.",
        source: "PLT",
        canChange: "No",
      },
    ],
  },
  {
    title: "Measurement",
    rows: [
      {
        item: "Staging",
        value:
          "None. One loss rate per aging bucket is applied to the full balance of every loan, with no 12-month ECL.",
        source: "REF",
        canChange: "No",
      },
      {
        item: "Exposure",
        value: "The outstanding loan balance at the reporting date.",
        source: "PLT",
        canChange: "No",
      },
      {
        item: "Discounting",
        value: "None. The effective interest rate is not used.",
        source: "PLT",
        canChange: "No",
      },
      {
        item: "Unmatched aging category",
        value:
          "A loan whose aging category is not found in the loss-rate table gets a 100% loss rate, without a warning.",
        source: "PLT",
        canChange: "No",
      },
      {
        item: "Loss-rate cap",
        value: "Flow rates and scenario loss rates are capped at 100%.",
        source: "PLT",
        canChange: "No",
      },
    ],
  },
  {
    title: "Forward-looking scenarios",
    rows: [
      {
        item: "Scenarios",
        value: "Three: Upside, Base and Downside.",
        source: "REF",
        canChange: "No",
      },
      {
        item: "Scenario weights",
        value:
          "You enter them. The screen starts at 30% / 50% / 20% (Upside / Base / Downside); SGV's reference method uses 25% / 50% / 25%. Weights are not rescaled when they do not total 100%.",
        source: "USR",
        canChange: "Yes",
      },
      {
        item: "Upside and Downside MEV values",
        value:
          "Pre-filled with the same forecast as Base. If you keep them, all three scenarios give the same result.",
        source: "USR",
        canChange: "Yes, in MEV Config",
      },
      {
        item: "MEV forecast source",
        value:
          "An uploaded file, values you type in MEV Config, or an ARIMA forecast that uses only each variable's own history.",
        source: "USR",
        canChange: "Yes",
      },
      {
        item: "Missing MEV value",
        value: "A blank, non-numeric or missing macroeconomic value is treated as 0, without a warning.",
        source: "PLT",
        canChange: "No",
      },
    ],
  },
  {
    title: "Overlay models",
    rows: [
      {
        item: "Variables per model",
        value: "You enter the number in Multi-Factor Analysis. SGV's reference method uses 3.",
        source: "USR",
        canChange: "Yes",
      },
      {
        item: "Model filter thresholds",
        value: "No default; you enter them. SGV's reference method gives recommended values.",
        source: "USR",
        canChange: "Yes",
      },
      {
        item: "Final model",
        value:
          "Chosen by you from the candidate models, or uploaded as a model file. An uploaded model is not checked against the fitted model.",
        source: "USR",
        canChange: "Yes",
      },
    ],
  },
  {
    title: "Workflow and data handling",
    rows: [
      {
        item: "Baseline year",
        value:
          "The year of the reporting date you enter when you create a workflow. The full reporting date is not stored.",
        source: "USR",
        canChange: "When you create the workflow",
      },
      {
        item: "Input file used by each step",
        value: "The most recently saved file in the workflow folder.",
        source: "PLT",
        canChange: "No",
      },
      {
        item: "Files that fail validation",
        value:
          "You can choose to proceed with a file that failed validation. The application does not record that you did so.",
        source: "USR",
        canChange: "Yes. Record the reason outside the application.",
      },
    ],
  },
];

export const KEY_DEFAULTS_NOTE = {
  title: "Defaults can change the ECL without a record",
  body: "The scenario weights screen starts at 30/50/20, while SGV's reference method uses 25/50/25. In SGV's tests, keeping 30/50/20 lowered the ECL by about 4%, and weights totalling 80% lowered it by about 23%. The application does not record which weights you used or why. Check every default against the client's approved policy and record the reason for any change.",
};

export const ASSUMPTIONS_STATEMENT =
  "I have reviewed the platform assumptions and understand that some cannot be changed and may affect the ECL result.";

export const CONFIRMATION_POINTS = [
  "I have read and accept the Platform Terms and Acknowledgment.",
  "I have reviewed the platform assumptions and understand that some cannot be changed and may affect the ECL result.",
  "I understand that outputs are working calculations and must be validated, reviewed and approved under the client's policies before they are used for financial reporting.",
  "I will record, outside the application, the reason and the approver for any change to a default value and for any file I use after it failed validation.",
  "I will not use AI Mode with client data unless its use has been approved.",
];

// Everything the user accepts; its SHA-256 is stored with each acceptance
export const TERMS_CONTENT = {
  version: TERMS_VERSION,
  effectiveDate: TERMS_EFFECTIVE_DATE,
  sections: TERMS_SECTIONS,
  termsStatement: TERMS_STATEMENT,
  sources: ASSUMPTION_SOURCES,
  assumptions: ASSUMPTION_GROUPS,
  keyDefaultsNote: KEY_DEFAULTS_NOTE,
  assumptionsStatement: ASSUMPTIONS_STATEMENT,
  confirmationPoints: CONFIRMATION_POINTS,
};
