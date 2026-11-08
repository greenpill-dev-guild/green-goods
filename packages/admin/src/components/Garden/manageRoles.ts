import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
  type GardenRoleRemovalBlock,
  gardenRoleRemovalBlock,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import type { IntlShape } from "react-intl";
import { getRoleLabel } from "./gardenUtils";

/** A person in the garden, with every role they hold in role order. One row each (DL-049). */
export interface MemberPerson {
  address: Address;
  roles: GardenRole[];
}

/** One role one person holds: the unit a steward selects and removes. */
export interface RolePair {
  address: Address;
  role: GardenRole;
}

/** The people in a roster, each once, in the order their highest role first appears. */
export function peopleFromRoster(roleMembers: Record<GardenRole, Address[]>): MemberPerson[] {
  const byAddress = new Map<string, MemberPerson>();
  for (const role of GARDEN_ROLE_ORDER) {
    for (const address of roleMembers[role] ?? []) {
      const key = address.toLowerCase();
      const person = byAddress.get(key);
      if (person) {
        if (!person.roles.includes(role)) person.roles.push(role);
      } else {
        byAddress.set(key, { address, roles: [role] });
      }
    }
  }
  return [...byAddress.values()];
}

/**
 * Whether a person matches what the steward typed: the name their row shows, the full address,
 * both short forms of it, or a role they hold. The Members tab and Manage Roles search the same
 * way, so a person found in one is found in the other.
 */
export function memberMatchesSearch(
  person: MemberPerson,
  search: string,
  name: string | null | undefined,
  formatMessage: IntlShape["formatMessage"]
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    name ?? "",
    person.address,
    formatAddress(person.address),
    formatAddress(person.address, { variant: "card" }),
    ...person.roles.flatMap((role) => {
      const label = getRoleLabel(role, formatMessage);
      return [label.singular, label.plural];
    }),
  ].some((value) => value.toLowerCase().includes(query));
}

export interface ManageRolesViewer {
  address?: Address | null;
  isOwner: boolean;
  canManage: boolean;
}

/** Why each of a person's roles cannot be removed by this viewer, for the roles that cannot. */
export function blockedRoles(
  person: MemberPerson,
  viewer: ManageRolesViewer,
  ownerCount: number
): Map<GardenRole, GardenRoleRemovalBlock> {
  const blocked = new Map<GardenRole, GardenRoleRemovalBlock>();
  for (const role of person.roles) {
    const block = gardenRoleRemovalBlock({
      viewer: viewer.address,
      viewerIsOwner: viewer.isOwner,
      viewerCanManage: viewer.canManage,
      person: person.address,
      personRoles: person.roles,
      role,
      ownerCount,
    });
    if (block) blocked.set(role, block);
  }
  return blocked;
}

/** The roles a person keeps once the selected ones go, in role order. */
export function rolesKept(person: MemberPerson, removing: readonly GardenRole[]): GardenRole[] {
  return person.roles.filter((role) => !removing.includes(role));
}

/**
 * The kept role that still gives this access on chain, if any. A garden account counts an owner
 * or a steward as an evaluator and a gardener, so taking those from them changes the list, not
 * what they can do.
 */
export function coveringRole(removed: GardenRole, kept: readonly GardenRole[]): GardenRole | null {
  if (removed !== "evaluator" && removed !== "gardener") return null;
  if (kept.includes("owner")) return "owner";
  if (kept.includes("steward")) return "steward";
  return null;
}

/** One pair's identity in a selection or a review. */
export const rolePairKey = ({ address, role }: RolePair) => `${address.toLowerCase()}:${role}`;
