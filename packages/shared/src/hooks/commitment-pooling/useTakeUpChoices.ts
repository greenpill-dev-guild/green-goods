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
 * The reads are the garden page's own (its pool, the pool's promises, their metadata), and the
 * asks the reader already asked for or is taking up are left out (`oneTapAsks`).
 *
 * @module hooks/commitment-pooling/useTakeUpChoices
 */

import { useMemo } from "react";
import { useIntl } from "react-intl";

import type { CommitmentReadModel } from "../../modules/commitment-pooling/types-core";
import type {
  WorkablePromise,
  WorkLinkChoice,
} from "../../modules/commitment-pooling/work-link-intent";
import { isOneTapTakeUp, oneTapAsks } from "../../modules/garden/journal";
import type { Address } from "../../types/domain";
import { useCommitmentMetadata } from "./useCommitmentMetadata";
import { useCommitmentPools, useCommitments } from "./useCommitmentPooling";
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
  return {
    commitmentId: commitment.commitmentId,
    title: input.title,
    direction: commitment.direction,
    state: commitment.derivedState,
    dueDate: commitment.dueDate ?? null,
    targetUnits: commitment.targetUnits,
    unitLabel: commitment.unitLabel ?? null,
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
  const { takeUps, settled } = useViewerTakeUps({
    chainId,
    poolId: pool?.poolId ?? 0n,
    viewer: account,
    enabled: ownPool,
  });
  const listed = commitments.data ?? NO_COMMITMENTS;
  const { byCID } = useCommitmentMetadata(listed);
  const untitled = formatMessage({ id: "app.commitments.row.untitled" });

  const { asks, choices } = useMemo(() => {
    if (!ownPool || !workGarden || !returnGarden) return { asks: [], choices: [] };
    const shape = (commitment: CommitmentReadModel) =>
      takeUpAsk(commitment, {
        workGarden,
        returnGarden,
        title: byCID.get(commitment.metadataCID?.trim() ?? "")?.title?.trim() || untitled,
      });
    // A pool that is not open takes nothing up.
    const poolOpen = pool?.state === "OPEN";
    return {
      asks: oneTapAsks({
        commitments: listed,
        metadataByCID: byCID,
        viewer: account,
        poolOpen,
        takeUps,
      }).map(shape),
      // Every copy of a set, so a link to any of them holds, whichever one Start lists.
      choices: poolOpen
        ? listed
            .filter((commitment) => isOneTapTakeUp(commitment, account, takeUps))
            .flatMap((commitment) => shape(commitment).choices)
        : [],
    };
  }, [ownPool, pool?.state, workGarden, returnGarden, listed, account, takeUps, byCID, untitled]);

  return {
    asks,
    choices,
    isLoading: enabled && (pools.isLoading || (ownPool && (commitments.isLoading || !settled))),
    isError: pools.isError || commitments.isError,
    refetch: () => {
      if (pools.isError) void pools.refetch();
      if (commitments.isError) void commitments.refetch();
    },
  };
}
