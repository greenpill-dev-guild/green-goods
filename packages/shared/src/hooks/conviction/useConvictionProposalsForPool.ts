import { useMemo } from "react";
import type {
  ConvictionPoolConfig,
  ConvictionProposal,
  HypercertEntry,
} from "../../types/conviction";
import type { Address } from "../../types/domain";
import type { HypercertRecord } from "../../types/hypercerts";
import {
  deriveConvictionPercent,
  deriveDailyAccrual,
  deriveProposalStatus,
  deriveThreshold,
} from "../../utils/conviction";
import { useHypercerts } from "../hypercerts/useHypercerts";
import { useHypercertConviction } from "./useHypercertConviction";
import { useMemberVotingPower } from "./useMemberVotingPower";
import { useRegisteredHypercerts } from "./useRegisteredHypercerts";

interface UseConvictionProposalsForPoolOptions {
  enabled?: boolean;
  /**
   * Pool configuration values (decay rate, points-per-voter, member count).
   * The contract reads for these are TODO — pass a best-effort config until the
   * pool-config hook lands. The derivation utilities consume this to compute
   * threshold + dailyAccrual.
   */
  poolConfig?: ConvictionPoolConfig;
}

interface UseConvictionProposalsForPoolResult {
  proposals: ConvictionProposal[];
  isLoading: boolean;
  /** Aggregate of the underlying queries; true when any has errored. */
  hasError: boolean;
  /** Re-issued for direct consumers that want the underlying registry. */
  registeredHypercertIds: bigint[];
}

/**
 * Compose registered hypercerts + per-hypercert conviction weight + member
 * voting power + hypercert metadata into the percent-based ConvictionProposal[]
 * shape that ConvictionMeter / ProposalCardConviction consume.
 *
 * Audit finding #1 from the Tier-5 audit-then-ship pass.
 *
 * Indexer-lag handling for downstream mutations is already provided by
 * useAllocateHypercertSupport (uses useProgressiveInvalidation with
 * INDEXER_LAG_SCHEDULE_MS). This hook only reads — no extra lag handling
 * required (audit finding #10).
 */
export function useConvictionProposalsForPool(
  poolAddress?: Address,
  gardenId?: string,
  voterAddress?: Address,
  options: UseConvictionProposalsForPoolOptions = {}
): UseConvictionProposalsForPoolResult {
  const enabled = options.enabled ?? true;

  const registeredQuery = useRegisteredHypercerts(poolAddress, { enabled });
  const convictionQuery = useHypercertConviction(poolAddress, { enabled });
  const memberPowerQuery = useMemberVotingPower(poolAddress, voterAddress, {
    enabled: enabled && Boolean(voterAddress),
  });
  const hypercertsQuery = useHypercerts({ gardenId });

  const proposals = useMemo<ConvictionProposal[]>(() => {
    if (!registeredQuery.data || registeredQuery.data.length === 0) return [];

    const records = hypercertsQuery.hypercerts ?? [];
    const recordsByTokenId = new Map<string, HypercertRecord>();
    for (const record of records) {
      recordsByTokenId.set(record.tokenId.toString(), record);
    }

    const weightsByHypercertId = new Map<string, bigint>();
    for (const weight of convictionQuery.weights) {
      weightsByHypercertId.set(weight.hypercertId.toString(), weight.weight);
    }

    const memberAllocationsByHypercertId = new Map<string, bigint>();
    for (const allocation of memberPowerQuery.power.allocations) {
      memberAllocationsByHypercertId.set(allocation.hypercertId.toString(), allocation.amount);
    }

    const poolConfig = options.poolConfig ?? FALLBACK_POOL_CONFIG;

    return registeredQuery.data.map((hypercertId): ConvictionProposal => {
      const idKey = hypercertId.toString();
      const record = recordsByTokenId.get(idKey);
      const weight = { hypercertId, weight: weightsByHypercertId.get(idKey) ?? 0n };
      const memberAllocation = memberAllocationsByHypercertId.get(idKey) ?? 0n;

      const convictionPercent = deriveConvictionPercent(poolConfig, weight);
      const thresholdPercent = deriveThreshold(poolConfig, weight);
      const dailyAccrual = deriveDailyAccrual(poolConfig, memberAllocation);

      // No on-chain "active" flag exposed via existing hooks; default true since
      // the hypercert is in the registered list. Withdrawn/expired states are
      // derived from a future entry-state hook (TODO).
      const inferredEntry: Pick<HypercertEntry, "active"> = { active: true };
      const status = deriveProposalStatus(inferredEntry, convictionPercent, thresholdPercent);

      return {
        id: idKey,
        title: record?.title ?? `Hypercert ${shortHex(hypercertId)}`,
        summary: record?.description ?? "Registered conviction proposal",
        conviction: convictionPercent,
        threshold: thresholdPercent,
        dailyAccrual,
        supporters: countSupporters(weight.weight, poolConfig),
        status,
      };
    });
  }, [
    registeredQuery.data,
    convictionQuery.weights,
    memberPowerQuery.power.allocations,
    hypercertsQuery.hypercerts,
    options.poolConfig,
  ]);

  return {
    proposals,
    isLoading:
      registeredQuery.isLoading ||
      convictionQuery.isLoading ||
      memberPowerQuery.isLoading ||
      hypercertsQuery.isLoading,
    hasError: Boolean(
      registeredQuery.error ||
        convictionQuery.error ||
        memberPowerQuery.error ||
        hypercertsQuery.error
    ),
    registeredHypercertIds: registeredQuery.data ?? [],
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Conservative defaults — produces sensible numbers in solo gardens but
 * inflates conviction percent in multi-member ones (denominator =
 * pointsPerVoter * memberCount). See cleanup B1 in
 * .plans/active/admin-design-revamp/handoffs/claude-cleanup.md for the
 * concrete blocker analysis.
 *
 * Status of each field on the live HypercertSignalPool contract:
 * - decayRate     → readable via HYPERCERT_SIGNAL_POOL_ABI `decay()` view.
 * - pointsPerVoter → readable via HYPERCERT_SIGNAL_POOL_ABI `pointsPerVoter()` view.
 * - memberCount   → NOT readable on-chain. IVotingPowerRegistry only exposes
 *                   `isMember(account)` and per-member power queries; no
 *                   enumeration. Envio schema (packages/indexer/schema.graphql)
 *                   does not track conviction-pool membership either.
 *
 * Shipping decay + pointsPerVoter alone without a real memberCount would
 * leave the denominator wrong, so the partial hook is not landed here.
 * Retire this fallback when an enumeration source (new contract view OR
 * indexer entity) lands.
 */
const FALLBACK_POOL_CONFIG: ConvictionPoolConfig = {
  decayRate: 1n,
  pointsPerVoter: 100n,
  memberCount: 1,
};

function shortHex(value: bigint): string {
  const hex = value.toString(16);
  if (hex.length <= 8) return `0x${hex}`;
  return `0x${hex.slice(0, 4)}…${hex.slice(-4)}`;
}

/**
 * Approximate count of distinct supporters for a hypercert. Cleanup B2 tracked
 * this as deferred; investigation 2026-05-04 confirmed no source exists yet:
 * - HYPERCERT_SIGNAL_POOL_ABI's `getConvictionWeights()` returns the *aggregate*
 *   weight per hypercert (sum across all voters), not a per-voter breakdown.
 *   `getVoterAllocations(voter)` is per-voter but requires enumeration.
 * - Envio schema does not index VoterAllocation events.
 * Returns 1-or-0 until either a new contract view (e.g.,
 * `getHypercertSupporters(id)`) or an indexer entity (e.g., `Allocation`)
 * lands. See cleanup B2 in handoffs/claude-cleanup.md.
 */
function countSupporters(weight: bigint, _poolConfig: ConvictionPoolConfig): number {
  return weight > 0n ? 1 : 0;
}
