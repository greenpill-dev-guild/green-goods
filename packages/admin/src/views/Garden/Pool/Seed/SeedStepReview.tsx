import { type Action, Alert } from "@green-goods/shared";
import { type CommitmentComposerValues } from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";
import { actionUIDOf, type SeedCycleOption } from "./seedStepModel";

export interface SeedStepReviewProps {
  values: CommitmentComposerValues;
  /** The garden's registered actions, for naming garden-work requirements. */
  actions: Action[];
  chainId: number;
  cycleOptions: SeedCycleOption[];
  /** Without a registered protocol pool the Green Goods team fallback reads off. */
  protocolRegistered: boolean;
  submitError: string | null;
  /** The device queue could not be read; seeding will still try. */
  queueUnavailable: boolean;
}

/**
 * Step four of the seeding console: the sectioned check a steward reads before
 * the creation is queued, in the same order the steps asked for it.
 */
export function SeedStepReview({
  values,
  actions,
  chainId,
  cycleOptions,
  protocolRegistered,
  submitError,
  queueUnavailable,
}: SeedStepReviewProps) {
  const { formatMessage } = useIntl();
  const cycleLabel = cycleOptions.find((option) => option.value === values.cycleId)?.label ?? "—";
  const section = (heading: string, rows: Array<[string, string]>) => (
    <div className="space-y-1.5">
      <p className="label-xs text-text-soft">{heading}</p>
      <dl className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 text-body-md">
            <dt className="text-text-soft">{label}</dt>
            <dd className="truncate text-right text-text-strong" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
  const kindLabel =
    values.kind === "GARDEN_WORK"
      ? formatMessage({
          id: "cockpit.garden.pool.seed.kind.gardenWork",
          defaultMessage: "Garden work (impact)",
        })
      : values.kind === "SERVICE"
        ? formatMessage({
            id: "cockpit.garden.pool.seed.kind.service",
            defaultMessage: "Support / service",
          })
        : formatMessage({
            id: "cockpit.garden.pool.seed.kind.seasonCampaign",
            defaultMessage: "Season / campaign commitment",
          });

  return (
    <div className="space-y-4" data-testid="seed-review">
      {section(
        formatMessage({ id: "cockpit.garden.pool.seed.step.what", defaultMessage: "What" }),
        [
          [
            formatMessage({ id: "cockpit.garden.pool.seed.kind", defaultMessage: "Type" }),
            `${kindLabel} · ${
              values.direction === "REQUEST"
                ? formatMessage({
                    id: "cockpit.garden.pool.seed.direction.request",
                    defaultMessage: "The pool requests",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.seed.direction.offer",
                    defaultMessage: "The pool offers",
                  })
            }`,
          ],
          [
            formatMessage({
              id: "cockpit.garden.pool.seed.titleField",
              defaultMessage: "Title",
            }),
            values.title,
          ],
          [
            formatMessage({ id: "cockpit.garden.pool.seed.cycle", defaultMessage: "Cycle" }),
            cycleLabel,
          ],
        ]
      )}
      {section(
        formatMessage({
          id: "cockpit.garden.pool.seed.step.howMuch",
          defaultMessage: "How much",
        }),
        [
          [
            formatMessage({
              id: "cockpit.garden.pool.seed.unitTarget",
              defaultMessage: "Unit · target",
            }),
            `${values.unitLabel} · ${values.targetUnits}`,
          ],
          [
            formatMessage({
              id: "cockpit.garden.pool.seed.dueInDays",
              defaultMessage: "Due in (days)",
            }),
            String(values.dueInDays),
          ],
          [
            formatMessage({
              id: "cockpit.garden.pool.seed.contributorPolicy",
              defaultMessage: "Contributor policy",
            }),
            values.openTeam
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.team.open",
                  defaultMessage: "Open team",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.seed.team.lead",
                  defaultMessage: "Lead-managed team",
                }),
          ],
          ...(values.kind === "GARDEN_WORK"
            ? [
                [
                  formatMessage({
                    id: "cockpit.garden.pool.seed.requirements",
                    defaultMessage: "Actions this needs",
                  }),
                  values.requirements
                    .map((row) => {
                      const action = actions.find(
                        (entry) => actionUIDOf(entry.id, chainId) === row.actionUID
                      );
                      return `${action?.title ?? `#${row.actionUID}`} × ${row.requiredCount}`;
                    })
                    .join(" · "),
                ] as [string, string],
              ]
            : []),
        ]
      )}
      {section(
        formatMessage({
          id: "cockpit.garden.pool.seed.step.proof",
          defaultMessage: "Proof & confirmation",
        }),
        [
          [
            formatMessage({
              id: "cockpit.garden.pool.seed.confirmers",
              defaultMessage: "Confirmers",
            }),
            values.confirmers.length === 0
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.review.ordinary",
                  defaultMessage: "Ordinary rule",
                })
              : formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.review.named",
                    defaultMessage: "Named group · {threshold} of {count}",
                  },
                  { threshold: values.confirmationThreshold, count: values.confirmers.length }
                ),
          ],
          [
            formatMessage({
              id: "cockpit.garden.pool.seed.review.fallback",
              defaultMessage: "Green Goods team fallback",
            }),
            protocolRegistered && values.protocolFallbackEnabled
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.review.fallbackOn",
                  defaultMessage: "On · reason required if used",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.seed.review.fallbackOff",
                  defaultMessage: "Off",
                }),
          ],
          [
            formatMessage({
              id: "cockpit.garden.pool.seed.claimMode",
              defaultMessage: "Claim mode",
            }),
            values.claimMode === "APPROVAL_GATED"
              ? formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.gated",
                  defaultMessage: "Steward-reviewed",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode.open",
                  defaultMessage: "Open",
                }),
          ],
        ]
      )}
      {section(
        formatMessage({
          id: "cockpit.garden.pool.seed.reward",
          defaultMessage: "Advanced: declared reward",
        }),
        [
          [
            formatMessage({
              id: "cockpit.garden.pool.seed.rail",
              defaultMessage: "Reward rail",
            }),
            values.considerationRail === "ARBITRUM_EXTERNAL"
              ? `${formatMessage({ id: "cockpit.garden.pool.seed.rail.external", defaultMessage: "External payout record" })} · ${values.considerationAmount}`
              : values.considerationRail === "CELO_SETTLEMENT"
                ? `${formatMessage({ id: "cockpit.garden.pool.seed.rail.celo", defaultMessage: "Celo G$ settlement" })} · ${values.considerationAmount}`
                : formatMessage({
                    id: "cockpit.garden.pool.seed.rail.none",
                    defaultMessage: "None",
                  }),
          ],
        ]
      )}
      {submitError ? <Alert variant="error">{submitError}</Alert> : null}
      {queueUnavailable ? (
        <Alert variant="warning">
          {formatMessage({
            id: "cockpit.garden.pool.seed.queueUnavailable",
            defaultMessage: "The queue on this device could not be read; seeding will still try.",
          })}
        </Alert>
      ) : null}
      <p className="text-xs text-text-soft">
        {formatMessage({
          id: "cockpit.garden.pool.seed.queueNote",
          defaultMessage:
            "Seeding queues the creation on this device and sends it when it can; the row shows on the pool tab right away.",
        })}
      </p>
    </div>
  );
}
