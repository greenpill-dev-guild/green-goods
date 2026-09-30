import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { railLabel } from "./commitmentDialogPresentation";

/** One label/value line of the record's facts. */
function fact(label: string, value: ReactNode) {
  return (
    <div key={label} className="flex justify-between gap-3 text-body-md">
      <dt className="shrink-0 text-text-soft">{label}</dt>
      <dd
        className="truncate text-right text-text-strong"
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The record's checkable facts: what was promised, what proof stands behind
 * it, who may confirm it, and — once kept — who did and on what authority.
 */
export function CommitmentFacts({
  commitment,
  detail,
}: {
  commitment: CommitmentReadModel;
  detail: CommitmentDialogController["detail"];
}) {
  const { formatMessage } = useIntl();
  const rail = railLabel(commitment.considerationRail, formatMessage);

  return (
    <section
      aria-label={formatMessage({
        id: "cockpit.garden.pool.commitment.facts",
        defaultMessage: "Facts",
      })}
    >
      <dl className="space-y-1">
        {fact(
          formatMessage({
            id: "cockpit.garden.pool.commitment.fact.kind",
            defaultMessage: "Kind",
          }),
          commitment.commitmentType === "DOMAIN_IMPACT"
            ? formatMessage({
                id: "cockpit.garden.pool.seed.kind.gardenWork",
                defaultMessage: "Garden work (impact)",
              })
            : commitment.commitmentType === "SEASON_CAMPAIGN"
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.kind.seasonCampaign",
                  defaultMessage: "Season / campaign commitment",
                })
              : commitment.commitmentType === "STEWARD_CAPTURED"
                ? formatMessage({
                    id: "cockpit.garden.pool.commitment.fact.captured",
                    defaultMessage: "Recorded for a member",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.seed.kind.service",
                    defaultMessage: "Support / service",
                  })
        )}
        {fact(
          formatMessage({
            id: "cockpit.garden.pool.commitment.fact.proof",
            defaultMessage: "Proof",
          }),
          formatMessage(
            {
              id: "cockpit.garden.pool.commitment.fact.proofCount",
              defaultMessage: "{count, plural, =0 {none yet} one {# item} other {# items}}",
            },
            { count: commitment.evidenceCount }
          )
        )}
        {(detail?.requirements.length ?? 0) > 0
          ? fact(
              formatMessage({
                id: "cockpit.garden.pool.commitment.fact.work",
                defaultMessage: "Work",
              }),
              detail!.requirements
                .map((row) => `${row.approvedCount}/${row.requiredCount}`)
                .join(" · ")
            )
          : null}
        {fact(
          formatMessage({
            id: "cockpit.garden.pool.commitment.fact.provider",
            defaultMessage: "Provider",
          }),
          commitment.leadProvider ? (
            <span className="inline-flex max-w-full items-center gap-1">
              <FormattedMessage
                id="cockpit.garden.pool.commitment.fact.providerCannotConfirm"
                defaultMessage="{who}, cannot confirm"
                values={{
                  who: (
                    <AddressDisplay
                      address={commitment.leadProvider}
                      showCopyButton={false}
                      interactive={false}
                      className="inline-flex"
                    />
                  ),
                }}
              />
            </span>
          ) : (
            formatMessage({
              id: "cockpit.garden.pool.commitment.fact.providerNone",
              defaultMessage: "Nobody yet",
            })
          )
        )}
        {fact(
          formatMessage({
            id: "cockpit.garden.pool.seed.confirmers",
            defaultMessage: "Confirmers",
          }),
          commitment.confirmers.length === 0
            ? formatMessage({
                id: "cockpit.garden.pool.seed.review.ordinary",
                defaultMessage: "Ordinary rule",
              })
            : formatMessage(
                {
                  id: "cockpit.garden.pool.seed.review.named",
                  defaultMessage: "Named group · {threshold} of {count}",
                },
                {
                  threshold: commitment.confirmationThreshold ?? 1,
                  count: commitment.confirmers.length,
                }
              )
        )}
        {fact(
          formatMessage({
            id: "cockpit.garden.pool.seed.review.fallback",
            defaultMessage: "Green Goods team fallback",
          }),
          commitment.protocolFallbackEnabled
            ? formatMessage({
                id: "cockpit.garden.pool.seed.review.fallbackOn",
                defaultMessage: "On · reason required if used",
              })
            : formatMessage({
                id: "cockpit.garden.pool.seed.review.fallbackOff",
                defaultMessage: "Off",
              })
        )}
        {commitment.readyOverridden
          ? fact(
              formatMessage({
                id: "cockpit.garden.pool.commitment.fact.override",
                defaultMessage: "Ready by",
              }),
              formatMessage({
                id: "cockpit.garden.pool.commitment.fact.overrideValue",
                defaultMessage: "Steward override, reason recorded",
              })
            )
          : null}
        {fact(
          formatMessage({ id: "cockpit.garden.pool.seed.rail", defaultMessage: "Reward rail" }),
          rail
        )}
        {commitment.onchainState === "FULFILLED" && commitment.confirmationPath
          ? fact(
              formatMessage({
                id: "cockpit.garden.pool.commitment.fact.confirmedBy",
                defaultMessage: "Confirmed by",
              }),
              commitment.confirmationPath === "POOL_FALLBACK" ? (
                formatMessage({
                  id: "cockpit.garden.pool.commitment.path.garden",
                  defaultMessage: "your garden steward — fallback",
                })
              ) : commitment.confirmationPath === "PROTOCOL_FALLBACK" ? (
                formatMessage({
                  id: "cockpit.garden.pool.commitment.path.protocol",
                  defaultMessage: "Green Goods team — fallback",
                })
              ) : commitment.fulfilledBy ? (
                <span className="inline-flex max-w-full items-center gap-1">
                  <AddressDisplay
                    address={commitment.fulfilledBy}
                    showCopyButton={false}
                    interactive={false}
                    className="inline-flex"
                  />
                  <span>
                    ·{" "}
                    {formatMessage({
                      id: "cockpit.garden.pool.commitment.path.ordinary",
                      defaultMessage: "ordinary",
                    })}
                  </span>
                </span>
              ) : (
                formatMessage({
                  id: "cockpit.garden.pool.commitment.path.ordinary",
                  defaultMessage: "ordinary",
                })
              )
            )
          : null}
        {commitment.fallbackReason
          ? fact(
              formatMessage({
                id: "cockpit.garden.pool.commitment.fact.fallbackReason",
                defaultMessage: "Fallback reason",
              }),
              commitment.fallbackReason
            )
          : null}
      </dl>
    </section>
  );
}
