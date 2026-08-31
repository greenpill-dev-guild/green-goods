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
 * The roster is not loaded at list scope, so team membership is read from the
 * viewer's own account-scoped set instead: that query already resolves active
 * contributors, and the contract refuses a contributor's confirmation with
 * `SelfConfirmation`. A row the viewer is on is therefore neither listed nor
 * marked as needing them.
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
 * **Pool authority is a separate question.** A garden confirms as a party
 * wherever its commitment lives, while `raiseDispute` and `resolveDispute`
 * admit only a steward of the pool's own garden (`GuardLib.isPoolSteward`), so
 * every row names its pool's garden beside the authority garden and says
 * plainly whether this reader may dispute it. That also makes disputed rows
 * readable: a dispute freezes the record out of `READY_FOR_CONFIRMATION`, so
 * each stewarded pool is read for them too rather than dropping the record
 * the moment it needs a steward most.
 *
 * @module hooks/commitment-pooling/useCommitmentsToConfirm
 */

import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { selectCommitmentActKind } from "../../modules/commitment-pooling/acts";
import {
  getCommitments,
  getFallbackConfirmationCandidates,
  getViewerConfirmedCommitmentIds,
} from "../../modules/commitment-pooling/data";
import {
  selectCommitmentSeat,
  selectConfirmationEligibility,
} from "../../modules/commitment-pooling/selectors";
import { selectOrdinaryConfirmationReachable } from "../../modules/commitment-pooling/steward-selectors";
import type {
  CommitmentReadModel,
  FallbackConfirmationCandidate,
} from "../../modules/commitment-pooling/types";
import type { Address, Garden } from "../../types/domain";
import { useGardens } from "../blockchain/useBaseLists";
import { useGardenPermissions } from "../garden/useGardenPermissions";
import { useCommitmentPoolingAvailability } from "./useCommitmentPoolingAvailability";
import { useCommitmentPools } from "./useCommitmentPooling";
import type { InboxCommitment } from "./useCommitmentsInbox";
import { useProtocolPool } from "./useProtocolPool";

/**
 * Which pool a row belongs to, and what that lets this reader do to it. Both
 * fields are optional so a fixture may leave them out; every row this hook
 * builds states them outright.
 */
export interface ToConfirmPoolAuthority {
  /**
   * The garden that owns the commitment's pool, which is not always the garden
   * whose authority confirms. Null when the pools read has not answered.
   */
  poolGarden?: Address | null;
  /**
   * The reader currently stewards that pool's garden, the only authority
   * `TerminalLib.raiseDispute` and `resolveDispute` accept here.
   */
  canDispute?: boolean;
}

/** One commitment in a garden's group, with the pool it actually lives in. */
export interface ToConfirmRow extends InboxCommitment, ToConfirmPoolAuthority {}

/** The garden's own read of a commitment, as the party its stewards act for. */
export interface ToConfirmGroup {
  garden: Address;
  gardenName: string;
  /**
   * Seated as the garden, so each row's act is the garden's confirm and
   * `needsYou` means "needs this garden". The row renders with the same
   * grammar as the personal inbox.
   */
  rows: ToConfirmRow[];
}

/** A commitment only a steward's reasoned fallback can still confirm. */
export interface ToConfirmFallbackRow extends ToConfirmPoolAuthority {
  commitment: CommitmentReadModel;
  path: "POOL_FALLBACK" | "PROTOCOL_FALLBACK";
  /** The garden whose steward authority the act would use. */
  garden: Address;
  gardenName: string;
  activeContributors: Address[];
}

/** A frozen record waiting on the pool steward who may resolve the dispute. */
export interface ToConfirmDisputedRow {
  commitment: CommitmentReadModel;
  /** The pool's garden, which is the authority `resolveDispute` requires. */
  garden: Address;
  gardenName: string;
}

export interface CommitmentsToConfirm {
  groups: ToConfirmGroup[];
  fallback: ToConfirmFallbackRow[];
  /**
   * Disputed records in the reader's own pools. Optional so a fixture may
   * leave it out; this hook always answers with an array.
   */
  disputed?: ToConfirmDisputedRow[];
  /** Rows across every garden — ordinary, fallback and disputed: the badge. */
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

  // The viewer's own set, which the account query resolves through the
  // contributor roster as well as the named party fields. It is what tells a
  // list-scope read that the steward is on a commitment's team.
  const ownInput = useMemo(() => ({ chainId, account: viewer as Address }), [chainId, viewer]);
  const own = useQuery({
    queryKey: commitmentPoolingKeys.commitments(chainId, ownInput),
    queryFn: () => getCommitments(ownInput),
    // Only a steward has a tab to fill, so a plain member never asks at all.
    enabled: availability.status === "available" && Boolean(viewer) && stewarded.length > 0,
    staleTime: STALE_TIME_MEDIUM,
  });
  const ownIds = useMemo(
    () => new Set((own.data ?? []).map((row) => row.commitmentId.toString())),
    [own.data]
  );

  // What this reader already signed. `ConfirmLib.confirmFulfillment` records
  // the confirmer and reverts `AlreadyConfirmed` on a repeat, and a threshold
  // above one keeps the record ready in between, so without this the same row
  // would be offered again with a transaction the chain refuses.
  const confirmed = useQuery({
    queryKey: commitmentPoolingKeys.activity(chainId, {
      actor: viewer,
      eventType: "CONFIRMATION_RECORDED",
    }),
    queryFn: () => getViewerConfirmedCommitmentIds({ chainId, viewer: viewer as Address }),
    enabled: availability.status === "available" && Boolean(viewer) && stewarded.length > 0,
    staleTime: STALE_TIME_MEDIUM,
  });
  const confirmedIds = useMemo(() => new Set(confirmed.data ?? []), [confirmed.data]);

  // Which garden owns which pool. Confirmation authority and pool authority
  // are different questions, and only the pool's garden may dispute or
  // resolve (`GuardLib.isPoolSteward`), so the queue reads the registered
  // pools once rather than guessing from the confirming garden.
  const poolsQuery = useCommitmentPools({ chainId });
  const { poolGardens, stewardedSet } = useMemo(() => {
    const poolGardens = new Map<string, Address>();
    for (const pool of poolsQuery.pools) {
      if (pool.garden) poolGardens.set(pool.poolId.toString(), pool.garden);
    }
    return {
      poolGardens,
      stewardedSet: new Set(stewarded.map((garden) => garden.id.toLowerCase())),
    };
  }, [poolsQuery.pools, stewarded]);

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
        queryKey: commitmentPoolingKeys.commitments(chainId, input),
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
          queryKey: commitmentPoolingKeys.fallbackCandidates(chainId, input),
          queryFn: () => getFallbackConfirmationCandidates(input),
          enabled: availability.status === "available",
          staleTime: STALE_TIME_MEDIUM,
        };
      }),
      ...(readProtocol
        ? [
            {
              queryKey: commitmentPoolingKeys.fallbackCandidates(chainId, {
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

  // Disputed records live in the pools this reader stewards, one query per
  // pool. A dispute freezes the record out of the ready state both reads
  // above ask for, and only this pool's steward may resolve it.
  const disputedScopes = useMemo(
    () =>
      poolsQuery.pools
        .filter((pool) => pool.garden && stewardedSet.has(pool.garden.toLowerCase()))
        .map((pool) => ({
          poolId: pool.poolId,
          garden: stewarded.find((garden) => isSameGarden(pool.garden, garden.id as Address)),
        }))
        .filter((scope): scope is { poolId: bigint; garden: Garden } => scope.garden !== undefined),
    [poolsQuery.pools, stewardedSet, stewarded]
  );
  const disputedQueries = useQueries({
    queries: disputedScopes.map((scope) => {
      const input = { chainId, poolId: scope.poolId, state: "DISPUTED" };
      return {
        queryKey: commitmentPoolingKeys.commitments(chainId, input),
        queryFn: () => getCommitments(input),
        enabled: availability.status === "available",
        staleTime: STALE_TIME_MEDIUM,
      };
    }),
  });

  const { groups, fallback, disputed } = useMemo(() => {
    if (!viewer) {
      return {
        groups: [] as ToConfirmGroup[],
        fallback: [] as ToConfirmFallbackRow[],
        disputed: [] as ToConfirmDisputedRow[],
      };
    }
    // Where this commitment's pool lives, and whether that pool is one this
    // reader stewards — the only authority the dispute calls accept.
    const poolAuthority = (commitment: CommitmentReadModel): ToConfirmPoolAuthority => {
      const poolGarden =
        commitment.poolId === null || commitment.poolId === undefined
          ? null
          : (poolGardens.get(commitment.poolId.toString()) ?? null);
      return {
        poolGarden,
        canDispute: poolGarden !== null && stewardedSet.has(poolGarden.toLowerCase()),
      };
    };
    const groups: ToConfirmGroup[] = [];
    const ordinaryIds = new Set<string>();
    stewarded.forEach((garden, index) => {
      const gardenAddress = garden.id as Address;
      const rows: ToConfirmRow[] = [];
      for (const commitment of ordinaryQueries[index]?.data ?? []) {
        if (isPersonalParty(commitment, viewer)) continue;
        // Already in the reader's own set: they are a named party or on the
        // team. Live carries it, and a contributor's confirmation reverts.
        if (ownIds.has(commitment.commitmentId.toString())) continue;
        // Already signed by this reader. The record stays ready until the
        // threshold is met, and a second confirmation reverts AlreadyConfirmed.
        if (confirmedIds.has(commitment.commitmentId.toString())) continue;
        // Seated as the steward of this garden, which is how the detail
        // screen will seat them too; the garden's own address is the party.
        const seat = selectCommitmentSeat({
          commitment,
          contributors: [],
          viewer,
          stewardedGardens: [gardenAddress],
        });
        if (selectCommitmentActKind({ commitment, seat }) !== "confirm") continue;
        rows.push({ commitment, seat, needsYou: true, ...poolAuthority(commitment) });
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
        // A fallback confirmation fulfils outright and `confirmFulfillmentAsFallback`
        // keeps no per-confirmer record, so an earlier ordinary signature from
        // this reader does not close the fallback path to them.
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
        ...poolAuthority(commitment),
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

    // Disputed rows are the pool steward's to resolve. Being a party neither
    // grants that authority nor removes it, and Live carries no Resolve, so
    // unlike a confirmation these are not left out for the reader's own set.
    const disputed: ToConfirmDisputedRow[] = [];
    const disputedIds = new Set<string>();
    disputedScopes.forEach((scope, index) => {
      for (const commitment of disputedQueries[index]?.data ?? []) {
        if (commitment.onchainState !== "DISPUTED" || disputedIds.has(commitment.id)) continue;
        disputedIds.add(commitment.id);
        disputed.push({
          commitment,
          garden: scope.garden.id as Address,
          gardenName: scope.garden.name,
        });
      }
    });
    disputed.sort((left, right) =>
      Number(right.commitment.commitmentId - left.commitment.commitmentId)
    );
    return { groups, fallback, disputed };
  }, [
    stewarded,
    ordinaryQueries,
    fallbackQueries,
    disputedQueries,
    disputedScopes,
    viewer,
    readProtocol,
    protocolGarden,
    ownIds,
    confirmedIds,
    poolGardens,
    stewardedSet,
  ]);

  const queries = [...ordinaryQueries, ...fallbackQueries, ...disputedQueries];
  return {
    groups,
    fallback,
    disputed,
    count:
      groups.reduce((sum, group) => sum + group.rows.length, 0) + fallback.length + disputed.length,
    isSteward: stewarded.length > 0,
    isProtocolSteward: protocolGarden !== null,
    availability,
    // The reader's own set is part of the answer: while it is missing, a
    // steward on a team could be listed and offered a confirmation that
    // reverts. So it loads, fails and refetches with the garden reads, and
    // with the protocol-pool read the fallback group is derived from. The
    // signatures this reader already gave and the pool-to-garden map answer
    // the same kind of question — without them the queue would offer a
    // repeat confirmation or a dispute the pool refuses — so they ride along.
    isLoading:
      own.isLoading ||
      confirmed.isLoading ||
      poolsQuery.isLoading ||
      protocolPool.isLoading ||
      queries.some((q) => q.isLoading),
    isError:
      own.isError ||
      confirmed.isError ||
      poolsQuery.isError ||
      queries.some((query) => query.isError),
    refetch: () =>
      Promise.all([
        own.refetch(),
        confirmed.refetch(),
        poolsQuery.refetch(),
        ...queries.map((query) => query.refetch()),
      ]),
  };
}
