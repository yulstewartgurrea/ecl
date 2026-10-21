import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector } from "../../redux_toolkit/hooks";
import { acceptTerms, type TermsAcceptance as AcceptanceRecord } from "../../services/terms";
import {
  ASSUMPTION_GROUPS,
  ASSUMPTION_SOURCES,
  ASSUMPTIONS_STATEMENT,
  CONFIRMATION_POINTS,
  KEY_DEFAULTS_NOTE,
  TERMS_EFFECTIVE_DATE,
  TERMS_SECTIONS,
  TERMS_STATEMENT,
  TERMS_VERSION,
  type AssumptionSource,
  type TermsIcon,
} from "./platformTerms";

const STEPS = [
  { title: "Terms and Conditions", subtitle: "Review and accept" },
  { title: "Platform Assumptions", subtitle: "Key information" },
  { title: "Confirmation", subtitle: "Acknowledge" },
  { title: "Continue", subtitle: "Go to application" },
];

const HEADINGS = [
  {
    title: "Platform Terms and Acknowledgment",
    intro:
      "Please read and understand the following terms and information before using the ECL Automation application. By proceeding, you acknowledge your understanding and acceptance of these terms.",
  },
  {
    title: "Platform Assumptions",
    intro:
      "The ECL result depends on assumptions from four sources. Review the key assumptions below, who sets each one, and whether you can change it.",
  },
  {
    title: "Confirm Your Acknowledgment",
    intro:
      "Check the details below. When you confirm, the application records your acceptance against your user account.",
  },
  {
    title: "Acknowledgment Recorded",
    intro: "Thank you. Your acceptance of the platform terms has been recorded.",
  },
];

const ICONS: Record<TermsIcon, typeof DocumentTextIcon> = {
  document: DocumentTextIcon,
  cog: Cog6ToothIcon,
  warning: ExclamationCircleIcon,
  users: UserGroupIcon,
  notCovered: NoSymbolIcon,
  scale: ScaleIcon,
  shield: ShieldCheckIcon,
  record: ClipboardDocumentCheckIcon,
};

const SOURCE_STYLES: Record<AssumptionSource, string> = {
  PLT: "bg-slate-100 text-slate-700 ring-slate-300",
  REF: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  USR: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DAT: "bg-sky-50 text-sky-700 ring-sky-200",
};

const primaryButton =
  "flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#EA8024] to-[#FFBB00] px-8 py-3 font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
const secondaryButton =
  "flex items-center justify-center gap-2 rounded-xl border-2 border-[#EA8024] bg-white px-10 py-3 font-semibold text-[#EA8024] transition-colors hover:bg-orange-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

// Scroll area that reports once the user has reached the end (or when everything already fits)
const ScrollPanel = ({ children, onReachEnd }: { children: ReactNode; onReachEnd?: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const check = useCallback(() => {
    const el = ref.current;
    if (el && onReachEnd && el.scrollTop + el.clientHeight >= el.scrollHeight - 12) onReachEnd();
  }, [onReachEnd]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [check]);

  return (
    <div
      ref={ref}
      onScroll={check}
      className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white px-6 py-5"
    >
      {children}
    </div>
  );
};

const SourcePill = ({ source }: { source: AssumptionSource }) => (
  <span
    className={clsx(
      "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
      SOURCE_STYLES[source]
    )}
  >
    {ASSUMPTION_SOURCES[source].label}
  </span>
);

const Checkbox = ({
  checked,
  disabled,
  onChange,
  children,
  hint,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  hint?: string;
}) => (
  <div>
    <label
      className={clsx(
        "flex items-start gap-4 text-[15px] leading-relaxed text-slate-800",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#EA8024] disabled:cursor-not-allowed"
      />
      <span>{children}</span>
    </label>
    {disabled && hint && <p className="mt-1 pl-9 text-xs text-slate-500">{hint}</p>}
  </div>
);

const TermsStep = () => (
  <div className="space-y-6">
    {TERMS_SECTIONS.map((section, i) => {
      const Icon = ICONS[section.icon];
      return (
        <section key={section.id} className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#EA8024]">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-[17px] font-semibold text-slate-900">
              {i + 1}. {section.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{section.body}</p>
            {section.points && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600 marker:text-[#EA8024]">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
            {section.footer && (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.footer}</p>
            )}
          </div>
        </section>
      );
    })}
  </div>
);

const AssumptionsStep = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {(Object.keys(ASSUMPTION_SOURCES) as AssumptionSource[]).map((key) => (
        <div key={key} className="rounded-lg border border-slate-200 p-3">
          <SourcePill source={key} />
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{ASSUMPTION_SOURCES[key].setBy}</p>
          <p className="mt-1 text-xs font-medium text-slate-800">{ASSUMPTION_SOURCES[key].canChange}</p>
        </div>
      ))}
    </div>

    <table className="w-full border-collapse text-left text-sm">
      <thead className="sticky -top-5 z-10 bg-white">
        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <th className="w-[22%] py-2 pr-4 font-semibold">Assumption</th>
          <th className="py-2 pr-4 font-semibold">What the application does</th>
          <th className="w-[1%] py-2 pr-4 font-semibold">Set by</th>
          <th className="w-[18%] py-2 font-semibold">Can you change it?</th>
        </tr>
      </thead>
      {ASSUMPTION_GROUPS.map((group) => (
        <tbody key={group.title}>
          <tr>
            <th colSpan={4} className="bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#C2611A]">
              {group.title}
            </th>
          </tr>
          {group.rows.map((row) => (
            <tr key={row.item} className="border-b border-slate-100 align-top">
              <td className="py-3 pr-4 font-medium text-slate-900">{row.item}</td>
              <td className="py-3 pr-4 leading-relaxed text-slate-600">{row.value}</td>
              <td className="py-3 pr-4">
                <SourcePill source={row.source} />
              </td>
              <td className="py-3 leading-relaxed text-slate-600">{row.canChange}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>

    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-amber-600" />
      <div className="text-sm leading-relaxed text-amber-900">
        <p className="font-semibold">{KEY_DEFAULTS_NOTE.title}</p>
        <p className="mt-1">{KEY_DEFAULTS_NOTE.body}</p>
      </div>
    </div>
  </div>
);

const ConfirmationStep = ({
  username,
  appVersion,
  termsHash,
  error,
}: {
  username: string;
  appVersion: string;
  termsHash: string;
  error: string | null;
}) => (
  <div className="space-y-6">
    <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-3 rounded-xl bg-slate-50 p-5 text-sm">
      <dt className="text-slate-500">User</dt>
      <dd className="font-medium text-slate-900">{username || "—"}</dd>
      <dt className="text-slate-500">Platform version</dt>
      <dd className="font-medium text-slate-900">{appVersion}</dd>
      <dt className="text-slate-500">Terms version</dt>
      <dd className="font-medium text-slate-900">
        {TERMS_VERSION}, effective {TERMS_EFFECTIVE_DATE}
      </dd>
      <dt className="text-slate-500">Terms fingerprint (SHA-256)</dt>
      <dd className="break-all font-mono text-xs text-slate-700">{termsHash}</dd>
      <dt className="text-slate-500">Date and time</dt>
      <dd className="text-slate-700">Recorded by the application when you confirm</dd>
    </dl>

    <div>
      <p className="text-sm font-semibold text-slate-900">By confirming, you confirm that:</p>
      <ul className="mt-3 space-y-2">
        {CONFIRMATION_POINTS.map((point) => (
          <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-700">
            <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#EA8024]" />
            {point}
          </li>
        ))}
      </ul>
    </div>

    {error && (
      <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
        <span>Your acceptance was not recorded. {error}</span>
      </div>
    )}
  </div>
);

const RecordedStep = ({ acceptance }: { acceptance: AcceptanceRecord }) => (
  <div className="flex h-full flex-col items-center justify-center text-center">
    <CheckCircleIcon className="h-16 w-16 text-[#EA8024]" />
    <h3 className="mt-4 text-xl font-semibold text-slate-900">You can now use ECL Automation</h3>
    <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
      Your acceptance was recorded on {formatDateTime(acceptance.accepted_at)} for platform version{" "}
      {acceptance.app_version}. You will be asked again when the platform is updated or these terms
      change.
    </p>
    <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-600">
      Remember: outputs are working calculations until they are reviewed and approved under the
      client's policies.
    </p>
  </div>
);

type Props = {
  appVersion: string;
  termsHash: string;
  onCancel: () => void;
  onFinish: () => void;
};

const TermsAcceptance = ({ appVersion, termsHash, onCancel, onFinish }: Props) => {
  const { token, username } = useAppSelector((state) => state.auth);
  const [step, setStep] = useState(0);
  const [termsRead, setTermsRead] = useState(false);
  const [assumptionsRead, setAssumptionsRead] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [assumptionsChecked, setAssumptionsChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptance, setAcceptance] = useState<AcceptanceRecord | null>(null);

  const markTermsRead = useCallback(() => setTermsRead(true), []);
  const markAssumptionsRead = useCallback(() => setAssumptionsRead(true), []);

  const handleConfirm = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const record = await acceptTerms(token, {
        app_version: appVersion,
        terms_version: TERMS_VERSION,
        terms_hash: termsHash,
      });
      setAcceptance(record);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const heading = HEADINGS[step];

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#EA8024] to-[#E0742A]"
        style={{ clipPath: "polygon(67% 0, 100% 0, 100% 100%, 41% 100%)" }}
      />

      <div className="relative z-10 flex h-[min(92vh,900px)] w-[min(94vw,1240px)] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Steps */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-slate-100 bg-slate-50 px-8 py-10">
          <img src="/SGVLogoLight.png" alt="SGV" className="w-24" />

          <ol className="mt-14">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              // after the acceptance is recorded the earlier steps are closed
              const canGoBack = done && !acceptance;
              return (
                <li key={s.title} className="relative pb-10 last:pb-0">
                  {i < STEPS.length - 1 && (
                    <span
                      className={clsx(
                        "absolute left-[17px] top-10 h-[calc(100%-2.75rem)] w-0.5",
                        done ? "bg-[#EA8024]/60" : "bg-slate-200"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!canGoBack}
                    onClick={() => setStep(i)}
                    className={clsx("flex items-start gap-4 text-left", canGoBack && "cursor-pointer")}
                  >
                    <span
                      className={clsx(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        done || active ? "bg-[#EA8024] text-white" : "bg-slate-200 text-slate-500",
                        active && "ring-4 ring-[#EA8024]/20"
                      )}
                    >
                      {done ? <CheckIcon className="h-5 w-5" /> : i + 1}
                    </span>
                    <span>
                      <span
                        className={clsx(
                          "block text-[15px] font-semibold",
                          active ? "text-slate-900" : done ? "text-slate-700" : "text-slate-500"
                        )}
                      >
                        {s.title}
                      </span>
                      <span className="mt-1 block text-sm text-slate-400">{s.subtitle}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-auto text-xs leading-relaxed text-slate-500">
            Signed in as <span className="font-semibold text-slate-700">{username}</span>
            {!acceptance && (
              <>
                {" · "}
                <button type="button" onClick={onCancel} className="font-semibold text-[#EA8024] hover:underline cursor-pointer">
                  Log out
                </button>
              </>
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="flex min-w-0 flex-1 flex-col px-12 py-10">
          <header className="flex items-start justify-between gap-6">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">ECL Automation</h1>
            <div className="shrink-0 text-right text-sm leading-relaxed text-slate-500">
              <p>Version {appVersion}</p>
              <p>Effective: {TERMS_EFFECTIVE_DATE}</p>
            </div>
          </header>
          <h2 className="mt-3 text-xl font-semibold text-slate-600">{heading.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">{heading.intro}</p>

          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            {step === 0 && (
              <ScrollPanel key="terms" onReachEnd={markTermsRead}>
                <TermsStep />
              </ScrollPanel>
            )}
            {step === 1 && (
              <ScrollPanel key="assumptions" onReachEnd={markAssumptionsRead}>
                <AssumptionsStep />
              </ScrollPanel>
            )}
            {step === 2 && (
              <ScrollPanel key="confirm">
                <ConfirmationStep
                  username={username}
                  appVersion={appVersion}
                  termsHash={termsHash}
                  error={error}
                />
              </ScrollPanel>
            )}
            {step === 3 && acceptance && <RecordedStep acceptance={acceptance} />}
          </div>

          <footer className="mt-6 border-t border-slate-100 pt-6">
            {step === 0 && (
              <Checkbox
                checked={termsChecked}
                disabled={!termsRead}
                onChange={setTermsChecked}
                hint="Scroll to the end of the terms to continue."
              >
                {TERMS_STATEMENT}
              </Checkbox>
            )}
            {step === 1 && (
              <Checkbox
                checked={assumptionsChecked}
                disabled={!assumptionsRead}
                onChange={setAssumptionsChecked}
                hint="Scroll to the end of the assumptions to continue."
              >
                {ASSUMPTIONS_STATEMENT}
              </Checkbox>
            )}

            <div className={clsx("flex justify-end gap-4", step < 2 && "mt-5")}>
              {step === 0 && (
                <>
                  <button type="button" onClick={onCancel} className={secondaryButton}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!termsChecked}
                    onClick={() => setStep(1)}
                    className={primaryButton}
                  >
                    Accept and Continue <ArrowRightIcon className="h-5 w-5" />
                  </button>
                </>
              )}
              {step === 1 && (
                <>
                  <button type="button" onClick={() => setStep(0)} className={secondaryButton}>
                    <ArrowLeftIcon className="h-5 w-5" /> Back
                  </button>
                  <button
                    type="button"
                    disabled={!assumptionsChecked}
                    onClick={() => setStep(2)}
                    className={primaryButton}
                  >
                    Continue <ArrowRightIcon className="h-5 w-5" />
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep(1)}
                    className={secondaryButton}
                  >
                    <ArrowLeftIcon className="h-5 w-5" /> Back
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirm}
                    className={primaryButton}
                  >
                    {submitting ? "Recording..." : "Confirm and Record"}
                    <CheckIcon className="h-5 w-5" />
                  </button>
                </>
              )}
              {step === 3 && (
                <button type="button" onClick={onFinish} className={primaryButton}>
                  Go to Application <ArrowRightIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default TermsAcceptance;
