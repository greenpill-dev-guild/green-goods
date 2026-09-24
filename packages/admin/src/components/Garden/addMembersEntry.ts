import type { Address } from "@green-goods/shared/types/domain";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import type { IntlShape } from "react-intl";
import { getRoleLabel } from "./gardenUtils";

/** One queued person and the role they are getting. The list holds one row per person. */
export interface StagedMember {
  address: Address;
  role: GardenRole;
}

/** The roles each address holds today, keyed by lowercase address, in display order. */
export function buildRolesByAddress(
  roleMembers: Record<GardenRole, Address[]>
): Map<string, GardenRole[]> {
  const rolesByAddress = new Map<string, GardenRole[]>();
  for (const role of GARDEN_ROLE_ORDER) {
    for (const address of roleMembers[role] ?? []) {
      const key = address.toLowerCase();
      const roles = rolesByAddress.get(key) ?? [];
      if (!roles.includes(role)) roles.push(role);
      rolesByAddress.set(key, roles);
    }
  }
  return rolesByAddress;
}

/**
 * What adding a resolved person with the selected role would mean, most
 * blocking first:
 * - `staged`: they are already in the list;
 * - `held`: they already hold the role, so adding it would ask the wallet to
 *   sign for nothing;
 * - `member`: they belong to the garden with other roles (a promotion, or an
 *   extra role);
 * - `new`: they are not in this garden yet.
 */
export type EntryCheck =
  | { kind: "staged"; stagedRole: GardenRole }
  | { kind: "held" }
  | { kind: "member"; currentRoles: GardenRole[] }
  | { kind: "new" };

/**
 * `rolesByAddress` is the indexed roster, which can lag a revoke, so it only
 * proposes `held`. Pass `heldOnChain` once the chain has answered: `false`
 * overrules the roster and lets the grant through, while `undefined` (not
 * checked yet, or the read failed) keeps the roster's answer.
 */
export function checkEntry(
  address: Address,
  selectedRole: GardenRole,
  staged: StagedMember[],
  rolesByAddress: Map<string, GardenRole[]>,
  heldOnChain?: boolean
): EntryCheck {
  const key = address.toLowerCase();
  const queued = staged.find((entry) => entry.address.toLowerCase() === key);
  if (queued) return { kind: "staged", stagedRole: queued.role };

  const rosterRoles = rolesByAddress.get(key) ?? [];
  if (rosterRoles.includes(selectedRole) && heldOnChain !== false) return { kind: "held" };
  const currentRoles = rosterRoles.filter((role) => role !== selectedRole);
  return currentRoles.length > 0 ? { kind: "member", currentRoles } : { kind: "new" };
}

/** Only someone not yet queued, who does not already hold the role, can join the list. */
export function canStage(check: EntryCheck): boolean {
  return check.kind === "member" || check.kind === "new";
}

/** A person's roles as one localized phrase ("Steward, Evaluator, and Gardener"). */
export function formatRoleNames(
  roles: GardenRole[],
  intl: Pick<IntlShape, "formatList" | "formatMessage">
): string {
  return intl.formatList(
    roles.map((role) => getRoleLabel(role, intl.formatMessage).singular),
    { type: "conjunction" }
  );
}

/** The role every row shares, or null when the list is empty or mixes roles. */
export function sharedRole(roles: GardenRole[]): GardenRole | null {
  const [first] = roles;
  return first && roles.every((role) => role === first) ? first : null;
}
