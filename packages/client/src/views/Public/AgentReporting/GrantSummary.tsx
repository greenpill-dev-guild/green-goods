import type { GrantView } from "@green-goods/shared/modules/agent-reporting";
import { useIntl } from "react-intl";
import { formatEther } from "viem";

/** The exact bounded permission, with its target and limits beside the owner action. */
export function GrantSummary({ grant }: { grant: GrantView }) {
  const intl = useIntl();
  const dateOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  } as const;
  const lines = [
    {
      label: intl.formatMessage({
        id: "public.reporting.grant.purpose",
        defaultMessage: "Permission",
      }),
      value: intl.formatMessage(
        grant.purpose === "reporting"
          ? {
              id: "public.reporting.grant.reports",
              defaultMessage: "Publish reports you confirm in chat",
            }
          : {
              id: "public.reporting.grant.reviews",
              defaultMessage: "Record review decisions you confirm in chat",
            }
      ),
    },
    {
      label: intl.formatMessage({
        id: "public.reporting.grant.garden",
        defaultMessage: "Garden account",
      }),
      value: grant.policy.gardenAddress,
    },
    {
      label: intl.formatMessage({ id: "public.reporting.grant.starts", defaultMessage: "Starts" }),
      value: intl.formatDate(grant.policy.validAfter, dateOptions),
    },
    {
      label: intl.formatMessage({
        id: "public.reporting.grant.expires",
        defaultMessage: "Expires",
      }),
      value: intl.formatDate(grant.policy.validUntil, dateOptions),
    },
    {
      label: intl.formatMessage({
        id: "public.reporting.grant.maximum",
        defaultMessage: "Maximum publications",
      }),
      value: intl.formatNumber(grant.policy.maxSubmissions),
    },
    {
      label: intl.formatMessage({
        id: "public.reporting.grant.used",
        defaultMessage: "Already used",
      }),
      value: intl.formatNumber(grant.submissionsUsed),
    },
    {
      label: intl.formatMessage({
        id: "public.reporting.grant.gas",
        defaultMessage: "Total gas allowance",
      }),
      value: intl.formatMessage(
        { id: "public.reporting.grant.gasUnits", defaultMessage: "{count} gas units" },
        { count: intl.formatNumber(grant.policy.gasCap) }
      ),
    },
    ...(grant.policy.gasCostCapWei
      ? [
          {
            label: intl.formatMessage({
              id: "public.reporting.grant.cost",
              defaultMessage: "Maximum total sponsored cost",
            }),
            value: `${formatEther(BigInt(grant.policy.gasCostCapWei))} ETH`,
          },
        ]
      : []),
  ];
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-stroke-soft-200 bg-bg-weak-50">
      {grant.gardenLabel ? (
        <p className="border-b border-stroke-soft-200 p-4 text-base font-semibold text-text-strong-950">
          {grant.gardenLabel}
        </p>
      ) : null}
      <dl className="min-w-0 divide-y divide-stroke-soft-200">
        {lines.map((line) => (
          <div
            key={line.label}
            className="grid min-w-0 gap-1 p-4 @[480px]:grid-cols-[9rem_minmax(0,1fr)] @[480px]:gap-4"
          >
            <dt className="text-sm text-text-sub-600">{line.label}</dt>
            <dd className="min-w-0 text-sm leading-6 text-text-strong-950 [overflow-wrap:anywhere]">
              {line.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
