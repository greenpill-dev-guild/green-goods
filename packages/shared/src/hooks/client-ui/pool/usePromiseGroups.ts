/**
 * Promise groups in the app
 *
 * The Promises tab folds the copies of a set into one group row
 * (`usePoolPromiseEntries`), and a copy's own page says which group it belongs
 * to (`usePromiseGroupOf`). Both use the projection the admin uses,
 * `groupCommitmentsForDisplay`: counts come from published copies, unreadable
 * metadata leaves a row ordinary, and an edited reward never splits a group.
 * The tab counts a group's copies on the chain's clock, as the group's page does.
 *
 * @module hooks/client-ui/pool/usePromiseGroups
 */

import { useMemo } from "react";

import { groupCommitmentsForDisplay } from "../../../modules/commitment-pooling/display-groups";
import {
  groupCountsOnClock,
  isViewerCopy,
  type PoolListEntry,
  selectPoolListEntries,
} from "../../../modules/commitment-pooling/group-browsing";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitments } from "../../commitment-pooling/useCommitmentPooling";
import { useDueClock } from "../../commitment-pooling/useDueClock";

export type { PoolListEntry };

/**
 * The Promises tab's entries. `rows` are what Status and Kind let through;
 * `commitments` are every copy in scope, so a group counts the copies the
 * filters leave out. The reader's own copies stay ordinary rows.
 *
 * A group counts its copies on the chain's clock (`groupCountsOnClock`): a copy
 * past due but still offered or requested on chain is ended, so the row never
 * says a copy is available that the group's page counts as ended.
 */
export function usePoolPromiseEntries<R extends { commitment: CommitmentReadModel }>(input: {
  chainId: number;
  /** The pool the promises are in: a copy without a due date falls due as its cycle there ends. */
  poolId: bigint;
  rows: readonly R[];
  commitments: readonly CommitmentReadModel[];
  viewer: Address | null | undefined;
}): PoolListEntry<R>[] {
  const { chainId, poolId, rows, commitments, viewer } = input;
  const { byCID } = useCommitmentMetadata(commitments);
  const { entries, listedCopies } = useMemo(() => {
    const listed = selectPoolListEntries({
      rows,
      grouped: groupCommitmentsForDisplay({ commitments, metadataByCID: byCID }),
      viewer,
    });
    return {
      entries: listed,
      listedCopies: listed.flatMap((entry) => (entry.kind === "group" ? entry.group.children : [])),
    };
  }, [rows, commitments, byCID, viewer]);
  // Ticks when a listed copy falls due, and reads the pool's cycles only for a listed copy without
  // a due date of its own. A set whose cycle's end is still unread has no due date to pass yet, so
  // it keeps the chain's counts, and no other set waits for it.
  const due = useDueClock({ chainId, poolId, commitments: listedCopies });
  return entries.map((entry) =>
    entry.kind === "group"
      ? { ...entry, group: { ...entry.group, counts: groupCountsOnClock(entry.group, due.clock) } }
      : entry
  );
}

export interface PromiseGroupOf {
  displayGroupId: string;
  key: string;
  /** Published copies in the group, this one included. */
  count: number;
  /** The reader took this copy up, so the page can say it is confirmed on its own. */
  yours: boolean;
}

/**
 * The group a copy belongs to, from its pool's published copies. Null when its
 * metadata names no group, or the group isn't readable as one.
 */
export function usePromiseGroupOf(input: {
  chainId: number;
  commitment: CommitmentReadModel | null | undefined;
  metadata: CommitmentMetadataV1 | null | undefined;
  viewer: Address | null | undefined;
}): PromiseGroupOf | null {
  const { chainId, commitment, metadata, viewer } = input;
  const displayGroupId = metadata?.displayGroup?.id ?? null;
  const poolId = commitment?.poolId ?? null;
  const pool = useCommitments(
    { chainId, poolId: poolId ?? 0n },
    { enabled: Boolean(displayGroupId && poolId) }
  );
  const { byCID } = useCommitmentMetadata(pool.commitments);
  return useMemo(() => {
    if (!displayGroupId || !commitment) return null;
    for (const entry of groupCommitmentsForDisplay({
      commitments: pool.commitments,
      metadataByCID: byCID,
    })) {
      if (entry.kind !== "group" || !entry.children.some((copy) => copy.id === commitment.id)) {
        continue;
      }
      return {
        displayGroupId: entry.displayGroupId,
        key: entry.key,
        count: entry.counts.published,
        yours: isViewerCopy(commitment, viewer),
      };
    }
    return null;
  }, [displayGroupId, commitment, pool.commitments, byCID, viewer]);
}
