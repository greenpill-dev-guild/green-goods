/**
 * useCommitmentsToConfirm Hook
 *
 * What reaches a steward through their garden's Hat rather than through their
 * own account: commitments the garden itself must confirm.
 *
 * A garden is a party like any other. When it takes something up (a garden
 * claim) it is the counterparty; when it asked for something it is the
 * creator of a Request; when a commitment names it to confirm, it is in the
 * confirmer list. In every case the people who act for it are its steward
 * and owner Hat wearers, and none of those commitments appear in their
 * personal inbox, because the garden is the party, not the person.
 *
 * Two rules kept here so the tab and the header badge cannot drift:
 *
 * 1. **One act table.** A row is listed only when `selectCommitmentActKind`
 *    offers the garden a `confirm`, the same question the detail screen asks.
 * 2. **Nothing duplicates Live.** A commitment the reader is personally a
 *    party to already sits in their own inbox, so it is left out here even
 *    when the garden could also confirm it.
 *
 * The roster is not loaded at list scope, so a steward who is also on a
 * commitment's team is still listed; the detail screen, which holds the
 * roster, is where the contract's refusal of a contributor's confirmation is
 * drawn. Fallback confirmations (a reasoned steward step-in when nobody else
 * can confirm) are not selected here.
 *
 * @module hooks/commitment-pooling/useCommitmentsToConfirm
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import { selectCommitmentActKind } from "../../modules/commitment-pooling/acts";
import { getCommitments } from "../../modules/commitment-pooling/data";
import { selectCommitmentSeat } from "../../modules/commitment-pooling/selectors";
import type { CommitmentReadModel } from "../../modules/commitment-pooling/types";
import type { Address, Garden } from "../../types/domain";
import { useGardens } from "../blockchain/useBaseLists";
import { useGardenPermissions } from "../garden/useGardenPermissions";
import { useCommitmentPoolingAvailability } from "./useCommitmentPoolingAvailability";
import type { InboxCommitment } from "./useCommitmentsInbox";

/** The garden's own read of a commitment, as the party its stewards act for. */
export interface ToConfirmGroup {
  garden: Address;
  gardenName: string;
  /**
   * Seated as the garden, so each row's act is the garden's confirm and
   * `needsYou` means "needs this garden". The row renders with the same
   * grammar as the personal inbox.
   */
  rows: InboxCommitment[];
}

export interface CommitmentsToConfirm {
  groups: ToConfirmGroup[];
  /** Rows across every garden: the tab's badge. */
  count: number;
  /** The reader stewards at least one garden. The tab exists only then. */
  isSteward: boolean;
  availability: ReturnType<typeof useCommitmentPoolingAvailability>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

/**
 * Whether the reader is personally a party. Without the roster this answers
 * for the named parties only, which is what the personal inbox lists.
 */
function isPersonalParty(commitment: CommitmentReadModel, viewer: Address): boolean {
  const seat = selectCommitmentSeat({ commitment, contributors: [], viewer });
  return seat !== null && seat !== "bystander";
}

export function useCommitmentsToConfirm({
  chainId,
  viewer,
}: {
  chainId: number;
  viewer?: Address;
}): CommitmentsToConfirm {
  const availability = useCommitmentPoolingAvailability({ chainId });
  const { data: gardens = [] } = useGardens(chainId);
  const { canManageGarden } = useGardenPermissions();

  const stewarded = useMemo<Garden[]>(
    () => (viewer ? gardens.filter((garden) => canManageGarden(garden)) : []),
    [gardens, viewer, canManageGarden]
  );

  // One query per garden, each under the registry key the garden-scoped list
  // would use anyway, so a pool tab that already read it shares the cache.
  const queries = useQueries({
    queries: stewarded.map((garden) => {
      const input = {
        chainId,
        account: garden.id as Address,
        state: "READY_FOR_CONFIRMATION",
      };
      return {
        queryKey: queryKeys.commitmentPooling.commitments(chainId, input),
        queryFn: () => getCommitments(input),
        enabled: availability.status === "available",
        staleTime: STALE_TIME_MEDIUM,
      };
    }),
  });

  const groups = useMemo<ToConfirmGroup[]>(() => {
    if (!viewer) return [];
    const result: ToConfirmGroup[] = [];
    stewarded.forEach((garden, index) => {
      const gardenAddress = garden.id as Address;
      const rows: InboxCommitment[] = [];
      for (const commitment of queries[index]?.data ?? []) {
        if (isPersonalParty(commitment, viewer)) continue;
        // Seated as the steward of this garden, which is how the detail
        // screen will seat them too; the garden's own address is the party.
        const seat = selectCommitmentSeat({
          commitment,
          contributors: [],
          viewer,
          stewardedGardens: [gardenAddress],
        });
        if (selectCommitmentActKind({ commitment, seat }) !== "confirm") continue;
        rows.push({ commitment, seat, needsYou: true });
      }
      rows.sort((left, right) =>
        Number(right.commitment.commitmentId - left.commitment.commitmentId)
      );
      if (rows.length > 0) result.push({ garden: gardenAddress, gardenName: garden.name, rows });
    });
    return result;
  }, [stewarded, queries, viewer]);

  return {
    groups,
    count: groups.reduce((sum, group) => sum + group.rows.length, 0),
    isSteward: stewarded.length > 0,
    availability,
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
