/**
 * Where an account's username stands (PRD-1026), as one answer the Account
 * tab's Username card reads: its chip, its sentence and its acts all follow
 * from this, and nothing else decides them.
 *
 * Changing a name takes the two acts the contract needs, in order: release the
 * old name, then claim the new one once the release has cleared on Ethereum,
 * 15 to 20 minutes later. The app asks for the new name once, before the
 * release, and this device keeps it (`UsernameChange`) so the card can carry
 * the change across that wait, a reload included.
 *
 * @module modules/ens/username
 */

import type { Address, ENSRegistrationData } from "../../types/domain";

/** A change this device started: `from` is being released, then `to` is claimed. */
export interface UsernameChange {
  /** The name being released. */
  from: string;
  /** The name to claim once `from` clears; null after Choose Another. */
  to: string | null;
  /** When the release was sent, in milliseconds. */
  releasedAt: number;
}

export type UsernameCardState =
  /** Nothing to say yet: no account, or its membership still loading. */
  | { kind: "loading" }
  /** No name, and none can be claimed until the account joins a garden (p8). */
  | { kind: "locked" }
  /**
   * No name to show: never had one (p7, `after: "none"`), the old one cleared
   * and the person chose to pick another (`"released"`), or the name they
   * chose was claimed by someone else while the old one cleared (p9x).
   */
  | { kind: "choose"; after: "none" | "released" | "taken"; taken: string | null }
  /** Checked and resolving (p1). */
  | { kind: "ready"; slug: string }
  /** Registered and on its way to Ethereum (p3), or claimed on this device (p9d). */
  | { kind: "setting-up"; slug: string; claimedHere: boolean }
  /** Past the usual setup time (p4). */
  | { kind: "taking-longer"; slug: string }
  /** The first check hasn't answered yet. */
  | { kind: "checking"; slug: string }
  /** A claim is with the wallet or on its way to the chain. */
  | { kind: "claiming"; slug: string }
  /** The check failed and nothing is known about the name (p5). */
  | { kind: "unknown"; slug: string }
  /** Step 1 of 2: the old name is being released (p9a). `to` is null when no new name was chosen here. */
  | { kind: "releasing"; from: string; to: string | null }
  /** Step 2 of 2: the old name cleared; the new one waits to be claimed (p9c). */
  | { kind: "claimable"; to: string };

export interface UsernameCardInput {
  owner: Address | undefined;
  /** Whether the account may hold a name (a garden member); undefined while loading. */
  isMember: boolean | undefined;
  /** The account's name lookup is still loading. */
  nameLoading: boolean;
  /** The name the account holds, or the one it just claimed on this device. */
  slug: string | null;
  /** `slug` was claimed on this device, this session. */
  claimedHere: boolean;
  /**
   * The name a claim is being sent for, until it lands or fails. The card
   * holds on it rather than on its form: a read can already see the name as
   * taken, by this very claim, before its receipt arrives.
   */
  claiming: string | null;
  /**
   * The registration status of the name the card follows: the change's
   * `from` while a change is open, otherwise `slug`.
   */
  status: ENSRegistrationData | undefined;
  /** The latest status check failed. */
  statusError: boolean;
  change: UsernameChange | null;
  /** Whether the change's new name is still free; undefined while unknown. */
  changeTargetFree: boolean | undefined;
}

const sameAccount = (left: Address | undefined, right: Address) =>
  left !== undefined && left.toLowerCase() === right.toLowerCase();

export function selectUsernameCard(input: UsernameCardInput): UsernameCardState {
  const { owner, isMember, nameLoading, slug, claimedHere, status, statusError, change } = input;
  if (!owner || isMember === undefined) return { kind: "loading" };
  if (input.claiming !== null) return { kind: "claiming", slug: input.claiming };

  // This account's release has cleared: the receiver no longer holds the name.
  const released = status?.status === "available" && sameAccount(status.release?.owner, owner);
  const releasing = Boolean(status?.release) && !released;
  const heldByAnother =
    status?.status === "active" &&
    status.registration !== undefined &&
    !sameAccount(status.registration.owner, owner);
  const choose = (after: "none" | "released" | "taken", taken: string | null = null) =>
    isMember ? { kind: "choose" as const, after, taken } : { kind: "locked" as const };

  // A change this device started carries the card until its claim is sent,
  // unless the account already holds another name (claimed elsewhere). The
  // old name counts as cleared only once it reads as free: until then, a
  // missing or failed read included, the change is still on step 1.
  if (change !== null && (slug === null || slug === change.from)) {
    if (status?.status !== "available" && !heldByAnother) {
      return { kind: "releasing", from: change.from, to: change.to };
    }
    if (change.to === null) return choose("released");
    if (input.changeTargetFree === false) return choose("taken", change.to);
    return isMember ? { kind: "claimable", to: change.to } : { kind: "locked" };
  }

  if (!slug) return nameLoading ? { kind: "loading" } : choose("none");
  if (releasing) return { kind: "releasing", from: slug, to: null };
  if (released || heldByAnother) return choose("released");
  if (!status) return statusError ? { kind: "unknown", slug } : { kind: "checking", slug };
  switch (status.status) {
    case "active":
      return { kind: "ready", slug };
    case "pending":
      return { kind: "setting-up", slug, claimedHere };
    case "timed_out":
      return { kind: "taking-longer", slug };
    default:
      // The name reads as free, yet the account's lookup still names it.
      return choose("released");
  }
}
