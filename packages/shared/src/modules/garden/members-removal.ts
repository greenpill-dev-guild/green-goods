import type { Abi, Hex } from "viem";
import type { Address } from "../../types/domain";
import { HATS_MODULE_ABI } from "../../utils/blockchain/abis/hats";
import {
  GARDEN_ROLE_IDS,
  type GardenRole,
  type GardenRoleRemovalBlock,
} from "../../utils/blockchain/garden-roles";
import { simulateTransaction } from "../../utils/blockchain/simulation";
import { logger } from "../app/logger";
import { createGardenMembersChain, type GardenMemberRow } from "./members-batch";

/**
 * What became of one person-and-role pair a steward asked to remove.
 *
 * - `removed`: the chain no longer gives them the role, from a confirmed send or from a read
 *   after a send that reported an error or left a proposal waiting.
 * - `alreadyRemoved`: a read just before the wallet found the role gone, so nothing was sent.
 * - `refused`: the chain would refuse it, or the signer is not an owner and the person holds
 *   Owner (reason `owner-only`) or the role is Steward (`owner-steward`), so nothing was sent.
 * - `declined`: the wallet's prompt was declined. Nothing was sent.
 * - `failed`: something went wrong and a read shows they still hold the role.
 * - `unknown`: a proposal (a Safe's) has not run yet, or something went wrong and the read that
 *   would say whether it landed failed too.
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
  /** The wallet returned a proposal (a Safe's, say) that has not run on chain yet. */
  confirmation?: "pending";
}

/** How a removal run reads and writes the chain. */
export interface RoleRemovalChain {
  /** Whether the person wears the role's exact hat. Throws when the read fails. */
  wearsRole(row: GardenMemberRow): Promise<boolean>;
  /**
   * Why the chain would refuse removing this pair from the signer, or null when it would go.
   * Throws when it cannot tell, and the run stops before the wallet.
   */
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
  } catch (error) {
    logger.warn("Role removal read failed", { error, role: row.role });
    return null;
  }
}

/** What an error is named when the chain could not be reached (`parseContractError`). */
const UNREACHED = new Set(["NetworkError", "TimeoutError", "Offline"]);
const OWNER_ONLY: GardenRoleRemovalBlock = "owner-only";
const OWNER_STEWARD: GardenRoleRemovalBlock = "owner-steward";

/** Reads every pair at once. A failed read is null, never a guess. */
export async function readHeldRoles(
  rows: readonly GardenMemberRow[],
  chain: RoleRemovalChain
): Promise<(boolean | null)[]> {
  const held = await Promise.all(rows.map((row) => readHeld(chain, row)));
  // A pair a read proves gone leaves the roster now, as it does during a run.
  for (const [index, row] of rows.entries()) {
    if (held[index] === false) chain.onGone?.(row);
  }
  return held;
}

/**
 * Removes each pair with its own signature, in the order given.
 *
 * Right before each signature the pair is read again: a role someone else already removed is
 * left out, because the chain would accept the removal anyway and charge for it. A pair the chain
 * would refuse is left out too, and the run goes on, since nothing was asked of the wallet; a
 * check that cannot run stops the run there, so nothing is signed on a guess. A declined prompt
 * stops the run. A send that reports an error, or leaves a proposal that has not
 * run (a Safe's), is read once more: if the role is gone it counted, and the run goes on;
 * otherwise the rest wait for the steward to see what happened before anything else is signed.
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

    let reason: string | null;
    try {
      reason = await chain.refusal(row);
    } catch (error) {
      // The wallet never asks on a check that could not run: this pair and the rest wait, unsent.
      logger.warn("Role removal check could not run", { error, role: row.role });
      stopped = true;
      settle(row, { status: "notSent" });
      continue;
    }
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

    if (result.success && result.confirmation !== "pending") {
      settle(row, { status: "removed", transactionHash: result.hash });
      continue;
    }

    if (result.error?.name === "UserRejected") {
      stopped = true;
      settle(row, { status: "declined" });
      continue;
    }

    // An unclear send may have landed, and a proposal may already have run: the chain says
    // which. Only a proven removal lets the run go on.
    const held = await readHeld(chain, row);
    if (held === false) {
      chain.onGone?.(row);
      settle(row, { status: "removed", transactionHash: result.hash });
      continue;
    }
    stopped = true;
    // A send that lost the chain may already be on its way, so a role still held after it is
    // unconfirmed, not failed: nothing offers to send it a second time.
    const unconfirmed = held !== true || result.success || UNREACHED.has(result.error?.name ?? "");
    settle(
      row,
      unconfirmed ? { status: "unknown" } : { status: "failed", reason: result.error?.message }
    );
  }

  return outcomes;
}

interface RoleRemovalChainInput {
  gardenAddress: Address;
  chainId: number;
  /** The account that signs. Without one, the send says what is missing. */
  account?: Address | null;
  /** The garden's own removal for each role: one signature each. */
  removeByRole: Record<GardenRole, (address: Address) => Promise<RoleRemovalSendResult>>;
  onGone?: RoleRemovalChain["onGone"];
}

/**
 * How a garden's role removals read, simulate and send for the account that signs them. Before
 * each signature it reads Owner afresh for the signer and the person, so only an owner changes an
 * owner's roles or removes a Steward role, even when the roster behind a pick was late. A read or simulation that cannot
 * reach the chain throws rather than guessing, so the run stops before the wallet.
 */
export function createRoleRemovalChain({
  gardenAddress,
  chainId,
  account,
  removeByRole,
  onGone,
}: RoleRemovalChainInput): RoleRemovalChain {
  const members = createGardenMembersChain(gardenAddress, chainId);
  return {
    wearsRole: (row) => members.wearsRole(row),
    refusal: async ({ address, role }) => {
      const hatsModule = await members.hatsModule();
      // Without a module or a signer the send itself says what is missing.
      if (!hatsModule || !account) return null;
      const [signerOwns, personOwns] = await Promise.all([
        members.wearsRole({ address: account, role: "owner" }),
        members.wearsRole({ address, role: "owner" }),
      ]);
      if (!signerOwns && (personOwns || role === "steward")) {
        return personOwns ? OWNER_ONLY : OWNER_STEWARD;
      }
      const { success, error } = await simulateTransaction(
        hatsModule,
        HATS_MODULE_ABI as Abi,
        "revokeRole",
        [gardenAddress, address, GARDEN_ROLE_IDS[role]],
        account,
        chainId
      );
      if (success) return null;
      if (error && UNREACHED.has(error.name)) throw new Error(error.message);
      return error?.message ?? "Transaction simulation failed";
    },
    removeRole: ({ address, role }) => removeByRole[role](address),
    onGone,
  };
}
