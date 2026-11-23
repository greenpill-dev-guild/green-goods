import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { CommitmentDialogController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useActionsByUID } from "@green-goods/shared/hooks/action/useAction";
import { findActionByUID } from "@green-goods/shared/utils/action/parsers";
import type { ReactNode } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { localizeActionForDisplay } from "@/components/Action/actionDisplay";
import { exactTime, isoTime } from "../poolTime";
import { railLabel } from "./commitmentDialogPresentation";

/** One label/value line of the record's facts. */
function fact(label: string, value: ReactNode) {
  return <FactRow key={label} label={label} value={value} />;
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
  const intl = useIntl();
  const { formatMessage } = intl;
  const rail = railLabel(commitment.considerationRail, formatMessage);
  const targets = detail?.requirements ?? [];
  const actions = useActionsByUID(
    targets.map((target) => Number(target.actionUID)),
    commitment.chainId
  );
  // Work sent toward a target: linked works, any decision. Reviewed is the approved count.
  const reported = (index: number) =>
    (detail?.workAttributions ?? []).filter((row) => row.linked && row.requirementIndex === index)
      .length;

  return (
    <section
      aria-label={formatMessage({
        id: "hub.garden.pool.commitment.facts",
        defaultMessage: "Facts",
      })}
    >
      <FactList frame="inset">
        {/* An exact deadline: its date, time and zone (PRD-1025 D3). */}
        {commitment.dueDate
          ? fact(
              formatMessage({
                id: "hub.garden.pool.commitment.fact.due",
                defaultMessage: "Due",
              }),
              <time dateTime={isoTime(Number(commitment.dueDate) * 1000)}>
                {exactTime(intl, Number(commitment.dueDate) * 1000)}
              </time>
            )
          : null}
        {fact(
          formatMessage({
            id: "hub.garden.pool.commitment.fact.kind",
            defaultMessage: "Kind",
          }),
          commitment.commitmentType === "DOMAIN_IMPACT"
            ? formatMessage({
                id: "hub.garden.pool.seed.kind.gardenWork",
                defaultMessage: "Garden work",
              })
            : commitment.commitmentType === "SEASON_CAMPAIGN"
              ? formatMessage({
                  id: "hub.garden.pool.seed.kind.seasonCampaign",
                  defaultMessage: "Season / campaign promise",
                })
              : commitment.commitmentType === "STEWARD_CAPTURED"
                ? formatMessage({
                    id: "hub.garden.pool.commitment.fact.captured",
                    defaultMessage: "Recorded for a member",
                  })
                : formatMessage({
                    id: "hub.garden.pool.seed.kind.service",
                    defaultMessage: "Support / service",
                  })
        )}
        {fact(
          formatMessage({
            id: "hub.garden.pool.commitment.fact.proof",
            defaultMessage: "Proof",
          }),
          formatMessage(
            {
              id: "hub.garden.pool.commitment.fact.proofCount",
              defaultMessage: "{count, plural, =0 {none yet} one {# item} other {# items}}",
            },
            { count: commitment.evidenceCount }
          )
        )}
        {/* Each target in its own action's count, never summed across actions (PRD-1538). */}
        {targets.map((target) => {
          const action = findActionByUID(actions, Number(target.actionUID));
          return (
            <FactRow
              key={`target-${target.requirementIndex}`}
              label={
                action
                  ? localizeActionForDisplay(action, intl).title
                  : formatMessage(
                      { id: "hub.garden.pool.commitment.target.action" },
                      { uid: target.actionUID.toString() }
                    )
              }
              value={formatMessage(
                { id: "hub.garden.pool.commitment.target.progress" },
                {
                  reviewed: target.approvedCount,
                  reported: reported(target.requirementIndex),
                  target: target.requiredCount,
                }
              )}
            />
          );
        })}
        {fact(
          formatMessage({
            id: "hub.garden.pool.commitment.fact.provider",
            defaultMessage: "Provider",
          }),
          commitment.leadProvider ? (
            <span className="inline-flex max-w-full items-center gap-1">
              <FormattedMessage
                id="hub.garden.pool.commitment.fact.providerCannotConfirm"
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
              id: "hub.garden.pool.commitment.fact.providerNone",
              defaultMessage: "Nobody yet",
            })
          )
        )}
        {fact(
          formatMessage({
            id: "hub.garden.pool.seed.confirmers",
            defaultMessage: "Confirmers",
          }),
          commitment.confirmers.length === 0
            ? formatMessage({
                id: "hub.garden.pool.seed.review.ordinary",
                defaultMessage: "Ordinary rule",
              })
            : formatMessage(
                {
                  id: "hub.garden.pool.seed.review.named",
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
            id: "hub.garden.pool.seed.review.fallback",
            defaultMessage: "Green Goods team fallback",
          }),
          commitment.protocolFallbackEnabled
            ? formatMessage({
                id: "hub.garden.pool.seed.review.fallbackOn",
                defaultMessage: "On · reason required if used",
              })
            : formatMessage({
                id: "hub.garden.pool.seed.review.fallbackOff",
                defaultMessage: "Off",
              })
        )}
        {commitment.readyOverridden
          ? fact(
              formatMessage({
                id: "hub.garden.pool.commitment.fact.override",
                defaultMessage: "Ready by",
              }),
              formatMessage({
                id: "hub.garden.pool.commitment.fact.overrideValue",
                defaultMessage: "Steward override, reason recorded",
              })
            )
          : null}
        {fact(
          formatMessage({ id: "hub.garden.pool.seed.rail", defaultMessage: "Reward rail" }),
          rail
        )}
        {commitment.onchainState === "FULFILLED" && commitment.confirmationPath
          ? fact(
              formatMessage({
                id: "hub.garden.pool.commitment.fact.confirmedBy",
                defaultMessage: "Confirmed by",
              }),
              commitment.confirmationPath === "POOL_FALLBACK" ? (
                formatMessage({
                  id: "hub.garden.pool.commitment.path.garden",
                  defaultMessage: "your garden steward (fallback)",
                })
              ) : commitment.confirmationPath === "PROTOCOL_FALLBACK" ? (
                formatMessage({
                  id: "hub.garden.pool.commitment.path.protocol",
                  defaultMessage: "Green Goods team (fallback)",
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
                      id: "hub.garden.pool.commitment.path.ordinary",
                      defaultMessage: "ordinary",
                    })}
                  </span>
                </span>
              ) : (
                formatMessage({
                  id: "hub.garden.pool.commitment.path.ordinary",
                  defaultMessage: "ordinary",
                })
              )
            )
          : null}
        {commitment.fallbackReason
          ? fact(
              formatMessage({
                id: "hub.garden.pool.commitment.fact.fallbackReason",
                defaultMessage: "Fallback reason",
              }),
              commitment.fallbackReason
            )
          : null}
      </FactList>
    </section>
  );
}
