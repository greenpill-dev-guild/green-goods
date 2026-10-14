/**
 * The shapes the confirmation queue is read in: a garden's own group, the
 * rows only a steward's fallback can still confirm, and the disputed records
 * of the reader's pools, each with the pool it actually lives in. Split out of
 * `useCommitmentsToConfirm`, which is at its source-structure cap; the hook
 * re-exports every name.
 */

import type { CommitmentReadModel } from "../../modules/commitment-pooling/types";
import type { Address } from "../../types/domain";
import type { useCommitmentPoolingAvailability } from "./useCommitmentPoolingAvailability";
import type { InboxCommitment } from "./useCommitmentsInbox";

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
   * That garden's name, so a row can say which pool a commitment lives in when
   * it is not the confirming garden's own. Null while the gardens list is unread.
   */
  poolGardenName?: string | null;
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
