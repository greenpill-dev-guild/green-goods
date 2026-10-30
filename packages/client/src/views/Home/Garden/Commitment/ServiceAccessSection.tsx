import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiAlertLine,
  RiArrowGoBackLine,
  RiCheckLine,
  RiCheckboxBlankCircleLine,
  RiCloseLine,
  RiCoupon3Line,
  RiFileList3Line,
  RiGiftLine,
  RiLockLine,
  RiTimeLine,
  RiUserFollowLine,
  RiWallet3Line,
} from "@remixicon/react";
import { type ReactNode, useId } from "react";
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
  give: <RiWallet3Line />,
  held: <RiLockLine />,
  next: <RiUserFollowLine />,
  back: <RiArrowGoBackLine />,
  vouchers: <RiCoupon3Line />,
  deadline: <RiTimeLine />,
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

/**
 * Service Access on the promise page: a section card like the page's others. Its facts are fact
 * rows; the booking's steps are phases that name who acts (V2); each transfer is its own row with
 * its own pill (V4); chains, Safes and record numbers stay under Transaction details (D2). The
 * section holds no acts: they sit in the page's one action bar.
 */
export function ServiceAccessSection({ view }: { view: ServiceBookingView }) {
  const { formatMessage, locale } = useIntl();
  const headingId = useId();
  const text = (id: string) => formatMessage({ id: `app.voucher.${id}` });
  return (
    // A word of ten letters or more hyphenates in the facts' narrow label column instead of
    // breaking anywhere ("Acceptance" at 360px); shorter words move to the next line.
    <section
      lang={locale}
      className="hyphens-auto [hyphenate-limit-chars:10_4_4] rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      aria-labelledby={headingId}
      data-component="ServiceAccessSection"
      data-stage={view.stage}
    >
      <h2 id={headingId} className="text-sm font-semibold leading-5 text-text-strong-950">
        {formatMessage({ id: "app.serviceAccess.title" })}
      </h2>
      <FactList frame="inset" className="mt-1">
        {view.facts.map((fact) => (
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
        ))}
        {view.termsVersion ? (
          <FactRow icon={<RiFileList3Line />} label={text("c.terms")} value={view.termsVersion} />
        ) : null}
      </FactList>

      {view.phases.length > 0 ? (
        <>
          <h3 className="mt-4 text-sm font-semibold leading-5 text-text-strong-950">
            {text("rd.steps")}
          </h3>
          <ol className="mt-2" data-component="ServiceBookingSteps">
            {view.phases.map((phase) => (
              <Phase key={phase.id} phase={phase} />
            ))}
          </ol>
        </>
      ) : null}

      {view.transfers.length > 0 ? (
        <>
          <h3 className="mt-4 text-sm font-semibold leading-5 text-text-strong-950">
            {text("rd.legs")}
          </h3>
          <FactList frame="inset" className="mt-1" data-component="ServiceTransfers">
            {view.transfers.map((transfer) => (
              <FactRow
                key={transfer.id}
                label={transfer.label}
                description={transfer.detail}
                value={
                  <StatusBadge size="xs" variant={TRANSFER_TONE[transfer.state]} showIcon={false}>
                    {transfer.stateLabel}
                  </StatusBadge>
                }
              />
            ))}
          </FactList>
        </>
      ) : null}

      {view.details.length > 0 ? (
        <details className="mt-3 text-xs text-text-sub-600" data-component="ServiceDetails">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            {text("c.tech")}
          </summary>
          <ul className="space-y-1.5 pb-1">
            {view.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
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
