import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiAlertLine,
  RiArrowGoBackLine,
  RiCalendarCheckLine,
  RiCheckLine,
  RiCheckboxBlankCircleLine,
  RiCloseLine,
  RiCoupon3Line,
  RiFileList3Line,
  RiGiftLine,
  RiLockLine,
  RiStore2Line,
  RiTimeLine,
  RiUserFollowLine,
  RiWallet3Line,
} from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import type {
  ServiceBookingView,
  ServiceFact,
  ServicePhase,
  ServiceStepState,
  ServiceTransfer,
} from "./serviceBookingTypes";

const FACT_ICON: Record<ServiceFact["id"], ReactNode> = {
  get: <RiGiftLine />,
  takes: <RiWallet3Line />,
  by: <RiStore2Line />,
  held: <RiLockLine />,
  next: <RiUserFollowLine />,
  back: <RiArrowGoBackLine />,
  vouchers: <RiCoupon3Line />,
  deadline: <RiTimeLine />,
  reported: <RiCalendarCheckLine />,
};

const STEP_ICON: Record<ServiceStepState, ReactNode> = {
  done: <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" />,
  now: <RiTimeLine className="h-3.5 w-3.5" aria-hidden="true" />,
  warn: <RiAlertLine className="h-3.5 w-3.5" aria-hidden="true" />,
  fail: <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />,
  todo: <RiCheckboxBlankCircleLine className="h-3.5 w-3.5" aria-hidden="true" />,
};

const MARK_CLASS: Record<ServiceStepState, string> = {
  done: "border-transparent bg-success-lighter text-success-base",
  now: "border-information-base bg-information-lighter text-information-dark",
  warn: "border-warning-base bg-warning-lighter text-warning-dark",
  fail: "border-error-base bg-error-lighter text-error-base",
  todo: "border-stroke-soft-200 bg-bg-weak-50 text-text-sub-600",
};

const STEP_TEXT_CLASS: Record<ServiceStepState, string> = {
  done: "text-success-base",
  now: "text-information-dark",
  warn: "text-warning-dark",
  fail: "text-error-base",
  todo: "text-text-soft-400",
};

const TRANSFER_TONE: Record<ServiceTransfer["state"], "success" | "info" | "error"> = {
  succeeded: "success",
  pending: "info",
  failed: "error",
};

function Facts({ facts }: { facts: ServiceFact[] }) {
  return facts.map((fact) => (
    <FactRow
      key={fact.id}
      icon={FACT_ICON[fact.id]}
      label={fact.label}
      value={
        <>
          {fact.value}
          {fact.detail ? (
            <span className="mt-0.5 block text-xs font-normal leading-4 text-text-sub-600">
              {fact.detail}
            </span>
          ) : null}
        </>
      }
    />
  ));
}

/**
 * A member's booking on the promise page: the facts that matter now, as fact rows, and one closed
 * disclosure for the rest. Before a booking it introduces the offer (its note, what you get, what
 * it takes, who offers it) and keeps how booking works behind "How booking works"; once booked,
 * "Booking details" holds the steps by phase (V2), each transfer with its own pill (V4), the terms
 * and the records (D2). The section holds no acts: they sit in the page's one action bar.
 */
export function ServiceAccessSection({
  view,
  note = null,
}: {
  view: ServiceBookingView;
  /** The offer's own description, said once, before anyone books it. */
  note?: string | null;
}) {
  const { formatMessage, locale } = useIntl();
  const text = (id: string) => formatMessage({ id: `app.voucher.${id}` });
  const booked = view.setup !== null;
  return (
    // A word of ten letters or more hyphenates in the facts' narrow label column instead of
    // breaking anywhere ("Acceptance" at 360px); shorter words move to the next line.
    <section
      lang={locale}
      className="hyphens-auto [hyphenate-limit-chars:10_4_4] rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      aria-label={formatMessage({ id: "app.serviceAccess.title" })}
      data-component="ServiceAccessSection"
      data-stage={view.stage}
    >
      {!booked && note ? <p className="text-sm leading-relaxed text-text-sub-600">{note}</p> : null}
      <FactList frame="inset" className={!booked && note ? "mt-1" : undefined}>
        <Facts facts={view.facts} />
      </FactList>

      <details className="mt-3 text-xs text-text-sub-600" data-component="BookingDetails">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
          {text(booked ? "rd.details" : "rd.how")}
        </summary>
        <div className="space-y-4 pb-1">
          {view.howItWorks.length > 0 || view.termsVersion ? (
            <FactList frame="inset">
              <Facts facts={view.howItWorks} />
              {view.termsVersion ? (
                <FactRow
                  icon={<RiFileList3Line />}
                  label={text("c.terms")}
                  value={view.termsVersion}
                />
              ) : null}
            </FactList>
          ) : null}

          {view.phases.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold leading-5 text-text-strong-950">
                {text("rd.steps")}
              </h3>
              <ol className="mt-2" data-component="ServiceBookingSteps">
                {view.phases.map((phase) => (
                  <Phase key={phase.id} phase={phase} />
                ))}
              </ol>
            </div>
          ) : null}

          {view.transfers.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold leading-5 text-text-strong-950">
                {text("rd.legs")}
              </h3>
              <FactList frame="inset" className="mt-1" data-component="ServiceTransfers">
                {view.transfers.map((transfer) => (
                  <FactRow
                    key={transfer.id}
                    label={transfer.label}
                    description={transfer.detail}
                    value={
                      <StatusBadge
                        size="xs"
                        variant={TRANSFER_TONE[transfer.state]}
                        showIcon={false}
                      >
                        {transfer.stateLabel}
                      </StatusBadge>
                    }
                  />
                ))}
              </FactList>
            </div>
          ) : null}

          {view.details.length > 0 ? (
            <div data-component="ServiceDetails">
              <h3 className="text-sm font-semibold leading-5 text-text-strong-950">
                {text("c.tech")}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {view.details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {view.messageLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      className="underline underline-offset-2"
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function Phase({ phase }: { phase: ServicePhase }) {
  return (
    <li
      className="group relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 pb-3 last:pb-0"
      data-state={phase.state}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-0 start-[0.8125rem] top-8 w-0.5 bg-stroke-soft-200 group-last:hidden"
      />
      <span
        className={cn(
          "relative z-[1] grid h-7 w-7 place-items-center rounded-full border",
          MARK_CLASS[phase.state]
        )}
      >
        {STEP_ICON[phase.state]}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold leading-5 text-text-strong-950">{phase.title}</p>
        <p className="text-xs leading-4 text-text-sub-600">{phase.who}</p>
        <ul className="mt-1.5 space-y-1">
          {phase.steps.map((step) => (
            <li
              key={step.id}
              className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1.5 text-xs leading-4 text-text-strong-950"
              data-state={step.state}
            >
              <span className={STEP_TEXT_CLASS[step.state]}>{STEP_ICON[step.state]}</span>
              <span className="min-w-0">{step.text}</span>
              <span className="whitespace-nowrap text-[11px] font-semibold text-text-sub-600">
                {step.stateLabel}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
