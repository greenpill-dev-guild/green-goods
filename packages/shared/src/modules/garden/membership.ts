/**
 * Garden membership: which roles an account holds in a garden, read from the garden's record,
 * and which gardens are the account's own.
 *
 * A garden is the account's own when its record lists the account as owner, steward, evaluator
 * or gardener (PWA Home decision 2), or when this device sent an open join that the record does
 * not show yet. Funders and community members hold hats too but are not members here: a
 * depositor keeps Endowment on the garden page and has no place among "my gardens". A join
 * request waiting for a steward never counts: it grants nothing until a steward welcomes it.
 *
 * Home's filter, Profile's list, the arrival orientation, Submit Work and the offline plan read
 * "my gardens" from here. Permission checks keep reading the garden record or the chain for the
 * role they gate.
 */

import type { GardenRole } from "../../utils/blockchain/garden-roles";

/** The roles that make a garden one of the account's own. */
export type MemberRole = Extract<GardenRole, "owner" | "steward" | "evaluator" | "gardener">;

/** Each member role and the record list that names it, owner first as the app displays them. */
const MEMBER_ROLE_LISTS = [
  ["owner", "owners"],
  ["steward", "stewards"],
  ["evaluator", "evaluators"],
  ["gardener", "gardeners"],
] as const satisfies ReadonlyArray<readonly [MemberRole, string]>;

/** The work resolver accepts gardeners, stewards and owners (`Garden.sol` `isGardener`, `isOperator`). */
const WORK_SUBMITTER_ROLES: readonly MemberRole[] = ["owner", "steward", "gardener"];

/**
 * A garden record's role lists. A record restored from an older build's cache can lack a list
 * or hold something else in its place (PRD-1311), so each one is read as unknown.
 */
export type GardenRoleLists = Partial<Record<(typeof MEMBER_ROLE_LISTS)[number][1], unknown>>;

export interface GardenMembership {
  /** The roles the garden's record lists for the account, owner first. */
  roles: MemberRole[];
  /**
   * This device sent an open join that the record does not list yet. It stands in for the
   * gardener role until the indexer catches up or the pending-join record expires.
   */
  pendingJoin: boolean;
}

/** One of the account's gardens with the account's membership in it. */
export interface MyGarden<G> {
  garden: G;
  membership: GardenMembership;
}

function listsAccount(list: unknown, account: string): boolean {
  return (
    Array.isArray(list) &&
    list.some((entry) => typeof entry === "string" && entry.toLowerCase() === account)
  );
}

/**
 * The account's membership in one garden. `pendingJoin` says whether this device holds a fresh
 * open join for the account there; it counts only while the record lists no role.
 */
export function gardenMembership(
  garden: GardenRoleLists,
  account: string | null | undefined,
  pendingJoin = false
): GardenMembership {
  if (!account) return { roles: [], pendingJoin: false };
  const member = account.toLowerCase();
  const roles = MEMBER_ROLE_LISTS.filter(([, list]) => listsAccount(garden[list], member)).map(
    ([role]) => role
  );
  return { roles, pendingJoin: pendingJoin && roles.length === 0 };
}

/** Whether the garden is one of the account's own. */
export function isMyGarden(membership: GardenMembership): boolean {
  return membership.roles.length > 0 || membership.pendingJoin;
}

/**
 * Whether the account can submit work in the garden: an evaluator alone cannot, and an open
 * join just sent makes the account a gardener.
 */
export function canSubmitWork(membership: GardenMembership): boolean {
  return (
    membership.pendingJoin || membership.roles.some((role) => WORK_SUBMITTER_ROLES.includes(role))
  );
}

/**
 * The account's gardens in the list's order, each with its membership. `hasPendingJoin` says
 * whether this device holds a fresh open join for the account in a garden.
 */
export function listMyGardens<G extends GardenRoleLists & { id: string }>(
  gardens: readonly G[],
  account: string | null | undefined,
  hasPendingJoin: (gardenId: string) => boolean = () => false
): MyGarden<G>[] {
  if (!account) return [];
  return gardens.flatMap((garden) => {
    const membership = gardenMembership(garden, account, hasPendingJoin(garden.id));
    return isMyGarden(membership) ? [{ garden, membership }] : [];
  });
}
