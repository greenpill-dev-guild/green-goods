import type { GrantView } from "@green-goods/shared/modules/agent-reporting";
import {
  RiCalendarCloseLine,
  RiCalendarLine,
  RiCheckboxMultipleLine,
  RiCoinLine,
  RiGasStationLine,
  RiPlantLine,
  RiShieldCheckLine,
  RiStackLine,
  RiTimeLine,
} from "@remixicon/react";
import { type ReactNode, useId } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { formatEther } from "viem";
import { FormCard } from "@/components/Cards";
import { LineValue } from "./PublicationSummary";

/** The permission window's length in the largest unit that reads plainly. */
function formatDuration(intl: IntlShape, milliseconds: number) {
  const minutes = Math.max(0, milliseconds) / 60_000;
  const [value, unit]: [number, "minute" | "hour" | "day"] =
    minutes < 60
      ? [Math.round(minutes), "minute"]
      : minutes < 48 * 60
        ? [minutes / 60, "hour"]
        : [minutes / (24 * 60), "day"];
  return intl.formatNumber(value, {
    style: "unit",
    unit,
    unitDisplay: "long",
    maximumFractionDigits: 1,
  });
}

/**
 * One limit: its icon and label on the start side, its value on the end. When a translated label
 * and a date can't share a line on a narrow phone or at a larger text size, the value moves under
 * the label, still on the end side, instead of being squeezed. The public reporting pages keep
 * this compact row as they drew it before the app and cockpit unification: the shared fact row
 * lines values up in a column, which wraps a date at phone widths.
 */
function LimitRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2.5">
      <dt className="flex min-w-0 items-center gap-2 type-meta text-text-sub-600">
        <span
          className="flex shrink-0 text-text-soft-400 [&>svg]:h-4 [&>svg]:w-4"
          aria-hidden="true"
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd className="ms-auto flex min-w-0 items-center justify-end gap-1 text-right type-label-sm tracking-normal text-text-strong-950 [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

/**
 * The exact bounded permission, under its own heading and drawn with the app's own parts: what it
 * allows and the garden it writes to as the work review's detail cards, then every limit as a
 * labelled row, so each reads at a glance and none is hidden.
 */
export function GrantSummary({ grant }: { grant: GrantView }) {
  const intl = useIntl();
  const limitsId = useId();
  const { policy } = grant;
  const date = (value: number) =>
    intl.formatDate(value, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      timeZoneName: "short",
    });

  return (
    <>
      <h2 className="text-base font-semibold text-text-strong-950">
        {intl.formatMessage({ id: "public.reporting.grant.purpose", defaultMessage: "Permission" })}
      </h2>
      <FormCard
        label={intl.formatMessage({
          id: "public.reporting.grant.allows",
          defaultMessage: "Allows",
        })}
        value={
          <LineValue>
            {intl.formatMessage(
              grant.purpose === "reporting"
                ? {
                    id: "public.reporting.grant.reports",
                    defaultMessage: "Publish reports you confirm in chat",
                  }
                : {
                    id: "public.reporting.grant.reviews",
                    defaultMessage: "Record review decisions you confirm in chat",
                  }
            )}
          </LineValue>
        }
        Icon={RiShieldCheckLine}
      />
      <FormCard
        label={intl.formatMessage({
          id: "public.reporting.grant.garden",
          defaultMessage: "Garden account",
        })}
        value={
          <span className="flex min-w-0 flex-col gap-0.5 pe-4">
            {grant.gardenLabel ? (
              <span className="break-words text-text-strong-950">{grant.gardenLabel}</span>
            ) : null}
            <span className="font-mono text-xs [overflow-wrap:anywhere]">
              {policy.gardenAddress}
            </span>
          </span>
        }
        Icon={RiPlantLine}
      />
      <section
        aria-labelledby={limitsId}
        className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      >
        <h3 id={limitsId} className="text-sm font-semibold leading-5 text-text-strong-950">
          {intl.formatMessage({ id: "public.reporting.grant.limits", defaultMessage: "Limits" })}
        </h3>
        <dl className="mt-1 divide-y divide-stroke-soft-200 tabular-nums">
          <LimitRow
            icon={<RiCalendarLine />}
            label={intl.formatMessage({
              id: "public.reporting.grant.starts",
              defaultMessage: "Starts",
            })}
            value={date(policy.validAfter)}
          />
          <LimitRow
            icon={<RiCalendarCloseLine />}
            label={intl.formatMessage({
              id: "public.reporting.grant.expires",
              defaultMessage: "Expires",
            })}
            value={date(policy.validUntil)}
          />
          <LimitRow
            icon={<RiTimeLine />}
            label={intl.formatMessage({
              id: "public.reporting.grant.duration",
              defaultMessage: "Duration",
            })}
            value={formatDuration(intl, policy.validUntil - policy.validAfter)}
          />
          <LimitRow
            icon={<RiStackLine />}
            label={intl.formatMessage({
              id: "public.reporting.grant.maximum",
              defaultMessage: "Maximum publications",
            })}
            value={intl.formatNumber(policy.maxSubmissions)}
          />
          <LimitRow
            icon={<RiCheckboxMultipleLine />}
            label={intl.formatMessage({
              id: "public.reporting.grant.used",
              defaultMessage: "Already used",
            })}
            value={intl.formatNumber(grant.submissionsUsed)}
          />
          <LimitRow
            icon={<RiGasStationLine />}
            label={intl.formatMessage({
              id: "public.reporting.grant.gas",
              defaultMessage: "Total gas allowance",
            })}
            value={intl.formatMessage(
              { id: "public.reporting.grant.gasUnits", defaultMessage: "{count} gas units" },
              { count: intl.formatNumber(policy.gasCap) }
            )}
          />
          {policy.gasCostCapWei ? (
            <LimitRow
              icon={<RiCoinLine />}
              label={intl.formatMessage({
                id: "public.reporting.grant.cost",
                defaultMessage: "Maximum total sponsored cost",
              })}
              value={`${formatEther(BigInt(policy.gasCostCapWei))} ETH`}
            />
          ) : null}
        </dl>
      </section>
    </>
  );
}
