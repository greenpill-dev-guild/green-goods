import type { OntologyChainCapability } from "../../ontology/types";
import type { Address } from "../../types/domain";
import type {
  CommitmentDerivedState,
  CommitmentPoolingAvailability,
  CommitmentReadModel,
} from "./types";

export function selectCommitmentPoolingAvailability(
  capability: OntologyChainCapability | undefined
): CommitmentPoolingAvailability {
  if (!capability) return { status: "unknown-chain" };
  if (capability.deployment !== "deployed") {
    return { status: "unavailable", reason: "not-deployed", capability };
  }
  if (capability.activation !== "active") {
    return { status: "unavailable", reason: "not-activated", capability };
  }
  if (capability.integration !== "integrated" || capability.availability !== "available") {
    return { status: "unavailable", reason: "not-integrated", capability };
  }
  return { status: "available", capability };
}

export function selectSeenCommitments<T extends { creationSeen: boolean }>(
  rows: readonly T[]
): T[] {
  return rows.filter((row) => row.creationSeen);
}

/** Who is reading a commitment. Never inferred from a state id or a title. */
export type CommitmentSeat = "provider" | "confirmer" | "contributor" | "bystander";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Absent, empty and zero-address all mean "nobody", so none of them may match a viewer. */
function isSameAccount(left: Address | null | undefined, right: Address): boolean {
  if (!left || left === ZERO_ADDRESS) return false;
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Direction names the creator, so no fifth seat is needed: on an Offer they
 * provide, on a Request they receive and confirm.
 */
function creatorSeat(direction: CommitmentReadModel["direction"]): CommitmentSeat {
  return direction === "REQUEST" ? "confirmer" : "provider";
}

/**
 * Resolve the reader's relationship to a commitment.
 *
 * Returns null for an unauthenticated reader: they are not a bystander, and the
 * difference decides whether a screen offers acts at all. There is no default seat.
 *
 * The order is load-bearing and each rung exists for a measured reason:
 *
 * 1. `leadProvider` first, because the lead is also on the team roster
 *    (AcceptanceLib.sol:183-187 seeds them as contributor #1). A contributors-first
 *    test would seat every provider as a contributor.
 * 2. `creator` next, by direction. This covers a commitment nobody has taken up yet,
 *    where neither party address is written, AND the asker on an accepted Request:
 *    the contract stores the *taker* in `counterparty` on that direction
 *    (AcceptanceLib.sol:146,172), so the asker appears in no party field but `creator`
 *    and would otherwise fall through to bystander on their own request.
 * 3. `counterparty` next. On an Offer it is the person who took it up; on a
 *    Request rule 1 has already claimed them.
 * 4. the team, then the named confirmer group. A commitment may name people to
 *    confirm it who are none of the above (`setConfirmerRule`, kept on chain by
 *    `normalizeConfirmers`); without that rung they read as bystanders and are
 *    never offered the one act they exist to perform. It sits AFTER the team
 *    because the two lists can overlap and the contract refuses a contributor's
 *    confirmation whatever else they are.
 */
export function selectCommitmentSeat(input: {
  commitment: Pick<CommitmentReadModel, "creator" | "leadProvider" | "counterparty" | "direction"> &
    Partial<Pick<CommitmentReadModel, "confirmers">>;
  contributors: readonly Address[];
  viewer?: Address;
}): CommitmentSeat | null {
  const { commitment, contributors, viewer } = input;
  if (!viewer) return null;
  if (isSameAccount(commitment.leadProvider, viewer)) return "provider";
  if (isSameAccount(commitment.creator, viewer)) return creatorSeat(commitment.direction);
  if (isSameAccount(commitment.counterparty, viewer)) return "confirmer";
  // The team is checked BEFORE the named confirmer list, because the two can
  // overlap and the contract settles the tie the other way: ConfirmLib reverts
  // SelfConfirmation for any active contributor before it ever asks whether
  // they are an ordinary confirmer, and selectConfirmationEligibility refuses
  // them for the same reason. Seating such a person as confirmer would offer a
  // Confirm the chain will reject, which is worse than the bystander reading
  // this rung was added to fix.
  if (contributors.some((contributor) => isSameAccount(contributor, viewer))) {
    return "contributor";
  }
  if (commitment.confirmers?.some((confirmer) => isSameAccount(confirmer, viewer))) {
    return "confirmer";
  }
  return "bystander";
}

export function deriveCommitmentState(
  commitment: CommitmentReadModel,
  cycleState?: string | null
): CommitmentDerivedState {
  const onchain = commitment.onchainState;
  if (onchain === "DISPUTED" || onchain === "CANCELLED" || onchain === "EXPIRED") return onchain;
  if (
    onchain === "FULFILLED" &&
    commitment.cycleId !== null &&
    commitment.cycleId !== 0n &&
    (cycleState === "RECONCILED" || cycleState === "COMPOSTED")
  ) {
    return "RECONCILED";
  }
  if (onchain === "FULFILLED" || onchain === "READY_FOR_CONFIRMATION") return onchain;
  if (onchain === "ACCEPTED" && commitment.approvedUnits > 0n) return "PARTIALLY_APPROVED";
  if (onchain === "ACCEPTED" && commitment.evidenceCount > 0) return "EVIDENCE_SUBMITTED";
  if (onchain === "ACCEPTED") return "ACTIVE";
  return onchain;
}

export interface DeclaredValueSummary {
  declaredValueBasis: string;
  commitmentCount: number;
  declaredValue: bigint;
}

export function selectDeclaredValueSummaries(
  commitments: readonly CommitmentReadModel[]
): DeclaredValueSummary[] {
  const grouped = new Map<string, DeclaredValueSummary>();
  for (const commitment of commitments) {
    const basis = commitment.declaredValueBasis;
    const value = commitment.declaredUnitValue;
    if (!commitment.creationSeen || !basis || value === null || value <= 0n) continue;
    const current = grouped.get(basis) ?? {
      declaredValueBasis: basis,
      commitmentCount: 0,
      declaredValue: 0n,
    };
    current.commitmentCount += 1;
    current.declaredValue += value * commitment.targetUnits;
    grouped.set(basis, current);
  }
  return [...grouped.values()].sort((left, right) =>
    left.declaredValueBasis < right.declaredValueBasis
      ? -1
      : left.declaredValueBasis > right.declaredValueBasis
        ? 1
        : 0
  );
}

export function parseHypercertBundle(input: {
  bundleKind?: string | null;
  metadataReconciliationRequired: boolean;
}): { status: "metadata-pending" } | { status: "ready"; bundleKind: "WORK_LEGACY" | "COMMITMENT" } {
  if (input.metadataReconciliationRequired) return { status: "metadata-pending" };
  return {
    status: "ready",
    bundleKind: input.bundleKind === "COMMITMENT" ? "COMMITMENT" : "WORK_LEGACY",
  };
}

export type CommitmentReadinessBlocker =
  | "wrong-state"
  | "pool-not-open"
  | "cycle-not-open"
  | "requirements-incomplete"
  | "evidence-required"
  | "assessment-required"
  | "verified-credit-required"
  | "linked-work-stale"
  | "confirmation-unreachable";

export function selectCommitmentReadiness(input: {
  state: string;
  commitmentKind: "DOMAIN_IMPACT" | "SUPPORT_SERVICE" | "STEWARD_CAPTURED" | "SEASON_CAMPAIGN";
  poolOpen: boolean;
  cycleId: bigint | null;
  cycleState?: string | null;
  requirements: readonly { requiredCount: number; approvedCount: number }[];
  evidenceCount: number;
  requiresAssessment: boolean;
  assessmentUID?: string | null;
  totalVerifiedCredits: number;
  linkedWorkFresh: boolean;
  ordinaryConfirmationReachable: boolean;
  protocolFallbackEnabled: boolean;
  protocolPoolRegistered: boolean;
  override?: boolean;
}): { ready: boolean; blockers: CommitmentReadinessBlocker[] } {
  const blockers: CommitmentReadinessBlocker[] = [];
  if (input.state !== "ACCEPTED") blockers.push("wrong-state");
  if (!input.poolOpen) blockers.push("pool-not-open");
  if (input.cycleId !== null && input.cycleId !== 0n && input.cycleState !== "OPEN") {
    blockers.push("cycle-not-open");
  }
  if (!input.override) {
    if (input.commitmentKind === "DOMAIN_IMPACT") {
      if (
        input.requirements.length === 0 ||
        input.requirements.some(
          (requirement) =>
            requirement.requiredCount <= 0 || requirement.approvedCount < requirement.requiredCount
        )
      ) {
        blockers.push("requirements-incomplete");
      }
    } else if (input.requirements.length > 0 || input.evidenceCount < 1) {
      blockers.push("evidence-required");
    }
  }
  if (input.requiresAssessment && !hasNonZeroIdentity(input.assessmentUID)) {
    blockers.push("assessment-required");
  }
  if (input.totalVerifiedCredits <= 0) blockers.push("verified-credit-required");
  if (!input.linkedWorkFresh) blockers.push("linked-work-stale");
  if (
    !input.ordinaryConfirmationReachable &&
    !(input.protocolFallbackEnabled && input.protocolPoolRegistered)
  ) {
    blockers.push("confirmation-unreachable");
  }
  return { ready: blockers.length === 0, blockers };
}

export function selectRequirementProgress(
  requirements: readonly {
    requirementIndex: number;
    requiredCount: number;
    approvedCount: number;
  }[]
) {
  return requirements.map((requirement) => ({
    ...requirement,
    approvedForProgress: Math.min(requirement.approvedCount, requirement.requiredCount),
    complete:
      requirement.requiredCount > 0 && requirement.approvedCount >= requirement.requiredCount,
  }));
}

export type ClaimPreflightBlocker =
  | "wrong-state"
  | "creator-cannot-claim"
  | "garden-claim-disabled-in-garden-pool"
  | "creator-operated-garden"
  | "protocol-self-target";

export function selectClaimPreflight(input: {
  state: string;
  creator: Address;
  claimant: Address;
  claimType: "GARDEN" | "INDIVIDUAL";
  poolType: "GARDEN" | "PROTOCOL";
  gardenContext?: Address | null;
  creatorOperatesGarden?: boolean;
  protocolGarden?: Address | null;
}): { allowed: boolean; blockers: ClaimPreflightBlocker[] } {
  const blockers: ClaimPreflightBlocker[] = [];
  if (input.state !== "OFFERED" && input.state !== "REQUESTED") blockers.push("wrong-state");
  if (input.creator.toLowerCase() === input.claimant.toLowerCase()) {
    blockers.push("creator-cannot-claim");
  }
  if (input.claimType === "GARDEN" && input.poolType === "GARDEN") {
    blockers.push("garden-claim-disabled-in-garden-pool");
  }
  if (input.claimType === "GARDEN" && input.creatorOperatesGarden) {
    blockers.push("creator-operated-garden");
  }
  if (
    input.claimType === "GARDEN" &&
    input.gardenContext &&
    input.protocolGarden &&
    input.gardenContext.toLowerCase() === input.protocolGarden.toLowerCase()
  ) {
    blockers.push("protocol-self-target");
  }
  return { allowed: blockers.length === 0, blockers };
}

export function selectContributorRemoval(input: {
  active: boolean;
  isLead: boolean;
  approvedWorkCredits: number;
  evidenceCredits: number;
  uncountedLinkedWorkCount: number;
  rosterFrozen: boolean;
}) {
  const blockers = [
    ...(!input.active ? ["not-active" as const] : []),
    ...(input.isLead ? ["lead-provider" as const] : []),
    ...(input.approvedWorkCredits > 0 ? ["approved-work-credit" as const] : []),
    ...(input.evidenceCredits > 0 ? ["evidence-credit" as const] : []),
    ...(input.uncountedLinkedWorkCount > 0 ? ["linked-work" as const] : []),
    ...(input.rosterFrozen ? ["roster-frozen" as const] : []),
  ];
  return { allowed: blockers.length === 0, blockers };
}

export function selectConfirmationEligibility(input: {
  state: string;
  viewer?: Address;
  contributors: readonly Address[];
  alreadyConfirmed: boolean;
  ordinaryEligible: boolean;
  ordinaryReachable: boolean;
  localFallbackSteward: boolean;
  protocolFallbackSteward: boolean;
  protocolFallbackEnabled: boolean;
}) {
  if (!input.viewer) return { allowed: false, path: null, reason: "unauthenticated" } as const;
  if (input.state !== "READY_FOR_CONFIRMATION") {
    return { allowed: false, path: null, reason: "wrong-state" } as const;
  }
  if (input.contributors.some((address) => address.toLowerCase() === input.viewer!.toLowerCase())) {
    return { allowed: false, path: null, reason: "contributor" } as const;
  }
  if (input.alreadyConfirmed) {
    return { allowed: false, path: null, reason: "already-confirmed" } as const;
  }
  if (input.ordinaryEligible) return { allowed: true, path: "ORDINARY", reason: null } as const;
  if (!input.ordinaryReachable && input.localFallbackSteward) {
    return { allowed: true, path: "POOL_FALLBACK", reason: null } as const;
  }
  if (!input.ordinaryReachable && input.protocolFallbackEnabled && input.protocolFallbackSteward) {
    return { allowed: true, path: "PROTOCOL_FALLBACK", reason: null } as const;
  }
  return { allowed: false, path: null, reason: "not-eligible" } as const;
}

export function selectCycleDerivedState(input: {
  state: string;
  endTime?: bigint | null;
  now: bigint;
  liveCommitmentCount: bigint;
  readyCommitmentCount: bigint;
}): string {
  if (input.state !== "OPEN") return input.state;
  if (
    (input.endTime !== null && input.endTime !== undefined && input.now > input.endTime) ||
    (input.liveCommitmentCount > 0n && input.liveCommitmentCount === input.readyCommitmentCount)
  ) {
    return "REVIEWING";
  }
  return "IN_PROGRESS";
}

export function selectPoolClosureEligibility(input: {
  liveCommitmentCount: bigint;
  nonTerminalCycleCount: bigint;
}) {
  return {
    allowed: input.liveCommitmentCount === 0n && input.nonTerminalCycleCount === 0n,
    blockers: [
      ...(input.liveCommitmentCount > 0n ? ["live-commitments" as const] : []),
      ...(input.nonTerminalCycleCount > 0n ? ["non-terminal-cycles" as const] : []),
    ],
  };
}

export function selectHypercertCycleEligibility(input: {
  cycleId: bigint;
  cycleState: string;
  commitmentStates: readonly string[];
}) {
  const blockers = [
    ...(input.cycleId === 0n ? ["cycle-required" as const] : []),
    ...(input.cycleState !== "RECONCILED" ? ["cycle-not-reconciled" as const] : []),
    ...(input.commitmentStates.length === 0 ||
    input.commitmentStates.some((state) => state !== "FULFILLED")
      ? ["unfulfilled-commitment" as const]
      : []),
  ];
  return { allowed: blockers.length === 0, blockers };
}

function hasNonZeroIdentity(value?: string | null): boolean {
  return Boolean(value && !/^0x0+$/.test(value));
}
