/**
 * useTakeUpChoices Hook
 *
 * The Open asks in the work garden's own pool that the reader could take up in the same tap
 * that logs work for them (decision 18), for the action being logged. Each requirement of an ask
 * names one action, so each matching requirement is one link choice. Submit Work offers them
 * beside the reader's own promises; choosing one queues the claim before the work, and the work
 * stays in its garden, since the ask is that garden's.
 *
 * The reads are the garden page's own (its pool and its detail, the pool's promises, their
 * metadata), and the asks the reader already asked for or is taking up are left out
 * (`isOneTapTakeUp`). It offers none while this phone's queue cannot be read, since a take-up
 * already on it could not be ruled out, nor to a reader at the pool's limit of promises held at
 * once, whose take-up the registry would refuse (`isAtTakeUpLimit`, as on the promise page).
 *
 * @module hooks/commitment-pooling/useTakeUpChoices
 */

import { useMemo } from "react";
import { useIntl } from "react-intl";

import { isAtTakeUpLimit } from "../../modules/commitment-pooling/group-browsing";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types-core";
import type { WorkLinkChoice } from "../../modules/commitment-pooling/work-link-intent";
import { isOneTapTakeUp } from "../../modules/garden/journal";
import type { Address } from "../../types/domain";
import { useCommitmentMetadata } from "./useCommitmentMetadata";
import { useCommitmentPool, useCommitmentPools, useCommitments } from "./useCommitmentPooling";
import { useViewerTakeUps } from "./useViewerTakeUps";
import { workLinkReturnTo } from "./useWorkLinkChoices";

const NO_COMMITMENTS: CommitmentReadModel[] = [];

export function useTakeUpChoices(input: {
  chainId: number;
  account: Address | null;
  workGarden: Address | null;
  returnGarden: Address | null;
  actionUID: number | null;
}) {
  const { formatMessage } = useIntl();
  const { chainId, account, workGarden, returnGarden, actionUID } = input;
  const enabled = Boolean(account && workGarden && returnGarden && actionUID !== null);
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
  const untitled = formatMessage({ id: "app.commitments.row.untitled" });
  const atLimit = isAtTakeUpLimit({
    direction: "REQUEST",
    cap: poolDetail.pool?.providerOpenCommitmentCap,
    exposures: poolDetail.detail?.providerExposures ?? null,
    viewer: account,
    queued: takeUps.queued.size,
  });

  const choices = useMemo((): WorkLinkChoice[] => {
    // A pool that is not open takes nothing up.
    if (!ownPool || pool?.state !== "OPEN" || !workGarden || !returnGarden) return [];
    if (unavailable || atLimit) return [];
    return listed
      .filter((commitment) => isOneTapTakeUp(commitment, account, takeUps))
      .flatMap((commitment) =>
        (commitment.requirements ?? []).flatMap((requirement, requirementIndex) =>
          Number(requirement.actionUID) === actionUID
            ? [
                {
                  commitmentId: commitment.commitmentId,
                  requirementIndex,
                  actionUID,
                  garden: workGarden,
                  commitmentTitle:
                    byCID.get(commitment.metadataCID?.trim() ?? "")?.title?.trim() || untitled,
                  requirementLabel: String(requirementIndex + 1),
                  requiredCount: requirement.requiredCount,
                  dueDate: commitment.dueDate,
                  direction: commitment.direction,
                  returnTo: workLinkReturnTo(returnGarden, commitment.commitmentId),
                  takesUp: true as const,
                },
              ]
            : []
        )
      );
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
    actionUID,
    byCID,
    untitled,
  ]);

  return {
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
