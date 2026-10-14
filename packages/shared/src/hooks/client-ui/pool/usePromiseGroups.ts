/**
 * Promise groups in the app
 *
 * The Promises tab folds the copies of a set into one group row
 * (`usePoolPromiseEntries`), and a copy's own page says which group it belongs
 * to (`usePromiseGroupOf`). Both use the projection the admin uses,
 * `groupCommitmentsForDisplay`: counts come from published copies, unreadable
 * metadata leaves a row ordinary, and an edited reward never splits a group.
 *
 * @module hooks/client-ui/pool/usePromiseGroups
 */

import { useMemo } from "react";

import { groupCommitmentsForDisplay } from "../../../modules/commitment-pooling/display-groups";
import {
  isViewerCopy,
  type PoolListEntry,
  selectPoolListEntries,
} from "../../../modules/commitment-pooling/group-browsing";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitments } from "../../commitment-pooling/useCommitmentPooling";

export type { PoolListEntry };

/**
 * The Promises tab's entries. `rows` are what Status and Kind let through;
 * `commitments` are every copy in scope, so a group counts the copies the
 * filters leave out. The reader's own copies stay ordinary rows.
 */
export function usePoolPromiseEntries<R extends { commitment: CommitmentReadModel }>(input: {
  rows: readonly R[];
  commitments: readonly CommitmentReadModel[];
  viewer: Address | null | undefined;
}): PoolListEntry<R>[] {
  const { rows, commitments, viewer } = input;
  const { byCID } = useCommitmentMetadata(commitments);
  return useMemo(
    () =>
      selectPoolListEntries({
        rows,
        grouped: groupCommitmentsForDisplay({ commitments, metadataByCID: byCID }),
        viewer,
      }),
    [rows, commitments, byCID, viewer]
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
