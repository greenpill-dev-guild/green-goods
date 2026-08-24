import {
  type GardenPoolDirection,
  useGardenPoolController,
} from "@green-goods/shared/hooks/client-ui/pool/useGardenPoolController";
import { type CommitmentPoolRecord } from "@green-goods/shared/commitment-pooling";
import { RiHandHeartLine, RiInformationLine, RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

import { CommitmentRow, CommitmentStateLadder } from "@/components/Features/Commitments";
import { CycleRail } from "./CycleRail";
import { PendingCreationRow } from "./PendingCreationRow";
import { type CommitmentDoor, PoolCreateEntry } from "./PoolCreateEntry";
import { PoolLifecycleNotice } from "./PoolLifecycleNotice";

export interface GardenPoolProps {
  pool: CommitmentPoolRecord;
}

const DIRECTION_FILTERS: { id: GardenPoolDirection; labelId: string }[] = [
  { id: "all", labelId: "app.commitments.filter.all" },
  { id: "OFFER", labelId: "app.commitments.filter.offers" },
  { id: "REQUEST", labelId: "app.commitments.filter.requests" },
];

/**
 * A garden's pool: what its neighbours have offered and asked for.
 *
 * The tab reads top to bottom the way the garden works. What is running comes
 * first, then what the pool is for, then the commitments themselves. Nothing
 * sits between the seasons and the list.
 */
export function GardenPool({ pool }: GardenPoolProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const controller = useGardenPoolController(pool);

  if (!controller.isParticipating) {
    // A creation queued before the pool closed can never land now, and these
    // rows are the only way to throw its record away. They stay reachable
    // above the notice; retry is pointless here, so only discard is offered.
    return (
      <div className="space-y-3">
        {controller.ownCreations.map((creation) => (
          <PendingCreationRow
            key={creation.jobId}
            creation={{ ...creation, failed: true }}
            isBusy={controller.busyJobId === creation.jobId}
            onRetry={() => undefined}
            onDiscard={controller.acts.discard}
            discardOnly
          />
        ))}
        <PoolLifecycleNotice pool={pool} />
      </div>
    );
  }

  // The door fixes the direction; the form never asks it again. Creation is
  // only offered while the pool is open, since a paused pool takes nothing,
  // and on the protocol pool only to its stewards: the contract refuses any
  // other creator there (CreationChecksLib.resolveCreator), so a member's door
  // would queue an act that can only revert.
  const openDoor = (door: CommitmentDoor) => navigate(`commitments/new?direction=${door}`);
  return (
    <CommitmentStateLadder
      availability={controller.commitments.availability}
      isLoading={controller.commitments.isLoading}
      isError={controller.commitments.isError}
      isOnline={controller.isOnline}
      // A creation still on this phone is a row, so the list is not empty.
      isEmpty={
        controller.commitments.commitments.length === 0 && controller.ownCreations.length === 0
      }
      onRetry={() => void controller.commitments.refetch()}
      copy={{
        loadingId: "app.pool.loading",
        errorId: "app.pool.error",
        emptyTitleId: "app.pool.emptyTitle",
        emptyDescriptionId: "app.pool.emptyDescription",
        emptyLead:
          controller.poolState === "PAUSED" ? (
            <PoolLifecycleNotice pool={pool} inline />
          ) : undefined,
        // An empty pool keeps its big inline doors and draws no floating entry:
        // there is nothing to scroll past, and the invitation is the screen.
        emptyAction: controller.canCreate ? (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => openDoor("offer")}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
            >
              <RiSeedlingLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.pool.empty.offer" })}
            </button>
            <button
              type="button"
              onClick={() => openDoor("request")}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 text-sm font-medium text-text-strong-950 tap-target-lg"
            >
              <RiHandHeartLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.pool.empty.request" })}
            </button>
          </div>
        ) : undefined,
      }}
    >
      {controller.poolState === "PAUSED" ? <PoolLifecycleNotice pool={pool} inline /> : null}

      <CycleRail
        cycles={controller.cycles}
        selectedCycleId={controller.selectedCycleId}
        onSelect={controller.setSelectedCycleId}
      />

      <p className="flex gap-2 text-xs leading-relaxed text-text-sub-600">
        <RiInformationLine className="h-4 w-4 shrink-0" aria-hidden="true" />
        {formatMessage({ id: "app.pool.charter" })}
      </p>

      <div
        className="flex gap-2"
        role="group"
        aria-label={formatMessage({ id: "app.commitments.filter.label" })}
      >
        {DIRECTION_FILTERS.map((filter) => {
          const selected = filter.id === controller.direction;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={selected}
              onClick={() => controller.setDirection(filter.id)}
              className={
                selected
                  ? "rounded-full border border-primary-alpha-24 bg-primary-alpha-10 px-3 py-1.5 text-xs font-medium text-primary tap-target-lg"
                  : "rounded-full border border-stroke-soft-200 px-3 py-1.5 text-xs font-medium text-text-sub-600 tap-target-lg"
              }
            >
              {formatMessage({ id: filter.labelId })}
            </button>
          );
        })}
      </div>

      {controller.ownCreations.length > 0 ? (
        <div className="space-y-2" data-component="PoolPendingCreations">
          {controller.ownCreations.map((creation) => (
            <PendingCreationRow
              key={creation.jobId}
              creation={creation}
              isBusy={controller.busyJobId === creation.jobId}
              onRetry={(jobId) => void controller.acts.retry(jobId)}
              onDiscard={(jobId) => void controller.acts.discard(jobId)}
            />
          ))}
        </div>
      ) : null}

      {controller.rows.length === 0 ? (
        controller.ownCreations.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-sub-600">
            {formatMessage({ id: "app.commitments.filter.noMatches" })}
          </p>
        ) : null
      ) : (
        <div className="space-y-2">
          {controller.rows.map((row) => (
            <CommitmentRow
              key={row.commitment.id}
              row={row}
              title={controller.titleOf(row.commitment.metadataCID)}
              onOpen={(id) => navigate(`commitments/${id.toString()}`)}
            />
          ))}
        </div>
      )}

      {controller.canCreate ? <PoolCreateEntry onChoose={openDoor} /> : null}
    </CommitmentStateLadder>
  );
}
