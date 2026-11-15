/**
 * Promise groups in the app
 *
 * The Promises tab folds the copies of a set into one group row
 * (`usePoolPromiseEntries`), and a copy's own page says which group it belongs
 * to (`usePromiseGroupOf`). Both use the projection the admin uses,
 * `groupCommitmentsForDisplay`: counts come from published copies, unreadable
 * metadata leaves a row ordinary, and an edited reward never splits a group.
 * The tab counts a group's copies as the group's page does (`groupTakeUpCounts`).
 *
 * @module hooks/client-ui/pool/usePromiseGroups
 */

import { useMemo } from "react";

import { groupCommitmentsForDisplay } from "../../../modules/commitment-pooling/display-groups";
import { fallsDueWithItsCycle, isPastDue } from "../../../modules/commitment-pooling/due-dates";
import {
  type CountedPoolListEntry,
  countTakeUpGroup,
  isViewerCopy,
  selectPoolListEntries,
  type TakeUpGroupEntry,
} from "../../../modules/commitment-pooling/group-browsing";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import { useCommitmentMetadata } from "../../commitment-pooling/useCommitmentMetadata";
import { useCommitments } from "../../commitment-pooling/useCommitmentPooling";
import { useDueClock } from "../../commitment-pooling/useDueClock";
import { usePoolClaimRequests } from "../../commitment-pooling/usePoolClaimRequests";

export type { CountedPoolListEntry, TakeUpGroupEntry };

/**
 * The Promises tab's entries. `rows` are what Status and Kind let through;
 * `commitments` are every copy in scope, so a group counts the copies the
 * filters leave out. The reader's own copies stay ordinary rows.
 *
 * A group counts its copies as the group's page does (`groupTakeUpCounts`): a copy
 * past due but still offered or requested on chain is ended, and in a steward-reviewed
 * group a copy with a request waiting on a steward is requested, so the row never says
 * a copy is available that the page's act would not take. A reviewed group's
 * availability is unknown while the pool's requests can't be read.
 */
export function usePoolPromiseEntries<R extends { commitment: CommitmentReadModel }>(input: {
  chainId: number;
  /** The pool the promises are in: a copy without a due date falls due as its cycle there ends. */
  poolId: bigint;
  rows: readonly R[];
  commitments: readonly CommitmentReadModel[];
  viewer: Address | null | undefined;
}): CountedPoolListEntry<R>[] {
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
  // The requests the group's page reads, under its key, read only for a listed reviewed group.
  const asks = usePoolClaimRequests(
    { chainId, poolId, state: "PENDING" },
    { enabled: listedCopies.some((copy) => copy.claimMode === "APPROVAL_GATED") }
  );
  const askedFor = useMemo(
    () =>
      asks.isError || asks.isLoading
        ? null
        : new Set(asks.rows.map((row) => row.claim.commitmentId.toString())),
    [asks.rows, asks.isError, asks.isLoading]
  );
  return entries.map((entry) =>
    entry.kind === "group"
      ? { kind: "group" as const, ...countTakeUpGroup(entry.group, { clock: due.clock, askedFor }) }
      : entry
  );
}

/**
 * The listed promises that are past due on the chain's clock, by id, for the app's "Past due"
 * pill (DL-110 as amended): nobody took them up and the chain is past their due date, so anyone
 * may expire them, which stays the cockpit's act. A promise whose due date is still unread, a
 * cycle's end not yet read or the chain's time not yet known, is never called past due.
 */
export function usePastDuePromises(input: {
  chainId: number;
  /** The pool whose cycles date the promises that fall due with a cycle; null while unknown. */
  poolId: bigint | null;
  commitments: readonly CommitmentReadModel[];
}): ReadonlySet<string> {
  const { chainId, poolId, commitments } = input;
  // Cycle ids belong to their pool, so a promise that falls due with its cycle is dated only by
  // this pool's cycles; one from another pool keeps no due date here rather than a wrong one.
  const datable = useMemo(
    () =>
      commitments.filter(
        (commitment) => !fallsDueWithItsCycle(commitment) || commitment.poolId === poolId
      ),
    [commitments, poolId]
  );
  const due = useDueClock({ chainId, poolId, commitments: datable });
  return useMemo(
    () =>
      new Set(
        datable
          .filter(
            (commitment) =>
              (commitment.derivedState === "OFFERED" || commitment.derivedState === "REQUESTED") &&
              isPastDue(commitment, due.clock)
          )
          .map((commitment) => commitment.id)
      ),
    [datable, due.clock]
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
