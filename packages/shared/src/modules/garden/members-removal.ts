import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import type { GardenMemberRow } from "./members-batch";

/**
 * What became of one person-and-role pair a steward asked to remove.
 *
 * - `removed`: the chain no longer gives them the role, from a confirmed send or from a read
 *   after a send that reported an error.
 * - `alreadyRemoved`: a read just before the wallet found the role gone, so nothing was sent.
 * - `refused`: a simulation found the chain would refuse it, so nothing was sent.
 * - `declined`: the wallet's prompt was declined. Nothing was sent.
 * - `failed`: something went wrong and a read shows they still hold the role.
 * - `unknown`: something went wrong and the read that would say whether it landed failed too.
 * - `notSent`: the run stopped before this pair.
 */
export type RoleRemovalOutcome =
  | { status: "removed"; transactionHash?: Hex }
  | { status: "alreadyRemoved" }
  | { status: "refused"; reason: string }
  | { status: "declined" }
  | { status: "failed"; reason?: string }
  | { status: "unknown" }
  | { status: "notSent" };

export type RoleRemovalStatus = RoleRemovalOutcome["status"];

/** What one removal returned: the shape the garden's role operations report. */
export interface RoleRemovalSendResult {
  success: boolean;
  hash?: Hex;
  error?: { name: string; message: string };
}

/** How a removal run reads and writes the chain. */
export interface RoleRemovalChain {
  /** Whether the person wears the role's exact hat. Throws when the read fails. */
  wearsRole(row: GardenMemberRow): Promise<boolean>;
  /** Why the chain would refuse removing this pair from the signer, or null when it would go. */
  refusal(row: GardenMemberRow): Promise<string | null>;
  /** Sends the removal and waits for it. One signature. */
  removeRole(row: GardenMemberRow): Promise<RoleRemovalSendResult>;
  /** A read proved the pair is gone without a confirmed send of ours: the roster can catch up. */
  onGone?(row: GardenMemberRow): void;
}

export interface RoleRemovalEvents {
  /** The wallet is about to ask for this pair. */
  onSending?(row: GardenMemberRow): void;
  onSettled?(row: GardenMemberRow, outcome: RoleRemovalOutcome): void;
}

/** What the steward can do with a run in hand. Answers line up with the rows asked about. */
export interface RoleRemovalApi {
  /** Who the removals are signed by, so a screen can keep that account's own access out of reach. */
  account?: Address | null;
  /** Whether each pair is still held: null where the read failed. */
  check(rows: readonly GardenMemberRow[]): Promise<(boolean | null)[]>;
  /** Removes each pair with its own signature, in order. */
  remove(
    rows: readonly GardenMemberRow[],
    events?: RoleRemovalEvents
  ): Promise<RoleRemovalOutcome[]>;
}

async function readHeld(chain: RoleRemovalChain, row: GardenMemberRow): Promise<boolean | null> {
  try {
    return await chain.wearsRole(row);
  } catch {
    return null;
  }
}

/** Reads every pair at once. A failed read is null, never a guess. */
export function readHeldRoles(
  rows: readonly GardenMemberRow[],
  chain: RoleRemovalChain
): Promise<(boolean | null)[]> {
  return Promise.all(rows.map((row) => readHeld(chain, row)));
}

/**
 * Removes each pair with its own signature, in the order given.
 *
 * Right before each signature the pair is read again: a role someone else already removed is
 * left out, because the chain would accept the removal anyway and charge for it. A pair the chain
 * would refuse is left out too, and the run goes on, since nothing was asked of the wallet. A
 * declined prompt stops the run. A send that reports an error is read once more: if the role is
 * gone it counted, and the run goes on; otherwise the rest wait for the steward to see what
 * happened before anything else is signed.
 */
export async function removeGardenRolesOneByOne(
  rows: readonly GardenMemberRow[],
  chain: RoleRemovalChain,
  { onSending, onSettled }: RoleRemovalEvents = {}
): Promise<RoleRemovalOutcome[]> {
  const outcomes: RoleRemovalOutcome[] = [];
  const settle = (row: GardenMemberRow, outcome: RoleRemovalOutcome) => {
    outcomes.push(outcome);
    onSettled?.(row, outcome);
  };
  let stopped = false;

  for (const row of rows) {
    if (stopped) {
      settle(row, { status: "notSent" });
      continue;
    }

    if ((await readHeld(chain, row)) === false) {
      chain.onGone?.(row);
      settle(row, { status: "alreadyRemoved" });
      continue;
    }

    // A failed simulation read is not a refusal: the send simulates again before the wallet.
    const reason = await chain.refusal(row).catch(() => null);
    if (reason) {
      settle(row, { status: "refused", reason });
      continue;
    }

    onSending?.(row);
    let result: RoleRemovalSendResult;
    try {
      result = await chain.removeRole(row);
    } catch (error) {
      result = {
        success: false,
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }

    if (result.success) {
      settle(row, { status: "removed", transactionHash: result.hash });
      continue;
    }

    if (result.error?.name === "UserRejected") {
      stopped = true;
      settle(row, { status: "declined" });
      continue;
    }

    // The send may still have landed: the chain says which. Only a proven removal lets the run go on.
    const held = await readHeld(chain, row);
    if (held === false) {
      chain.onGone?.(row);
      settle(row, { status: "removed" });
      continue;
    }
    stopped = true;
    settle(
      row,
      held === true ? { status: "failed", reason: result.error?.message } : { status: "unknown" }
    );
  }

  return outcomes;
}
