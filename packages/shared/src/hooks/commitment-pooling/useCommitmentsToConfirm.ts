/**
 * useCommitmentsToConfirm Hook
 *
 * What reaches a steward through their garden's Hat rather than through their
 * own account: commitments the garden itself must confirm, and commitments
 * nobody on the ordinary path can confirm any more, where the steward may
 * step in with a reason.
 *
 * **Ordinary.** A garden is a party like any other. When it takes something
 * up (a garden claim) it is the counterparty; when it asked for something it
 * is the creator of a Request; when a commitment names it to confirm, it is
 * in the confirmer list. In every case the people who act for it are its
 * steward and owner Hat wearers, and none of those commitments appear in
 * their personal inbox, because the garden is the party, not the person.
 *
 * Two rules kept here so the tab and the header badge cannot drift:
 *
 * 1. **One act table.** A row is listed only when `selectCommitmentActKind`
 *    offers the garden a `confirm`, the same question the detail screen asks.
 * 2. **Nothing duplicates Live.** A commitment the reader is personally a
 *    party to already sits in their own inbox, so it is left out here even
 *    when the garden could also confirm it.
 *
 * **Fallback.** The contract lets a current steward of the commitment's own
 * garden confirm with a reason once the ordinary path can no longer reach
 * threshold (every named confirmer, or the default confirmer, has joined the
 * team), and a current steward of the protocol garden do the same for a
 * commitment that opted in (`confirmFulfillmentAsFallback`). No reachability
 * field is indexed, so the group is derived here from the record and the
 * active roster, through `selectOrdinaryConfirmationReachable` and
 * `selectConfirmationEligibility`. Local authority is tested first, so a
 * steward holding both renders the garden path. The protocol queue is read
 * only when a caller asks for it, because it lists rows from other gardens.
 *
 * @module hooks/commitment-pooling/useCommitmentsToConfirm
 */

import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { queryKeys, STALE_TIME_MEDIUM } from "../../config/query-keys";
import { selectCommitmentActKind } from "../../modules/commitment-pooling/acts";
import {
  getCommitments,
  getFallbackConfirmationCandidates,
} from "../../modules/commitment-pooling/data";
import {
  selectCommitmentSeat,
  selectConfirmationEligibility,
  selectOrdinaryConfirmationReachable,
} from "../../modules/commitment-pooling/selectors";
import type {
  CommitmentReadModel,
  FallbackConfirmationCandidate,
} from "../../modules/commitment-pooling/types";
import type { Address, Garden } from "../../types/domain";
import { useGardens } from "../blockchain/useBaseLists";
import { useGardenPermissions } from "../garden/useGardenPermissions";
import { useCommitmentPoolingAvailability } from "./useCommitmentPoolingAvailability";
import type { InboxCommitment } from "./useCommitmentsInbox";
import { useProtocolPool } from "./useProtocolPool";

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

/** A commitment only a steward's reasoned fallback can still confirm. */
export interface ToConfirmFallbackRow {
  commitment: CommitmentReadModel;
  path: "POOL_FALLBACK" | "PROTOCOL_FALLBACK";
  /** The garden whose steward authority the act would use. */
  garden: Address;
  gardenName: string;
  activeContributors: Address[];
}

export interface CommitmentsToConfirm {
  groups: ToConfirmGroup[];
  fallback: ToConfirmFallbackRow[];
  /** Rows across every garden, ordinary and fallback: the tab's badge. */
  count: number;
  /** The reader stewards at least one garden. The tab exists only then. */
  isSteward: boolean;
  /** The reader stewards the registered protocol garden. */
  isProtocolSteward: boolean;
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

function isSameGarden(left: Address | null | undefined, right: Address): boolean {
  return Boolean(left) && left!.toLowerCase() === right.toLowerCase();
}

export function useCommitmentsToConfirm({
  chainId,
  viewer,
  includeProtocolFallback = false,
}: {
  chainId: number;
  viewer?: Address;
  /**
   * Also read the protocol stewards' queue: opted-in commitments from any
   * garden whose ordinary path is unreachable. Off unless the surface is the
   * protocol pool console, because those rows come from other gardens.
   */
  includeProtocolFallback?: boolean;
}): CommitmentsToConfirm {
  const availability = useCommitmentPoolingAvailability({ chainId });
  const { data: gardens = [] } = useGardens(chainId);
  const { canManageGarden } = useGardenPermissions();
  const protocolPool = useProtocolPool({ chainId });

  const { stewarded, protocolGarden } = useMemo(() => {
    const stewarded: Garden[] = viewer ? gardens.filter((garden) => canManageGarden(garden)) : [];
    const root = protocolPool.rootGarden;
    const protocolGarden =
      root && stewarded.some((garden) => isSameGarden(garden.id as Address, root))
        ? (stewarded.find((garden) => isSameGarden(garden.id as Address, root)) ?? null)
        : null;
    return { stewarded, protocolGarden };
  }, [gardens, viewer, canManageGarden, protocolPool.rootGarden]);

  // One query per garden, each under the registry key the garden-scoped list
  // would use anyway, so a pool tab that already read it shares the cache.
  const ordinaryQueries = useQueries({
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

  // The fallback candidates: every ready row of each stewarded garden's pool
  // with its roster, plus, when asked, every opted-in ready row on the chain.
  const readProtocol = includeProtocolFallback && protocolGarden !== null;
  const fallbackQueries = useQueries({
    queries: [
      ...stewarded.map((garden) => {
        const input = { chainId, garden: garden.id as Address };
        return {
          queryKey: queryKeys.commitmentPooling.fallbackCandidates(chainId, input),
          queryFn: () => getFallbackConfirmationCandidates(input),
          enabled: availability.status === "available",
          staleTime: STALE_TIME_MEDIUM,
        };
      }),
      ...(readProtocol
        ? [
            {
              queryKey: queryKeys.commitmentPooling.fallbackCandidates(chainId, {
                protocolFallbackEnabled: true,
              }),
              queryFn: () =>
                getFallbackConfirmationCandidates({ chainId, protocolFallbackEnabled: true }),
              enabled: availability.status === "available",
              staleTime: STALE_TIME_MEDIUM,
            },
          ]
        : []),
    ],
  });

  const { groups, fallback } = useMemo(() => {
    if (!viewer) return { groups: [] as ToConfirmGroup[], fallback: [] as ToConfirmFallbackRow[] };
    const groups: ToConfirmGroup[] = [];
    const ordinaryIds = new Set<string>();
    stewarded.forEach((garden, index) => {
      const gardenAddress = garden.id as Address;
      const rows: InboxCommitment[] = [];
      for (const commitment of ordinaryQueries[index]?.data ?? []) {
        if (isPersonalParty(commitment, viewer)) continue;
        const seat = selectCommitmentSeat({ commitment, contributors: [], viewer: gardenAddress });
        if (selectCommitmentActKind({ commitment, seat }) !== "confirm") continue;
        rows.push({ commitment, seat, needsYou: true });
        ordinaryIds.add(commitment.id);
      }
      rows.sort((left, right) =>
        Number(right.commitment.commitmentId - left.commitment.commitmentId)
      );
      if (rows.length > 0) groups.push({ garden: gardenAddress, gardenName: garden.name, rows });
    });

    const fallback: ToConfirmFallbackRow[] = [];
    const listed = new Set<string>();
    const consider = (
      candidate: FallbackConfirmationCandidate,
      authority: { garden: Garden; local: boolean }
    ) => {
      const { commitment, activeContributors } = candidate;
      if (listed.has(commitment.id) || ordinaryIds.has(commitment.id)) return;
      if (isPersonalParty(commitment, viewer)) return;
      const ordinaryReachable = selectOrdinaryConfirmationReachable({
        confirmers: commitment.confirmers,
        confirmationThreshold: commitment.confirmationThreshold ?? 0,
        direction: commitment.direction,
        counterpartyKind: commitment.counterpartyKind,
        creator: commitment.creator,
        counterparty: commitment.counterparty,
        activeContributors,
      });
      const eligibility = selectConfirmationEligibility({
        state: commitment.onchainState,
        viewer,
        contributors: activeContributors,
        // Not indexed per reader; the contract refuses a repeat confirmation.
        alreadyConfirmed: false,
        // Ordinary rows are listed above; this group answers for the fallback only.
        ordinaryEligible: false,
        ordinaryReachable,
        localFallbackSteward: authority.local,
        protocolFallbackSteward: !authority.local,
        protocolFallbackEnabled: commitment.protocolFallbackEnabled === true,
      });
      if (!eligibility.allowed || eligibility.path === null || eligibility.path === "ORDINARY") {
        return;
      }
      listed.add(commitment.id);
      fallback.push({
        commitment,
        path: eligibility.path,
        garden: authority.garden.id as Address,
        gardenName: authority.garden.name,
        activeContributors,
      });
    };
    // Local authority first, so a steward holding both renders the garden path.
    stewarded.forEach((garden, index) => {
      for (const candidate of fallbackQueries[index]?.data ?? []) {
        consider(candidate, { garden, local: true });
      }
    });
    if (readProtocol && protocolGarden) {
      for (const candidate of fallbackQueries[stewarded.length]?.data ?? []) {
        consider(candidate, { garden: protocolGarden, local: false });
      }
    }
    fallback.sort((left, right) =>
      Number(right.commitment.commitmentId - left.commitment.commitmentId)
    );
    return { groups, fallback };
  }, [stewarded, ordinaryQueries, fallbackQueries, viewer, readProtocol, protocolGarden]);

  const queries = [...ordinaryQueries, ...fallbackQueries];
  return {
    groups,
    fallback,
    count: groups.reduce((sum, group) => sum + group.rows.length, 0) + fallback.length,
    isSteward: stewarded.length > 0,
    isProtocolSteward: protocolGarden !== null,
    availability,
    isLoading: queries.some((query) => query.isLoading) || protocolPool.isLoading,
    isError: queries.some((query) => query.isError),
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
