import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { IconButton } from "@green-goods/shared/components/IconButton";
import {
  type GardenPoolDirection,
  type GardenPoolLiveness,
  useGardenPoolController,
} from "@green-goods/shared/hooks/client-ui/pool/useGardenPoolController";
import {
  type CommitmentCycleRecord,
  type CommitmentPoolRecord,
  usePoolCharter,
} from "@green-goods/shared/commitment-pooling";
import { RiInformationLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

import { formatSavedAt } from "@/components/Communication/Offline/formatSavedAt";
import { CommitmentRow, CommitmentStateLadder } from "@/components/Features/Commitments";
import {
  GardenListHeader,
  GardenListHeaderLoading,
  GardenListHeaderSpace,
} from "@/components/Features/Garden";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { CycleDetailsSheet } from "./CycleDetailsSheet";
import { CycleRail } from "./CycleRail";
import { PendingCreationRow } from "./PendingCreationRow";
import { type CommitmentDoor, PoolCreateEntry } from "./PoolCreateEntry";
import { PoolLifecycleNotice } from "./PoolLifecycleNotice";

export interface GardenPoolProps {
  pool: CommitmentPoolRecord;
}

const STATUS_OPTIONS: { id: GardenPoolLiveness; labelId: string }[] = [
  { id: "live", labelId: "app.pool.status.live" },
  { id: "settled", labelId: "app.pool.status.settled" },
  { id: "all", labelId: "app.pool.status.all" },
];

const KIND_OPTIONS: { id: GardenPoolDirection; labelId: string }[] = [
  { id: "all", labelId: "app.pool.kind.all" },
  { id: "OFFER", labelId: "app.commitments.filter.offers" },
  { id: "REQUEST", labelId: "app.commitments.filter.requests" },
];

/** The count names what the list shows, so it follows Status. */
const COUNT_IDS: Record<GardenPoolLiveness, string> = {
  live: "app.pool.count.live",
  settled: "app.pool.count.settled",
  all: "app.pool.count.all",
};

/**
 * A garden's promises: what its neighbours have offered and asked for.
 *
 * The tab reads top to bottom the way the garden works: the seasons and
 * campaigns, then one header row, then the promises, inside the page's one 16px
 * gutter. The header row carries the count, the pool's agreement behind the ⓘ
 * beside it (D33), and Status and Kind as two compact selects (D9, D27); Settled
 * is the history. The explanation of promises lives in Help, reached from the
 * Offer or Request sheet (D10).
 */
export function GardenPool({ pool }: GardenPoolProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigate();
  const controller = useGardenPoolController(pool);
  const [charterOpen, setCharterOpen] = useState(false);
  // The last cycle stays drawn while its sheet closes.
  const [details, setDetails] = useState<{ cycle: CommitmentCycleRecord | null; open: boolean }>({
    cycle: null,
    open: false,
  });
  const {
    charter,
    isLoading: charterLoading,
    isUnavailable: charterUnavailable,
  } = usePoolCharter(pool.charterCID);

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
        <PoolLifecycleNotice pool={pool} isSteward={controller.stewardsPool} />
      </div>
    );
  }

  // The pool's own agreement, from its charter. The general sentence stands in
  // only for a pool that has none; one that cannot be read says so.
  const charterWords = charter?.purpose
    ? charter.purpose
    : charterUnavailable
      ? formatMessage({ id: "app.pool.charter.unavailable" })
      : charterLoading
        ? formatMessage({ id: "app.pool.charter.loading" })
        : formatMessage({ id: "app.pool.charter" });

  // The count, or, offline, when the saved list was read.
  const updatedAt = controller.commitments.dataUpdatedAt;
  const status = controller.isOnline
    ? formatMessage({ id: COUNT_IDS[controller.liveness] }, { count: controller.rows.length })
    : updatedAt
      ? formatMessage({ id: "app.offline.savedAt" }, { when: formatSavedAt(intl, updatedAt) })
      : formatMessage({ id: "app.pool.offlineUnsaved" });

  // The agreement's ⓘ, 4px after the count, in every state that has a count.
  const agreement = (
    <IconButton
      emphasis="tertiary"
      size="compact"
      className="shrink-0"
      onClick={() => setCharterOpen(true)}
      aria-label={formatMessage({ id: "app.pool.charter.title" })}
      title={formatMessage({ id: "app.pool.charter.title" })}
      icon={<RiInformationLine className="h-4 w-4" aria-hidden="true" />}
    />
  );
  const filters = (
    <>
      <NativeSelect
        aria-label={formatMessage({ id: "app.pool.status.label" })}
        controlSize="compact"
        density="condensed"
        className="w-auto min-w-16 max-w-48 field-sizing-content"
        value={controller.liveness}
        onChange={(event) => controller.setLiveness(event.target.value as GardenPoolLiveness)}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {formatMessage({ id: option.labelId })}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label={formatMessage({ id: "app.pool.kind.label" })}
        controlSize="compact"
        density="condensed"
        className="w-auto min-w-16 max-w-48 field-sizing-content"
        value={controller.direction}
        onChange={(event) => controller.setDirection(event.target.value as GardenPoolDirection)}
      >
        {KIND_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {formatMessage({ id: option.labelId })}
          </option>
        ))}
      </NativeSelect>
    </>
  );

  // The door fixes the direction; the form never asks it again. Creation is
  // offered only while the pool is open, since a paused pool takes nothing, and
  // only to those the contract accepts as creators (the controller's canCreate).
  const openDoor = (door: CommitmentDoor) => navigate(`commitments/new?direction=${door}`);
  return (
    <>
      <div className="space-y-3">
        {controller.poolState === "PAUSED" ? <PoolLifecycleNotice pool={pool} inline /> : null}
        <CycleRail
          cycles={controller.cycles}
          selectedCycleId={controller.selectedCycleId}
          onSelect={controller.setSelectedCycleId}
          onShowDetails={(cycle) => setDetails({ cycle, open: true })}
        />
        <CommitmentStateLadder
          surface="page"
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
            errorId: "app.pool.error.title",
            errorDescriptionId: "app.pool.error.description",
            emptyTitleId: "app.pool.emptyTitle",
            emptyDescriptionId: "app.pool.emptyDescription",
          }}
          pageHeader={{
            list: <GardenListHeader status={status} statusAside={agreement} filters={filters} />,
            // Nothing to filter yet, but the agreement matters most now (D33).
            empty: <GardenListHeader status={status} statusAside={agreement} />,
            // No ⓘ while loading: it would slide as the line becomes the count.
            loading: (
              <GardenListHeaderLoading
                label={formatMessage({ id: "app.pool.loading" })}
                srLabel={formatMessage({ id: "app.pool.loadingDetail" })}
                placeholders={[
                  formatMessage({ id: "app.pool.status.live" }),
                  formatMessage({ id: "app.pool.kind.all" }),
                ]}
              />
            ),
            space: <GardenListHeaderSpace />,
          }}
        >
          {controller.ownCreations.length > 0 ? (
            <div className="mb-2 space-y-2" data-component="PoolPendingCreations">
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
        </CommitmentStateLadder>
      </div>

      {/* The + stays when the list is empty, and shows only to those who may start one
          (D14, D25). While the list is loading or couldn't load, it waits: the list is
          the page's one job then. */}
      {controller.canCreate &&
      !controller.commitments.isLoading &&
      !controller.commitments.isError ? (
        <PoolCreateEntry onChoose={openDoor} />
      ) : null}

      <AppSheet
        isOpen={charterOpen}
        onClose={() => setCharterOpen(false)}
        header={{ title: formatMessage({ id: "app.pool.charter.title" }) }}
        size="compact"
      >
        <p className="text-sm leading-relaxed text-text-strong-950">{charterWords}</p>
      </AppSheet>
      <CycleDetailsSheet
        cycle={details.cycle}
        isOpen={details.open}
        onClose={() => setDetails((current) => ({ ...current, open: false }))}
        onShowPromises={(cycleId) => {
          controller.setSelectedCycleId(cycleId);
          setDetails((current) => ({ ...current, open: false }));
        }}
      />
    </>
  );
}
