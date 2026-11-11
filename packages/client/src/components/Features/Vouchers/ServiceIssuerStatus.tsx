import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine, RiCheckboxBlankCircleLine, RiTimeLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

const BAND_TONE = {
  neutral: "border-stroke-soft-200 bg-bg-weak-50",
  waiting: "border-stroke-soft-200 bg-bg-weak-50",
  attention: "border-warning-light bg-warning-lighter",
  kept: "border-success-light bg-success-lighter",
} as const;

export interface IssuerBand {
  tone: keyof typeof BAND_TONE;
  pill: { label: string; variant: "success" | "warning" | "info" | "neutral" };
  needsYou?: boolean;
  title: ReactNode;
  body: ReactNode;
  /** Who prepared it, under the message: a steward's help, never their authority. */
  from?: string;
}

/**
 * The section's one status message, drawn as the promise page draws its band: the pill, a
 * "Needs you" mark when the member acts next, then what happens next and why.
 */
export function ServiceIssuerBand({ band }: { band: IssuerBand }) {
  const { formatMessage } = useIntl();
  return (
    <section
      className={cn("rounded-[var(--radius-lg)] border p-4", BAND_TONE[band.tone])}
      data-component="ServiceIssuerBand"
      data-tone={band.tone}
      aria-label={formatMessage({ id: "app.commitment.status.label" })}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge size="sm" variant={band.pill.variant} showIcon={false}>
          {band.pill.label}
        </StatusBadge>
        {band.needsYou ? (
          <span className="text-xs font-medium text-warning-dark">
            {formatMessage({ id: "app.commitments.row.needsYou" })}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-semibold leading-5 text-text-strong-950">{band.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-text-strong-950">{band.body}</p>
      {band.from ? <p className="mt-2 text-xs text-text-sub-600">{band.from}</p> : null}
    </section>
  );
}

export type IssuerStepState = "done" | "now" | "todo";
export interface IssuerPhase {
  id: string;
  title: string;
  who: string;
  steps: readonly { id: string; text: string; state: IssuerStepState }[];
}

const MARK: Record<IssuerStepState, { icon: ReactNode; className: string; text: string }> = {
  done: {
    icon: <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" />,
    className: "border-transparent bg-success-lighter text-success-base",
    text: "text-success-base",
  },
  now: {
    icon: <RiTimeLine className="h-3.5 w-3.5" aria-hidden="true" />,
    className: "border-information-base bg-information-lighter text-information-dark",
    text: "text-information-dark",
  },
  todo: {
    icon: <RiCheckboxBlankCircleLine className="h-3.5 w-3.5" aria-hidden="true" />,
    className: "border-stroke-soft-200 bg-bg-weak-50 text-text-sub-600",
    text: "text-text-soft-400",
  },
};

const phaseState = (phase: IssuerPhase): IssuerStepState =>
  phase.steps.every((step) => step.state === "done")
    ? "done"
    : phase.steps.some((step) => step.state !== "todo")
      ? "now"
      : "todo";

/** The setup's steps as phases, each naming who acts (V2), with each step's own state. */
export function ServiceIssuerSteps({ title, phases }: { title: string; phases: IssuerPhase[] }) {
  const { formatMessage } = useIntl();
  return (
    <div>
      <h3 className="text-sm font-semibold leading-5 text-text-strong-950">{title}</h3>
      <ol className="mt-2" data-component="ServiceIssuerSteps">
        {phases.map((phase) => {
          const state = phaseState(phase);
          return (
            <li
              key={phase.id}
              className="group relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 pb-3 last:pb-0"
              data-state={state}
            >
              <span
                aria-hidden="true"
                className="absolute bottom-0 start-[0.8125rem] top-8 w-0.5 bg-stroke-soft-200 group-last:hidden"
              />
              <span
                className={cn(
                  "relative z-[1] grid h-7 w-7 place-items-center rounded-full border",
                  MARK[state].className
                )}
              >
                {MARK[state].icon}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold leading-5 text-text-strong-950">
                  {phase.title}
                </p>
                <p className="text-xs leading-4 text-text-sub-600">{phase.who}</p>
                <ul className="mt-1.5 space-y-1">
                  {phase.steps.map((step) => (
                    <li
                      key={step.id}
                      className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1.5 text-xs leading-4 text-text-strong-950"
                      data-state={step.state}
                    >
                      <span className={MARK[step.state].text}>{MARK[step.state].icon}</span>
                      <span className="min-w-0">{step.text}</span>
                      <span className="whitespace-nowrap text-[11px] font-semibold text-text-sub-600">
                        {formatMessage({ id: `app.voucher.pu.s.${step.state}` })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
