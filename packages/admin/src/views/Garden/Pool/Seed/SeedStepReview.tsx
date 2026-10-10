import { Alert } from "@green-goods/shared/components/Alert";
import type { SeedTrayRow } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import type { CommitmentComposerValues } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { Action, Address } from "@green-goods/shared/types/domain";
import { Fragment, type ReactNode } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { FlowStatusRow } from "@/components/Layout/FlowStatusRow";
import { PersonName } from "@/components/PersonName";
import { SeedTrayList } from "./SeedTrayList";
import { dueDateAfter, formatDueDate, rewardFacts } from "./seedReward";
import type { SeedStatusView } from "./seedStatus";
import { actionUIDOf, type SeedCycleOption, type StepId } from "./seedStepModel";

/** The pool's per-person room, as the review warns about it. */
export interface SeedReviewCapacity {
  cap: number | null;
  room: number | null;
  full: boolean;
  over: boolean;
}

export interface SeedStepReviewProps {
  values: CommitmentComposerValues;
  status: SeedStatusView;
  /** The answers may still change: nothing of them exists and nothing is sending. */
  editable: boolean;
  onEditStep: (step: StepId) => void;
  /** The other answers in this sitting, beside the one under review. */
  others: readonly SeedTrayRow[];
  isLocked: (clientCommitmentId: string) => boolean;
  onEditRow: (clientCommitmentId: string) => void;
  onRemoveRow: (clientCommitmentId: string) => void;
  /** The garden's registered actions, for naming garden-work requirements. */
  actions: Action[];
  chainId: number;
  cycleOptions: SeedCycleOption[];
  /** Without a registered protocol pool the Green Goods team fallback reads off. */
  protocolRegistered: boolean;
  price: GoodDollarPriceState;
  capacity: SeedReviewCapacity;
  submitError: string | null;
  /** The device queue could not be read; creating will still try. */
  queueUnavailable: boolean;
  now: number;
}

/**
 * Step four of Seed Promises: every answer grouped by the step that asked it,
 * each section with an Edit, under one status row that keeps its height
 * through ready, approving, declined, created, sending and partial, so the
 * sections never move (PRD-1022 D16, screens 05–12). How many times the
 * wallet asks sits in the footer, beside the button that asks.
 */
export function SeedStepReview({
  values,
  status,
  editable,
  onEditStep,
  others,
  isLocked,
  onEditRow,
  onRemoveRow,
  actions,
  chainId,
  cycleOptions,
  protocolRegistered,
  price,
  capacity,
  submitError,
  queueUnavailable,
  now,
}: SeedStepReviewProps) {
  const { formatMessage, locale } = useIntl();
  const count = values.count ?? 1;
  // Garden work's unit is set to hours, in the steward's language, when the kind is chosen.
  const unit = values.unitLabel;
  const cycleLabel = cycleOptions.find((option) => option.value === values.cycleId)?.label ?? "—";

  const section = (
    step: StepId,
    heading: string,
    rows: Array<[string, ReactNode]>,
    wide = false
  ) => (
    <section className={`min-w-0 space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <AdminCardTitle as="h4">{heading}</AdminCardTitle>
        <AdminButton
          type="button"
          variant="text"
          size="sm"
          disabled={!editable}
          aria-label={formatMessage(
            { id: "cockpit.garden.pool.seed.review.editSection", defaultMessage: "Edit {section}" },
            { section: heading }
          )}
          onClick={() => onEditStep(step)}
        >
          {formatMessage({ id: "app.common.edit", defaultMessage: "Edit" })}
        </AdminButton>
      </div>
      <dl className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 body-sm">
            <dt className="max-w-[55%] shrink-0 text-text-soft">{label}</dt>
            <dd className="min-w-0 break-words text-right text-text-strong">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  const kindLabel =
    values.kind === "GARDEN_WORK"
      ? formatMessage({
          id: "cockpit.garden.pool.seed.work.gardenWork",
          defaultMessage: "Garden work",
        })
      : values.kind === "SERVICE"
        ? formatMessage({
            id: "cockpit.garden.pool.seed.work.support",
            defaultMessage: "Support",
          })
        : formatMessage({
            id: "cockpit.garden.pool.seed.kind.seasonCampaign",
            defaultMessage: "Season / campaign commitment",
          });
  const directionLabel =
    values.direction === "REQUEST"
      ? formatMessage({
          id: "cockpit.garden.pool.seed.direction.request",
          defaultMessage: "The pool requests",
        })
      : formatMessage({
          id: "cockpit.garden.pool.seed.direction.offer",
          defaultMessage: "The pool offers",
        });
  const each = `${values.targetUnits} ${unit}`;
  const confirmers =
    values.confirmers.length === 0 ? (
      formatMessage({
        id: "cockpit.garden.pool.seed.review.ordinary",
        defaultMessage: "Ordinary rule",
      })
    ) : (
      <>
        {values.confirmers.map((address, index) => (
          <Fragment key={address}>
            {index > 0 ? ", " : null}
            <PersonName address={address as Address} className="font-normal" />
          </Fragment>
        ))}
        {formatMessage(
          {
            id: "cockpit.garden.pool.seed.review.mustConfirm",
            defaultMessage: " · {threshold} must confirm",
          },
          { threshold: values.confirmationThreshold }
        )}
      </>
    );
  const reward = rewardFacts({ values, count, price, locale, formatMessage });

  return (
    <div className="space-y-4" data-testid="seed-review">
      <FlowStatusRow
        tone={status.tone}
        busy={status.busy}
        title={status.title}
        description={status.description}
        progress={status.progress}
      />
      <SeedTrayList
        rows={others}
        busy={status.busy}
        isLocked={isLocked}
        onEdit={onEditRow}
        onRemove={onRemoveRow}
      />
      <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
        {section(
          "what",
          formatMessage({ id: "cockpit.garden.pool.seed.step.what", defaultMessage: "What" }),
          [
            [
              formatMessage({ id: "cockpit.garden.pool.seed.cycle", defaultMessage: "Cycle" }),
              cycleLabel,
            ],
            [
              formatMessage({ id: "cockpit.garden.pool.seed.kind", defaultMessage: "Type" }),
              `${kindLabel} · ${directionLabel}`,
            ],
            [
              formatMessage({ id: "cockpit.garden.pool.seed.titleField", defaultMessage: "Title" }),
              values.title,
            ],
          ]
        )}
        {section(
          "howMuch",
          formatMessage({
            id: "cockpit.garden.pool.seed.step.howMuch",
            defaultMessage: "How Much",
          }),
          [
            [
              formatMessage({
                id: "cockpit.garden.pool.seed.review.promises",
                defaultMessage: "Promises",
              }),
              formatMessage(
                {
                  id: "cockpit.garden.pool.seed.review.promisesValue",
                  defaultMessage: "{count, plural, one {1} other {# separate}}",
                },
                { count }
              ),
            ],
            [
              formatMessage({
                id: "cockpit.garden.pool.seed.review.eachAsks",
                defaultMessage: "Each asks for",
              }),
              each,
            ],
            [
              formatMessage({ id: "cockpit.garden.pool.seed.review.due", defaultMessage: "Due" }),
              formatMessage(
                {
                  id: "cockpit.garden.pool.seed.review.dueValue",
                  defaultMessage: "{date}{count, plural, one {} other {, for every promise}}",
                },
                { date: formatDueDate(dueDateAfter(now, values.dueInDays), locale), count }
              ),
            ],
            [
              formatMessage({ id: "cockpit.garden.pool.seed.review.team", defaultMessage: "Team" }),
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
          "proof",
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
              confirmers,
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
                    id: "cockpit.garden.pool.seed.review.claimGated",
                    defaultMessage: "Steward-reviewed: each ask waits for your approval",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.seed.review.claimOpen",
                    defaultMessage: "Open: anyone in the garden may take one",
                  }),
            ],
          ]
        )}
        {section(
          "proof",
          formatMessage({ id: "cockpit.garden.pool.seed.rewardRow", defaultMessage: "Reward" }),
          reward,
          count <= 1
        )}
        {count > 1
          ? section(
              "howMuch",
              formatMessage({
                id: "cockpit.garden.pool.seed.review.grouping",
                defaultMessage: "Grouping",
              }),
              [
                [
                  formatMessage({
                    id: "cockpit.garden.pool.seed.review.shownAs",
                    defaultMessage: "Shown as",
                  }),
                  formatMessage(
                    {
                      id: "cockpit.garden.pool.seed.review.shownAsValue",
                      defaultMessage: "One group: {title} · {count} promises · {each} each",
                    },
                    { title: values.title, count, each }
                  ),
                ],
                [
                  formatMessage({
                    id: "cockpit.garden.pool.seed.review.eachPromise",
                    defaultMessage: "Each promise",
                  }),
                  formatMessage({
                    id: "cockpit.garden.pool.seed.review.eachPromiseValue",
                    defaultMessage: "Its own take-up, proof, confirmation and history",
                  }),
                ],
              ],
              true
            )
          : null}
      </div>
      {capacity.over ? (
        <Alert variant="error">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.tray.roomOver",
              defaultMessage:
                "These offers are more than you can hold at once. You have room for {room, plural, =0 {no more} other {# more}} under the pool's commitment limit of {cap} per person. Remove an offer, change it to a request, or raise the limit in the pool settings.",
            },
            { room: capacity.room ?? 0, cap: capacity.cap ?? 0 }
          )}
        </Alert>
      ) : capacity.full && values.direction === "OFFER" ? (
        <Alert variant="info">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.tray.roomFull",
              defaultMessage:
                "That is as many offers as you can hold at once: the pool's commitment limit is {cap} per person. A request takes none of that room.",
            },
            { cap: capacity.cap ?? 0 }
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
    </div>
  );
}
