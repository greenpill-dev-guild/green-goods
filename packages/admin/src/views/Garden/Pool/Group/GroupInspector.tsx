import type {
  CommitmentEventRecord,
  CommitmentReadModel,
} from "@green-goods/shared/modules/commitment-pooling/types-core";
import { RiSeedlingLine } from "@remixicon/react";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
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
  /** The pool's recent activity, for when each copy was taken, proven and confirmed. */
  events: readonly CommitmentEventRecord[];
  onOpenCommitment: (commitment: CommitmentReadModel) => void;
  onSeedMore: () => void;
  onEditReward: () => void;
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
  events,
  onOpenCommitment,
  onSeedMore,
  onEditReward,
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
        { id: "cockpit.garden.pool.group.scope.all", defaultMessage: "All ({count})" },
        { count: counts.published }
      ),
    ],
    [
      "available",
      counts.available,
      formatMessage(
        { id: "cockpit.garden.pool.group.scope.available", defaultMessage: "Available ({count})" },
        { count: counts.available }
      ),
    ],
    [
      "inProgress",
      counts.inProgress,
      formatMessage(
        {
          id: "cockpit.garden.pool.group.scope.inProgress",
          defaultMessage: "In progress ({count})",
        },
        { count: counts.inProgress }
      ),
    ],
    [
      "kept",
      counts.kept,
      formatMessage(
        { id: "cockpit.garden.pool.group.scope.kept", defaultMessage: "Kept ({count})" },
        { count: counts.kept }
      ),
    ],
    [
      "ended",
      counts.ended,
      formatMessage(
        { id: "cockpit.garden.pool.group.scope.ended", defaultMessage: "Ended ({count})" },
        { count: counts.ended }
      ),
    ],
  ];

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <p className="min-w-0 body-xs text-text-soft sm:flex-1">
        {canEditReward
          ? formatMessage({
              id: "cockpit.garden.pool.group.editRewardNote",
              defaultMessage: "Edit Reward is open until one of this group is kept.",
            })
          : formatMessage({
              id: "cockpit.garden.pool.group.seedMoreNote",
              defaultMessage: "Seed More Like This can add to this group or start a new one.",
            })}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {canEditReward ? (
          <AdminButton type="button" variant="outlined" onClick={onEditReward}>
            {formatMessage({
              id: "cockpit.garden.pool.reward.title",
              defaultMessage: "Edit Reward",
            })}
          </AdminButton>
        ) : null}
        <AdminButton
          type="button"
          variant="outlined"
          leadingIcon={<RiSeedlingLine className="h-4 w-4" />}
          onClick={onSeedMore}
        >
          {formatMessage({
            id: "cockpit.garden.pool.seedMore.title",
            defaultMessage: "Seed More Like This",
          })}
        </AdminButton>
      </div>
    </div>
  );

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
              { id: "cockpit.garden.pool.group.kicker", defaultMessage: "Group · {cycle}" },
              { cycle: cycleName }
            )
          : formatMessage({ id: "cockpit.garden.pool.group.kickerPlain", defaultMessage: "Group" })
      }
      className="sm:max-h-[min(45rem,calc(100dvh-2rem))]"
      bodyClassName="p-0 sm:flex sm:flex-col sm:overflow-hidden"
      actions={footer}
    >
      <div className="space-y-3 px-4 py-4 sm:shrink-0 sm:px-6" data-testid="group-lead">
        <section className="space-y-1">
          <AdminCardTitle as="h3">
            {formatMessage({
              id: "cockpit.garden.pool.group.each",
              defaultMessage: "Each promise",
            })}
          </AdminCardTitle>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            {terms.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="body-sm text-text-soft">{label}</dt>
                <dd className="body-sm text-text-strong">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <p
          className="flex flex-wrap gap-x-2.5 gap-y-1 body-sm text-text-sub"
          data-slot="group-counts"
        >
          <span>
            {formatMessage(
              { id: "cockpit.garden.pool.group.total", defaultMessage: "<b>{count}</b> promises:" },
              { count: counts.published, b: bold }
            )}
          </span>
          <span>
            {formatMessage(
              {
                id: "cockpit.garden.pool.group.available",
                defaultMessage: "<b>{count}</b> available",
              },
              { count: counts.available, b: bold }
            )}
          </span>
          <span>
            {formatMessage(
              {
                id: "cockpit.garden.pool.group.inProgress",
                defaultMessage: "<b>{count}</b> in progress",
              },
              { count: counts.inProgress, b: bold }
            )}
          </span>
          <span>
            {formatMessage(
              { id: "cockpit.garden.pool.group.kept", defaultMessage: "<b>{count}</b> kept" },
              { count: counts.kept, b: bold }
            )}
          </span>
          {counts.ended > 0 ? (
            <span>
              {formatMessage(
                { id: "cockpit.garden.pool.group.ended", defaultMessage: "<b>{count}</b> ended" },
                { count: counts.ended, b: bold }
              )}
            </span>
          ) : null}
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={formatMessage({
            id: "cockpit.garden.pool.group.scope",
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
          onOpenCommitment={onOpenCommitment}
        />
        <p className="mt-3 body-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.group.independent",
            defaultMessage:
              "Each promise is confirmed on its own. There is no group approval, and one finishing never waits for the others.",
          })}
        </p>
      </div>
    </AdminDialog>
  );
}
