/**
 * useTakeUpChoices Hook
 *
 * The Open asks in the work garden's own pool that the reader could take up in the same tap
 * that logs work for them (decision 18). Submit Work's Start step lists them beside the reader's
 * own promises (`asks`, one per set, each shaped as a promise with one choice per requirement),
 * and the composer matches a chosen ask against `choices`, the requirements of every copy.
 * Choosing one queues the claim before the work, and the work stays in its garden, since the
 * ask is that garden's.
 *
 * The reads are the garden page's own (its pool and its detail, the pool's promises, their
 * metadata), and the asks the reader already asked for or is taking up are left out
 * (`oneTapAsks`). It offers none while this phone's queue cannot be read, since a take-up
 * already on it could not be ruled out, nor to a reader at the pool's limit of promises held at
 * once, whose take-up the registry would refuse (`isAtTakeUpLimit`, as on the promise page).
 *
 * @module hooks/commitment-pooling/useTakeUpChoices
 */

import { useMemo } from "react";
import { useIntl } from "react-intl";

import { isAtTakeUpLimit } from "../../modules/commitment-pooling/group-browsing";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types-core";
import type {
  WorkablePromise,
  WorkLinkChoice,
} from "../../modules/commitment-pooling/work-link-intent";
import { isOneTapTakeUp, oneTapAsks } from "../../modules/garden/journal";
import type { Address } from "../../types/domain";
import { useCommitmentMetadata } from "./useCommitmentMetadata";
import { useExpiryClock } from "./useExpiryClock";
import { useCommitmentPool, useCommitmentPools, useCommitments } from "./useCommitmentPooling";
import { useViewerTakeUps } from "./useViewerTakeUps";
import { workLinkReturnTo } from "./useWorkLinkChoices";

const NO_COMMITMENTS: CommitmentReadModel[] = [];

/**
 * An Open ask as Submit Work offers it: a promise the reader does not hold yet, so it takes no
 * evidence, with each requirement a choice the work takes up first.
 */
export function takeUpAsk(
  commitment: CommitmentReadModel,
  input: { workGarden: Address; returnGarden: Address; title: string }
): WorkablePromise {
  const returnTo = workLinkReturnTo(input.returnGarden, commitment.commitmentId);
  const required = (commitment.requirements ?? []).reduce(
    (sum, requirement) => sum + requirement.requiredCount,
    0
  );
  return {
    commitmentId: commitment.commitmentId,
    title: input.title,
    direction: commitment.direction,
    state: commitment.derivedState,
    dueDate: commitment.dueDate ?? null,
    targetUnits: commitment.targetUnits,
    unitLabel: commitment.unitLabel ?? null,
    // Nobody holds an ask yet, so none of its approvals have come.
    progress: required > 0 ? { approved: 0, required } : null,
    takesEvidence: false,
    choices: (commitment.requirements ?? []).map(
      (requirement, requirementIndex): WorkLinkChoice => ({
        commitmentId: commitment.commitmentId,
        requirementIndex,
        actionUID: Number(requirement.actionUID),
        garden: input.workGarden,
        commitmentTitle: input.title,
        requirementLabel: String(requirementIndex + 1),
        requiredCount: requirement.requiredCount,
        dueDate: commitment.dueDate,
        direction: commitment.direction,
        returnTo,
        takesUp: true,
      })
    ),
  };
}

export function useTakeUpChoices(input: {
  chainId: number;
  account: Address | null;
  workGarden: Address | null;
  returnGarden: Address | null;
}) {
  const { formatMessage } = useIntl();
  const { chainId, account, workGarden, returnGarden } = input;
  const enabled = Boolean(account && workGarden && returnGarden);
  const pools = useCommitmentPools({ chainId, garden: workGarden ?? undefined }, { enabled });
  // The garden page's pool: the first the indexer lists for the garden.
  const pool = pools.data?.[0] ?? null;
  const ownPool = enabled && pool !== null && pool.poolType !== "PROTOCOL";
  const commitments = useCommitments({ chainId, poolId: pool?.poolId ?? 0n }, { enabled: ownPool });
  const poolDetail = useCommitmentPool(
    { chainId, poolId: pool?.poolId ?? 0n },
    { enabled: ownPool }
  );
  const {
    takeUps,
    settled,
    unavailable,
    retry: retryTakeUps,
  } = useViewerTakeUps({
    chainId,
    poolId: pool?.poolId ?? 0n,
    viewer: account,
    enabled: ownPool,
  });
  const listed = commitments.data ?? NO_COMMITMENTS;
  const { byCID } = useCommitmentMetadata(listed);
  // Ticks when a listed ask passes its due second, so a lapsed one leaves Start's list.
  const now = useExpiryClock({ commitments: listed });
  const untitled = formatMessage({ id: "app.commitments.row.untitled" });
  const atLimit = isAtTakeUpLimit({
    direction: "REQUEST",
    cap: poolDetail.pool?.providerOpenCommitmentCap,
    exposures: poolDetail.detail?.providerExposures ?? null,
    viewer: account,
    queued: takeUps.queued.size,
  });

  const { asks, choices } = useMemo(() => {
    if (!ownPool || !workGarden || !returnGarden) return { asks: [], choices: [] };
    const shape = (commitment: CommitmentReadModel) =>
      takeUpAsk(commitment, {
        workGarden,
        returnGarden,
        title: byCID.get(commitment.metadataCID?.trim() ?? "")?.title?.trim() || untitled,
      });
    // A pool that is not open takes nothing up, and neither does a reader at its limit or a
    // phone whose queue cannot be read.
    if (pool?.state !== "OPEN" || unavailable || atLimit) return { asks: [], choices: [] };
    return {
      asks: oneTapAsks({
        commitments: listed,
        metadataByCID: byCID,
        viewer: account,
        poolOpen: true,
        takeUps,
        now,
      }).map(shape),
      // Every copy of a set, so a link to any of them holds, whichever one Start lists.
      choices: listed
        .filter((commitment) => isOneTapTakeUp(commitment, account, takeUps, now))
        .flatMap((commitment) => shape(commitment).choices),
    };
  }, [
    ownPool,
    pool?.state,
    workGarden,
    returnGarden,
    unavailable,
    atLimit,
    listed,
    account,
    takeUps,
    now,
    byCID,
    untitled,
  ]);

  return {
    asks,
    choices,
    // The pool's limit is held for while it is read; one that cannot be read reads as room.
    isLoading:
      enabled &&
      (pools.isLoading || (ownPool && (commitments.isLoading || poolDetail.isLoading || !settled))),
    isError: pools.isError || commitments.isError || unavailable,
    refetch: () => {
      if (pools.isError) void pools.refetch();
      if (commitments.isError) void commitments.refetch();
      if (unavailable) retryTakeUps();
    },
  };
}
