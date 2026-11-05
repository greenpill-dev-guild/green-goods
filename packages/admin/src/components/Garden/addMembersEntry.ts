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
  /** Why the chain would refuse this row, from the last attempt to add it. */
  refusal?: string;
}

/** Which add a row belongs to: a person can have an unsettled add under another role. */
export const memberRowKey = ({ address, role }: StagedMember) => `${address.toLowerCase()}:${role}`;

export const memberListKey = (rows: readonly StagedMember[]) => rows.map(memberRowKey).join();

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
 * `rolesByAddress` is the indexed roster: the instant answer, but it can lag a
 * recent grant or revoke. Pass `heldOnChain` once the chain has answered; it
 * overrules the roster either way. `undefined` (not answered yet, or the read
 * failed) keeps the roster's answer.
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
  if (heldOnChain ?? rosterRoles.includes(selectedRole)) return { kind: "held" };
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
function sharedRole(roles: GardenRole[]): GardenRole | null {
  const [first] = roles;
  return first && roles.every((role) => role === first) ? first : null;
}

/**
 * The add button's label. It names the role when every row shares it, and an empty list names the
 * role the picker would add.
 */
export function addMembersSubmitLabel(
  roles: GardenRole[],
  pickedRole: GardenRole,
  formatMessage: IntlShape["formatMessage"]
): string {
  const role = roles.length === 0 ? pickedRole : sharedRole(roles);
  return role
    ? formatMessage(
        { id: "admin.addMember.addCountRole" },
        { count: roles.length, ...getRoleLabel(role, formatMessage) }
      )
    : formatMessage(
        {
          id: "admin.addMember.addCount",
          defaultMessage: "{count, plural, one {Add # Member} other {Add # Members}}",
        },
        { count: roles.length }
      );
}
