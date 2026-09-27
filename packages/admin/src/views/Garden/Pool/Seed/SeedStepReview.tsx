import { Alert } from "@green-goods/shared/components/Alert";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type {
  SeedTrayLastSend,
  SeedTrayRow,
} from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { Action } from "@green-goods/shared/types/domain";
import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { formatRewardAmount, type RewardUnits } from "./seedRewardAmount";
import { SeedTrayList } from "./SeedTrayList";
import { actionUIDOf, type SeedCycleOption } from "./seedStepModel";

/** The seeding tray as the review step shows it. */
export interface SeedReviewTray {
  /** The commitments added so far, beside the one under review. */
  others: readonly SeedTrayRow[];
  /** The one under review was sent before and nothing was created for it. */
  currentNotSent: boolean;
  /** What the last send left behind, until the tray changes. */
  lastSend: SeedTrayLastSend | null;
  /** The pool's commitment limit per person, where it is known. */
  cap: number | null;
  /** How many more open commitments the steward may hold; null while unread. */
  room: number | null;
  /** One more offer would not fit that room. */
  full: boolean;
  /** The offers already here do not fit it. */
  over: boolean;
  /** A send is under way: nothing in the tray may change. */
  busy: boolean;
  onEdit: (clientCommitmentId: string) => void;
  onRemove: (clientCommitmentId: string) => void;
  onRemoveCurrent: () => void;
}

export interface SeedStepReviewProps {
  values: CommitmentComposerValues;
  tray: SeedReviewTray;
  /** The garden's registered actions, for naming garden-work requirements. */
  actions: Action[];
  chainId: number;
  cycleOptions: SeedCycleOption[];
  /** Without a registered protocol pool the Green Goods team fallback reads off. */
  protocolRegistered: boolean;
  /** The units the declared reward is read in. */
  rewardUnits: RewardUnits;
  submitError: string | null;
  /** The device queue could not be read; seeding will still try. */
  queueUnavailable: boolean;
}

/**
 * Step four of the seeding console: the sectioned check a steward reads before
 * the creation is queued, in the same order the steps asked for it. When more
 * than one commitment is being seeded in a sitting, the ones added so far are
 * listed above the one under review, and every one of them is sent together.
 */
export function SeedStepReview({
  values,
  tray,
  actions,
  chainId,
  cycleOptions,
  protocolRegistered,
  rewardUnits,
  submitError,
  queueUnavailable,
}: SeedStepReviewProps) {
  const { formatMessage, locale } = useIntl();
  const rewardAmount = formatRewardAmount(values.considerationAmount, rewardUnits, locale);
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

  // One commitment on its own keeps the wizard's plain failure sentence.
  const lastSend =
    tray.lastSend && tray.lastSend.sent + tray.lastSend.left > 1 ? tray.lastSend : null;

  return (
    <div className="space-y-4" data-testid="seed-review">
      {lastSend ? (
        <Alert variant="warning">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.tray.left",
              defaultMessage:
                "{sent, plural, =0 {Nothing was sent.} one {# commitment was sent.} other {# commitments were sent.}} {left, plural, one {# could not be sent, so nothing was created for it. It is still here to change or try again.} other {# could not be sent, so nothing was created for them. They are still here to change or try again.}}",
            },
            { sent: lastSend.sent, left: lastSend.left }
          )}
        </Alert>
      ) : null}
      <SeedTrayList
        rows={tray.others}
        busy={tray.busy}
        onEdit={tray.onEdit}
        onRemove={tray.onRemove}
      />
      {/* The mark stays whether or not others are beside it: the last row left
          after a send is the one that failed, and it is still promised. */}
      {tray.others.length > 0 || tray.currentNotSent ? (
        <div className="flex flex-wrap items-center gap-2" data-testid="seed-tray-current">
          {tray.others.length > 0 ? (
            <p className="label-xs text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.seed.tray.current",
                defaultMessage: "This one",
              })}
            </p>
          ) : null}
          {tray.currentNotSent ? (
            <StatusBadge variant="error" size="sm" className="shrink-0 whitespace-nowrap">
              {formatMessage({
                id: "cockpit.garden.pool.seed.tray.notSent",
                defaultMessage: "Not sent",
              })}
            </StatusBadge>
          ) : null}
          {/* Nothing to hand back to when this is the only one left. */}
          {tray.others.length > 0 ? (
            <AdminButton
              type="button"
              variant="text"
              size="sm"
              disabled={tray.busy}
              className="ml-auto"
              onClick={tray.onRemoveCurrent}
            >
              {formatMessage({
                id: "cockpit.garden.pool.seed.tray.removeCurrent",
                defaultMessage: "Remove This One",
              })}
            </AdminButton>
          ) : null}
        </div>
      ) : null}
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
          defaultMessage: "How Much",
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
          defaultMessage: "Proof & Confirmation",
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
              ? `${formatMessage({ id: "cockpit.garden.pool.seed.rail.external", defaultMessage: "External payout record" })} · ${rewardAmount}`
              : values.considerationRail === "CELO_SETTLEMENT"
                ? `${formatMessage({ id: "cockpit.garden.pool.seed.rail.celo", defaultMessage: "Celo G$ settlement" })} · ${rewardAmount}`
                : formatMessage({
                    id: "cockpit.garden.pool.seed.rail.none",
                    defaultMessage: "None",
                  }),
          ],
        ]
      )}
      {tray.over ? (
        <Alert variant="error">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.tray.roomOver",
              defaultMessage:
                "These offers are more than you can hold at once. You have room for {room, plural, =0 {no more} other {# more}} under the pool's commitment limit of {cap} per person. Remove an offer, change it to a request, or raise the limit in the pool settings.",
            },
            { room: tray.room ?? 0, cap: tray.cap ?? 0 }
          )}
        </Alert>
      ) : tray.full && values.direction === "OFFER" ? (
        <Alert variant="info">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.tray.roomFull",
              defaultMessage:
                "That is as many offers as you can hold at once: the pool's commitment limit is {cap} per person. A request takes none of that room.",
            },
            { cap: tray.cap ?? 0 }
          )}
        </Alert>
      ) : null}
      {submitError ? <Alert variant="error">{submitError}</Alert> : null}
      {queueUnavailable ? (
        <Alert variant="warning">
          {formatMessage({
            id: "cockpit.garden.pool.seed.queueUnavailable",
            defaultMessage: "The queue on this device could not be read; seeding will still try.",
          })}
        </Alert>
      ) : null}
      {/* How many times the wallet will ask sits beside the button that asks. */}
      <p className="body-xs text-text-soft">
        {formatMessage({
          id: "cockpit.garden.pool.seed.queueNote",
          defaultMessage:
            "If a commitment has to wait, its row stays on the pool tab with Send Now.",
        })}
      </p>
    </div>
  );
}
