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
  canManageStewards?: boolean;
  allowedRoles?: readonly GardenRole[];
}

/** Why each of a person's roles cannot be removed by this viewer, for the roles that cannot. */
export function blockedRoles(
  person: MemberPerson,
  viewer: ManageRolesViewer,
  ownerCount: number
): Map<GardenRole, GardenRoleRemovalBlock> {
  const blocked = new Map<GardenRole, GardenRoleRemovalBlock>();
  for (const role of person.roles) {
    if (viewer.allowedRoles && !viewer.allowedRoles.includes(role)) {
      blocked.set(role, "no-access");
      continue;
    }
    const block = gardenRoleRemovalBlock({
      viewer: viewer.address,
      viewerIsOwner: viewer.isOwner,
      viewerCanManage: viewer.canManage,
      viewerCanManageStewards: viewer.canManageStewards,
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
 * as a steward, and an owner or a steward as an evaluator and a gardener, so taking those from
 * them changes the list, not what they can do.
 */
export function coveringRole(removed: GardenRole, kept: readonly GardenRole[]): GardenRole | null {
  if (removed === "steward") return kept.includes("owner") ? "owner" : null;
  if (removed !== "evaluator" && removed !== "gardener") return null;
  if (kept.includes("owner")) return "owner";
  if (kept.includes("steward")) return "steward";
  return null;
}

/** One pair's identity in a selection or a review. */
export const rolePairKey = ({ address, role }: RolePair) => `${address.toLowerCase()}:${role}`;

/** The selection with these pairs picked, or with them let go. */
export function withPicks(
  selected: ReadonlyMap<string, RolePair>,
  pairs: readonly RolePair[],
  picked: boolean
): ReadonlyMap<string, RolePair> {
  const next = new Map(selected);
  for (const pair of pairs) {
    if (picked) next.set(rolePairKey(pair), pair);
    else next.delete(rolePairKey(pair));
  }
  return next;
}

/** What the Manage Roles list narrows to: everyone, one role, or the people with picks. */
export type RoleFilter = GardenRole | "all" | "selected";

interface ChooseViewInput {
  people: readonly MemberPerson[];
  /** Each person's roles the viewer cannot remove, by lower-cased address. */
  blocked: ReadonlyMap<string, ReadonlyMap<GardenRole, GardenRoleRemovalBlock>>;
  selected: ReadonlyMap<string, RolePair>;
  filter: RoleFilter;
  /** The one person a directory row opened Manage Roles for, while the list shows only them. */
  scopedTo: Address | null;
  search: string;
  /** The name each person's row shows, by lower-cased address. */
  names: ReadonlyMap<string, string>;
  formatMessage: IntlShape["formatMessage"];
}

/**
 * What the choose step shows. Search, filters and the one-person scope change which people
 * show, never what is picked: a pick counts while its person still holds the role and the
 * viewer may still remove it, and picks out of view are counted so the footer can say so.
 */
export function chooseView({
  people,
  blocked,
  selected,
  filter,
  scopedTo,
  search,
  names,
  formatMessage,
}: ChooseViewInput) {
  const byAddress = new Map(people.map((person) => [person.address.toLowerCase(), person]));
  const picks = [...selected.values()].filter((pair) => {
    const key = pair.address.toLowerCase();
    return byAddress.get(key)?.roles.includes(pair.role) && !blocked.get(key)?.has(pair.role);
  });
  const pickedRoles = new Map<string, Set<GardenRole>>();
  for (const pair of picks) {
    const key = pair.address.toLowerCase();
    pickedRoles.set(key, (pickedRoles.get(key) ?? new Set()).add(pair.role));
  }
  const roles = GARDEN_ROLE_ORDER.filter((role) =>
    people.some((person) => person.roles.includes(role))
  );
  // A filter whose people are gone (the last pick cleared, a role's last holder removed) lets go.
  const usable =
    filter === "all" || (filter === "selected" ? picks.length > 0 : roles.includes(filter));
  const activeFilter: RoleFilter = usable ? filter : "all";
  const visiblePeople = people.filter((person) => {
    const key = person.address.toLowerCase();
    if (scopedTo) return key === scopedTo.toLowerCase();
    if (activeFilter === "selected") {
      if (!pickedRoles.has(key)) return false;
    } else if (activeFilter !== "all" && !person.roles.includes(activeFilter)) {
      return false;
    }
    return memberMatchesSearch(person, search, names.get(key), formatMessage);
  });
  const shown = new Set(visiblePeople.map((person) => person.address.toLowerCase()));
  return {
    picks,
    pickedRoles,
    roles,
    activeFilter,
    visiblePeople,
    hiddenPicks: picks.filter((pair) => !shown.has(pair.address.toLowerCase())).length,
  };
}
