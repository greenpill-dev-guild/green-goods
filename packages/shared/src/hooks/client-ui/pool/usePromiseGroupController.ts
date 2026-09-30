/**
 * usePromiseGroupController Hook
 *
 * A group's page in the app (PRD-1029 c2–c9): what each promise asks, how many
 * are available, in progress and kept, the reader's own copies, and the one
 * act, Take Up One (Take Up Another once the reader holds or kept one, Ask to
 * Take Up One in a steward-reviewed group). The act takes one copy the app
 * chooses (`useGroupTakeUp`); availability that can't be read is unknown, and
 * the pool's at-once limit is the only limit stated.
 *
 * @module hooks/client-ui/pool/usePromiseGroupController
 */

import { useCallback, useMemo } from "react";

import {
  type DisplayGroupCounts,
  type DisplayGroupEntry,
  groupCommitmentsForDisplay,
} from "../../../modules/commitment-pooling/display-groups";
import {
  findDisplayGroup,
  type GroupTakeUpBar,
  isAtTakeUpLimit,
  isViewerCopy,
  pickCopyToTakeUp,
  selectGroupTakeUpBar,
} from "../../../modules/commitment-pooling/group-browsing";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import { commitmentNeedsSeat } from "../../../modules/commitment-pooling/acts";
import { selectCommitmentSeat } from "../../../modules/commitment-pooling/selectors";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";
import {
  useCommitmentPool,
  useCommitmentPools,
  useCommitments,
} from "../../commitment-pooling/useCommitmentPooling";
import { useCommitmentQueueState } from "../../commitment-pooling/useCommitmentQueueState";
import type { InboxCommitment } from "../../commitment-pooling/useCommitmentsInbox";
import { useCommitmentViewerRoles } from "../../commitment-pooling/useCommitmentViewerRoles";
import { usePoolClaimRequests } from "../../commitment-pooling/usePoolClaimRequests";
import { type GroupTakeUpState, useGroupTakeUp } from "./useGroupTakeUp";

export type { GroupTakeUpBar, GroupTakeUpState };

export type PromiseGroupStatus = "loading" | "ready" | "notFound" | "error" | "unavailable";

export interface PromiseGroupController {
  status: PromiseGroupStatus;
  isOnline: boolean;
  group: DisplayGroupEntry<CommitmentReadModel> | null;
  /** One copy, for the terms every copy shares. */
  sample: CommitmentReadModel | null;
  metadata: CommitmentMetadataV1 | null;
  counts: DisplayGroupCounts | null;
  /** False when the copies or the asks on them couldn't be read: counts may be stale. */
  availabilityKnown: boolean;
  /** The reader's own copies, each an ordinary row that opens its page. */
  yours: InboxCommitment[];
  /** The one act, or null when the reader can't take one up here. */
  bar: GroupTakeUpBar | null;
  /** The pool's per-person at-once limit, the only limit the page states. */
  cap: bigint | null;
  /** Whether the reader belongs where a take-up goes; null while it reads. */
  isMember: boolean | null;
  /** The route garden, for the join card. */
  garden: { address: Address; name: string; openJoining: boolean } | null;
  /** The queue can't be read, so nothing is offered that could send twice. */
  queueUnreadable: boolean;
  takeUp: {
    state: GroupTakeUpState;
    /** Take up the copy the app chooses now. */
    start: () => void;
    /** Take up the one offered after the first went elsewhere. */
    confirm: (copyId: bigint) => void;
    reset: () => void;
  };
  refresh: () => void;
}

export function usePromiseGroupController(input: {
  chainId: number;
  routeGarden: string | undefined;
  displayGroupId: string | undefined;
  /** The group's key, when the row that opened it passed one. */
  groupKey?: string | null;
}): PromiseGroupController {
  const { chainId, routeGarden, displayGroupId, groupKey } = input;
  const viewer = (usePrimaryAddress() as Address | null) ?? null;
  const isOnline = useOnlineStatus();
  const pools = useCommitmentPools({ chainId, garden: routeGarden as Address | undefined });
  const pool = pools.pools[0] ?? null;
  const poolId = pool?.poolId ?? 0n;
  const poolDetail = useCommitmentPool({ chainId, poolId }, { enabled: Boolean(pool) });
  const commitments = useCommitments({ chainId, poolId }, { enabled: Boolean(pool) });
  const { byCID, isLoading: metadataLoading } = useCommitmentMetadata(commitments.commitments);

  const group = useMemo(() => {
    if (!displayGroupId) return null;
    const entries = groupCommitmentsForDisplay({
      commitments: commitments.commitments,
      metadataByCID: byCID,
    });
    return findDisplayGroup(entries, displayGroupId, groupKey);
  }, [commitments.commitments, byCID, displayGroupId, groupKey]);
  const sample = group?.children[0] ?? null;
  const approvalGated = sample?.claimMode === "APPROVAL_GATED";
  const asks = usePoolClaimRequests(
    { chainId, poolId, state: "PENDING" },
    { enabled: Boolean(pool) && approvalGated }
  );
  const queue = useCommitmentQueueState(viewer);
  const roles = useCommitmentViewerRoles({
    chainId,
    viewer,
    routeGarden,
    commitment: sample ?? undefined,
    pool,
  });

  const copyIds = useMemo(
    () => new Set(group?.children.map((copy) => copy.commitmentId.toString()) ?? []),
    [group]
  );
  const askedFor = useMemo(
    () => new Set(asks.rows.map((row) => row.claim.commitmentId.toString())),
    [asks.rows]
  );
  // Take-ups still on this phone: never chosen again, and counted against the limit.
  const queued = useMemo(
    () => new Set([...queue.pendingCommitmentIds].filter((id) => copyIds.has(id))),
    [queue.pendingCommitmentIds, copyIds]
  );

  // A personal take-up goes through the route garden, or on the protocol pool
  // through a garden of the reader's own, the route garden first.
  const isProtocolPool = pool?.poolType === "PROTOCOL";
  const memberGardens = roles.claimGardens.member;
  const claimGarden = !pool
    ? null
    : isProtocolPool
      ? (memberGardens.find((option) => option.address.toLowerCase() === routeGarden?.toLowerCase())
          ?.address ??
        memberGardens[0]?.address ??
        null)
      : roles.isMemberHere
        ? (routeGarden as Address)
        : null;
  const isMember: boolean | null = isProtocolPool
    ? memberGardens.length > 0
      ? true
      : roles.claimGardensKnown
        ? false
        : null
    : roles.isMemberHere;

  const yours = useMemo<InboxCommitment[]>(
    () =>
      (group?.children ?? [])
        .filter((copy) => isViewerCopy(copy, viewer))
        .map((commitment) => {
          const seat = selectCommitmentSeat({
            commitment,
            contributors: [],
            viewer: viewer ?? undefined,
          });
          return { commitment, seat, needsYou: commitmentNeedsSeat({ commitment, seat }) };
        }),
    [group, viewer]
  );

  const availabilityKnown =
    !commitments.isError && !(approvalGated && (asks.isError || asks.isLoading));
  const choice =
    group && availabilityKnown
      ? pickCopyToTakeUp(group.children, { viewer, askedFor, skip: queued })
      : null;
  const cap = poolDetail.pool?.providerOpenCommitmentCap ?? null;
  const madeIt = Boolean(
    viewer && sample?.creator && sample.creator.toLowerCase() === viewer.toLowerCase()
  );
  const bar =
    group && sample && viewer && claimGarden && !madeIt
      ? selectGroupTakeUpBar({
          approvalGated,
          holdsOne: yours.length > 0,
          hasChoice: availabilityKnown ? choice !== null : null,
          atLimit: isAtTakeUpLimit({
            direction: sample.direction,
            cap: cap ?? undefined,
            exposures: poolDetail.detail?.providerExposures ?? null,
            viewer,
            queued: queued.size,
          }),
        })
      : null;

  const { refetch: refetchCommitments } = commitments;
  const { refetch: refetchAsks } = asks;
  const reread = useCallback(async () => {
    const [fresh, freshAsks] = await Promise.all([
      refetchCommitments(),
      approvalGated ? refetchAsks() : Promise.resolve(null),
    ]);
    if (fresh.isError || !fresh.data || freshAsks?.isError || !displayGroupId) return null;
    const regrouped = findDisplayGroup(
      groupCommitmentsForDisplay({ commitments: fresh.data, metadataByCID: byCID }),
      displayGroupId,
      group?.key ?? groupKey
    );
    return {
      copies: regrouped?.children ?? [],
      askedFor: new Set((freshAsks?.data ?? []).map((row) => row.claim.commitmentId.toString())),
    };
  }, [approvalGated, byCID, displayGroupId, group?.key, groupKey, refetchAsks, refetchCommitments]);
  const takeUp = useGroupTakeUp({ chainId, viewer, garden: claimGarden, queued, reread });
  const { takeUp: send, settle } = takeUp;

  let status: PromiseGroupStatus = "ready";
  if (commitments.availability.status !== "available") status = "unavailable";
  else if (pools.isLoading || commitments.isLoading) status = "loading";
  else if (commitments.isError && commitments.commitments.length === 0) status = "error";
  // A group is only readable as one once its copies' metadata has resolved.
  else if (!group) status = metadataLoading ? "loading" : "notFound";

  return {
    status,
    isOnline,
    group,
    sample,
    metadata: sample?.metadataCID ? (byCID.get(sample.metadataCID.trim()) ?? null) : null,
    counts: group?.counts ?? null,
    availabilityKnown,
    yours,
    bar,
    cap: cap && cap > 0n ? cap : null,
    isMember,
    garden:
      roles.garden && !isProtocolPool
        ? {
            address: roles.garden.id as Address,
            name: roles.garden.name,
            openJoining: Boolean(roles.garden.openJoining),
          }
        : null,
    queueUnreadable: queue.isUnavailable,
    takeUp: {
      state: takeUp.state,
      start: () => {
        if (choice) void send(choice.commitmentId);
        else settle(availabilityKnown ? "none" : "unknown");
      },
      confirm: (copyId) => void send(copyId),
      reset: takeUp.reset,
    },
    refresh: () => {
      void refetchCommitments();
      if (approvalGated) void refetchAsks();
      queue.refresh();
    },
  };
}
