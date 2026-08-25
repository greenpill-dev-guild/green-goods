/**
 * The steward side of the pool console: who may act, what is past due and
 * still live, and whether an ordinary confirmer can still be reached. Split
 * out of `selectors.ts`, which is at its source-structure cap.
 */
import type { Address } from "../../types/domain";
import { isSameAccount } from "./selectors";
import type { CommitmentReadModel } from "./types";

/**
 * The garden roles that make someone a pool steward: the steward or owner
 * Hat of the pool's garden (`ICommitmentPoolingModule.sol` "pool steward
 * (garden steward/owner via hatsModule)" — `steward` is that contract's
 * wire name for the steward Hat). Module ownership is a separate fallback
 * the contract grants; it is not a role this predicate sees.
 */
export function isPoolSteward(roles: readonly string[]): boolean {
  return roles.includes("steward") || roles.includes("owner");
}

/** The four states `expireCommitment` accepts (TerminalLib.sol:62-69). */
const EXPIRABLE_STATES = new Set<string>([
  "OFFERED",
  "REQUESTED",
  "ACCEPTED",
  "READY_FOR_CONFIRMATION",
]);

/**
 * Live commitments the chain would let anyone expire: one of the four
 * expirable states, and strictly past its own due date or, when it carries
 * none, its cycle's end (TerminalLib.sol:71-72, `_effectiveDueDate`). A
 * cycle-less, undated commitment is never due.
 *
 * Past due alone never renders Expired: the row stays live until the indexer
 * shows the Expired state, which is why this returns the live rows rather
 * than relabelling them.
 */
export function selectDueLiveCommitments<
  T extends Pick<CommitmentReadModel, "onchainState" | "cycleId" | "dueDate">,
>(input: {
  commitments: readonly T[];
  /** Decimal cycle id → `endTime`, from the cycles already loaded. */
  cycleEndTimes: ReadonlyMap<string, bigint | null>;
  /** Unix seconds. */
  now: bigint;
}): T[] {
  return input.commitments.filter((commitment) => {
    if (!EXPIRABLE_STATES.has(commitment.onchainState)) return false;
    const due =
      commitment.dueDate !== null && commitment.dueDate !== undefined && commitment.dueDate !== 0n
        ? commitment.dueDate
        : commitment.cycleId !== null && commitment.cycleId !== 0n
          ? (input.cycleEndTimes.get(commitment.cycleId.toString()) ?? null)
          : null;
    return due !== null && due !== 0n && input.now > due;
  });
}

/**
 * The earliest moment a live commitment becomes past due, or null when none
 * will. `selectDueLiveCommitments` answers against a fixed `now`, so a console
 * left open would never notice a row falling due; this is what it schedules
 * against instead of polling.
 */
export function selectNextDueBoundary<
  T extends Pick<CommitmentReadModel, "onchainState" | "cycleId" | "dueDate">,
>(input: {
  commitments: readonly T[];
  cycleEndTimes: ReadonlyMap<string, bigint | null>;
  now: bigint;
}): bigint | null {
  let next: bigint | null = null;
  for (const commitment of input.commitments) {
    if (!EXPIRABLE_STATES.has(commitment.onchainState)) continue;
    const due =
      commitment.dueDate !== null && commitment.dueDate !== undefined && commitment.dueDate !== 0n
        ? commitment.dueDate
        : commitment.cycleId !== null && commitment.cycleId !== 0n
          ? (input.cycleEndTimes.get(commitment.cycleId.toString()) ?? null)
          : null;
    if (due === null || due === 0n || due <= input.now) continue;
    if (next === null || due < next) next = due;
  }
  return next;
}

/**
 * Whether the ordinary confirmation path can still reach threshold, the way
 * the contract decides before it allows a fallback
 * (CreditLib.sol:206-230, `ordinaryConfirmationReachable`):
 *
 * - a named group counts its members who are not on the active roster;
 * - a Request with no group is confirmed by its creator, unless they joined;
 * - an Offer taken up by a garden is always reachable (the garden's stewards);
 * - an Offer taken up by a person is reachable unless that person joined.
 *
 * No reachability field is indexed (schema.graphql:970-971 carries only the
 * group and the protocol flag), so the Confirm stage derives it here from the
 * record plus the roster.
 */
export function selectOrdinaryConfirmationReachable(input: {
  confirmers: readonly Address[];
  confirmationThreshold: number;
  direction: CommitmentReadModel["direction"];
  counterpartyKind: CommitmentReadModel["counterpartyKind"];
  creator: Address | null | undefined;
  counterparty: Address | null | undefined;
  activeContributors: readonly Address[];
}): boolean {
  const onRoster = (account: Address | null | undefined) =>
    account !== null &&
    account !== undefined &&
    input.activeContributors.some((contributor) => isSameAccount(contributor, account));
  if (input.confirmers.length > 0) {
    const eligible = input.confirmers.filter((confirmer) => !onRoster(confirmer)).length;
    return eligible >= input.confirmationThreshold;
  }
  if (input.direction === "REQUEST") return Boolean(input.creator) && !onRoster(input.creator);
  if (input.counterpartyKind === "GARDEN") return true;
  return Boolean(input.counterparty) && !onRoster(input.counterparty);
}

// The act-permission half lives beside this one for file-length reasons; it
// stays part of this module's surface so callers keep importing from one place.
export * from "./commitment-act-permissions";
