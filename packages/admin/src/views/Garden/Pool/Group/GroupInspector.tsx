import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type {
  CommitmentEventRecord,
  CommitmentReadModel,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import { RiSeedlingLine } from "@remixicon/react";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { AdminCardTitle } from "@/components/AdminCard";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import type { PoolCommitmentGroup } from "../poolCommitmentRows";
import { GroupPeopleList } from "./GroupPeopleList";
import { type GroupScope, groupInspectorRows, scopeRows } from "./groupInspectorModel";

export interface GroupInspectorProps {
  open: boolean;
  onClose: () => void;
  group: PoolCommitmentGroup;
  title: string;
  /** The season or campaign the group runs in. */
  cycleName: string | null;
  chainId: number;
  /** The group's shared terms, as label and value (`groupTerms`). */
  terms: ReadonlyArray<readonly [string, string]>;
  /** The group carries a G$ reward, so each row says whether it was paid. */
  rewarded: boolean;
  /** Edit Reward stays open until one copy is kept (D14). */
  canEditReward: boolean;
  /** Some copy is still untaken, so its confirmers can change. */
  canEditConfirmers?: boolean;
  /** Edits are sent right away, never queued, so they wait for a connection. */
  isOnline?: boolean;
  /** Rewarded templates cannot be copied while settlement is deferred. */
  canSeedMore?: boolean;
  /** The pool's recent activity, for when each copy was taken, proven and confirmed. */
  events: readonly CommitmentEventRecord[];
  /** Copies whose next act is this steward's own, marked "Needs you". */
  waitingOnYou: ReadonlySet<string>;
  onOpenCommitment: (commitment: CommitmentReadModel) => void;
  onSeedMore: () => void;
  onEditReward: () => void;
  onEditConfirmers?: () => void;
}

const bold = (chunks: ReactNode[]) => (
  <b className="font-semibold text-text-strong tabular-nums">{chunks}</b>
);

/**
 * The group inspector (PRD-1022 screen 14): the group's terms, its counts and
 * filters, then one row per person who took a copy, and one for the copies
 * nobody has taken. It fits the screen: on wide screens the terms stay put and
 * only the list scrolls; on narrow ones they scroll away with it. Every row
 * opens that promise's own inspector, where each is confirmed on its own.
 */
export function GroupInspector({
  open,
  onClose,
  group,
  title,
  cycleName,
  chainId,
  terms,
  rewarded,
  canEditReward,
  canEditConfirmers = false,
  isOnline = true,
  canSeedMore = true,
  events,
  waitingOnYou,
  onOpenCommitment,
  onSeedMore,
  onEditReward,
  onEditConfirmers,
}: GroupInspectorProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const [scope, setScope] = useState<GroupScope>("all");
  const rows = groupInspectorRows(group.children, events);
  const shown = scopeRows(rows, scope);
  const { counts } = group;

  const chips: Array<[GroupScope, number, string]> = [
    [
      "all",
      counts.published,
      formatMessage(
        { id: "hub.garden.pool.group.scope.all", defaultMessage: "All ({count})" },
        { count: counts.published }
      ),
    ],
    [
      "available",
      counts.available,
      formatMessage(
        { id: "hub.garden.pool.group.scope.available", defaultMessage: "Available ({count})" },
        { count: counts.available }
      ),
    ],
    [
      "inProgress",
      counts.inProgress,
      formatMessage(
        {
          id: "hub.garden.pool.group.scope.inProgress",
          defaultMessage: "In progress ({count})",
        },
        { count: counts.inProgress }
      ),
    ],
    [
      "kept",
      counts.kept,
      formatMessage(
        { id: "hub.garden.pool.group.scope.kept", defaultMessage: "Kept ({count})" },
        { count: counts.kept }
      ),
    ],
    [
      "ended",
      counts.ended,
      formatMessage(
        { id: "hub.garden.pool.group.scope.ended", defaultMessage: "Ended ({count})" },
        { count: counts.ended }
      ),
    ],
  ];

  const editsHeld = !isOnline && (canEditReward || canEditConfirmers);
  const footer: SheetActionsProps = {
    note: editsHeld ? (
      <span className="text-warning-dark">
        {formatMessage({
          id: "hub.garden.pool.offline",
          defaultMessage: "Needs a connection. Pool changes are sent right away, not queued.",
        })}
      </span>
    ) : canEditReward ? (
      formatMessage({
        id: "hub.garden.pool.group.editRewardNote",
        defaultMessage: "Edit Reward is open until one of this group is kept.",
      })
    ) : !canSeedMore ? (
      formatMessage({ id: "hub.garden.pool.group.rewardDeferredNote" })
    ) : (
      formatMessage({
        id: "hub.garden.pool.group.seedMoreNote",
        defaultMessage: "Seed More Like This can add to this group or start a new one.",
      })
    ),
    // Ways on from the group, none of them the main one, in reading order.
    secondary: [
      ...(canEditReward
        ? [
            {
              label: formatMessage({
                id: "hub.garden.pool.reward.title",
                defaultMessage: "Edit Reward",
              }),
              onClick: onEditReward,
              disabled: !isOnline,
            },
          ]
        : []),
      ...(canEditConfirmers && onEditConfirmers
        ? [
            {
              label: formatMessage({
                id: "hub.garden.pool.confirmers.title",
                defaultMessage: "Edit Confirmers",
              }),
              onClick: onEditConfirmers,
              disabled: !isOnline,
            },
          ]
        : []),
      ...(canSeedMore
        ? [
            {
              label: formatMessage({
                id: "hub.garden.pool.seedMore.title",
                defaultMessage: "Seed More Like This",
              }),
              icon: <RiSeedlingLine className="h-[18px] w-[18px]" aria-hidden="true" />,
              onClick: onSeedMore,
            },
          ]
        : []),
    ],
  };

  return (
    <AdminDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="lg"
      tone="garden"
      title={title}
      description={
        cycleName
          ? formatMessage(
              { id: "hub.garden.pool.group.kicker", defaultMessage: "Group · {cycle}" },
              { cycle: cycleName }
            )
          : formatMessage({ id: "hub.garden.pool.group.kickerPlain", defaultMessage: "Group" })
      }
      className="max-h-[min(700px,calc(100dvh-1rem))] sm:max-h-[min(720px,calc(100dvh-2rem))]"
      bodyClassName="p-0 sm:flex sm:flex-col sm:overflow-hidden"
      actions={footer}
    >
      <div className="space-y-3 px-4 py-4 sm:shrink-0 sm:px-6" data-testid="group-lead">
        <section className="space-y-1">
          <AdminCardTitle as="h3">
            {formatMessage({
              id: "hub.garden.pool.group.each",
              defaultMessage: "Each promise",
            })}
          </AdminCardTitle>
          {/* The label beside its value, as the promise inspector's facts read. */}
          <FactList frame="inset">
            {terms.map(([label, value]) => (
              <FactRow key={label} label={label} value={value} />
            ))}
          </FactList>
        </section>
        <p
          className="flex flex-wrap gap-x-2.5 gap-y-1 type-body text-text-sub"
          data-slot="group-counts"
        >
          <span>
            {formatMessage(
              { id: "hub.garden.pool.group.total", defaultMessage: "<b>{count}</b> promises:" },
              { count: counts.published, b: bold }
            )}
          </span>
          <span>
            {formatMessage(
              {
                id: "hub.garden.pool.group.available",
                defaultMessage: "<b>{count}</b> available",
              },
              { count: counts.available, b: bold }
            )}
          </span>
          <span>
            {formatMessage(
              {
                id: "hub.garden.pool.group.inProgress",
                defaultMessage: "<b>{count}</b> in progress",
              },
              { count: counts.inProgress, b: bold }
            )}
          </span>
          <span>
            {formatMessage(
              { id: "hub.garden.pool.group.kept", defaultMessage: "<b>{count}</b> kept" },
              { count: counts.kept, b: bold }
            )}
          </span>
          {counts.ended > 0 ? (
            <span>
              {formatMessage(
                { id: "hub.garden.pool.group.ended", defaultMessage: "<b>{count}</b> ended" },
                { count: counts.ended, b: bold }
              )}
            </span>
          ) : null}
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={formatMessage({
            id: "hub.garden.pool.group.scope",
            defaultMessage: "Which promises to show",
          })}
        >
          {chips
            .filter(([key, count]) => key === "all" || count > 0)
            .map(([key, , label]) => (
              <AdminFilterChip
                key={key}
                label={label}
                selected={scope === key}
                onToggle={() => setScope(key)}
              />
            ))}
        </div>
      </div>

      <div className="px-4 pb-4 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:px-6">
        <GroupPeopleList
          taken={shown.taken}
          available={rows.available}
          showAvailable={shown.showAvailable}
          chainId={chainId}
          rewarded={rewarded}
          waitingOnYou={waitingOnYou}
          onOpenCommitment={onOpenCommitment}
        />
        <p className="mt-3 type-meta text-text-soft">
          {formatMessage({
            id: "hub.garden.pool.group.independent",
            defaultMessage:
              "Each promise is confirmed on its own. There is no group approval, and one finishing never waits for the others.",
          })}
        </p>
      </div>
    </AdminDialog>
  );
}
