/**
 * Recipient aggregation for the client PWA "Send" flow.
 *
 * Pure helpers that turn the garden role arrays (the only membership source —
 * there is no global member directory) into a "my gardens first, then all"
 * recipient structure. A member who holds several roles in one garden is deduped
 * with their roles merged; the current user is never listed as a recipient.
 *
 * @module utils/app/send-recipients
 */

import type { Address, Garden } from "../../types/domain";
import { GARDEN_ROLE_ORDER, type GardenRole } from "../blockchain/garden-roles";

export interface RecipientMember {
  address: Address;
  /** Roles this member holds in this garden, in canonical display order. */
  roles: GardenRole[];
}

export interface RecipientGardenGroup {
  gardenId: string;
  gardenName: string;
  members: RecipientMember[];
  /** True when the current user is a member of this garden. */
  isMine: boolean;
}

export interface FlatRecipientMember extends RecipientMember {
  gardenId: string;
  gardenName: string;
  isMine: boolean;
}

const ROLE_ARRAY_KEYS: ReadonlyArray<{ role: GardenRole; key: keyof Garden }> = [
  { role: "owner", key: "owners" },
  { role: "operator", key: "operators" },
  { role: "evaluator", key: "evaluators" },
  { role: "gardener", key: "gardeners" },
  { role: "funder", key: "funders" },
  { role: "community", key: "communities" },
];

/**
 * Build recipient groups for the Send picker.
 *
 * - Members within a garden are deduped by address with their roles merged.
 * - `self` is excluded (you can't send to yourself).
 * - Gardens where `self` is a member are flagged `isMine` and sorted first.
 */
export function buildSendRecipientGroups(
  gardens: Garden[] | undefined,
  self?: Address | string | null
): RecipientGardenGroup[] {
  const selfKey = self ? self.toLowerCase() : null;
  const groups: RecipientGardenGroup[] = [];

  for (const garden of gardens ?? []) {
    const byAddress = new Map<string, RecipientMember>();
    let selfIsMember = false;

    for (const { role, key } of ROLE_ARRAY_KEYS) {
      const addresses = (garden[key] as Address[] | undefined) ?? [];
      for (const address of addresses) {
        const addressKey = address.toLowerCase();
        if (addressKey === selfKey) {
          selfIsMember = true;
          continue;
        }
        const existing = byAddress.get(addressKey);
        if (existing) {
          if (!existing.roles.includes(role)) existing.roles.push(role);
        } else {
          byAddress.set(addressKey, { address, roles: [role] });
        }
      }
    }

    if (byAddress.size === 0) continue;

    const members = Array.from(byAddress.values()).map((member) => ({
      address: member.address,
      roles: GARDEN_ROLE_ORDER.filter((role) => member.roles.includes(role)),
    }));

    groups.push({
      gardenId: garden.id,
      gardenName: garden.name,
      members,
      isMine: selfIsMember,
    });
  }

  // My gardens first; stable order within each partition (Array.sort is stable).
  return groups.sort((a, b) => Number(b.isMine) - Number(a.isMine));
}

/** Flatten + dedupe members across all groups (protocol-wide search source). */
export function flattenRecipientMembers(groups: RecipientGardenGroup[]): FlatRecipientMember[] {
  const seen = new Set<string>();
  const flat: FlatRecipientMember[] = [];
  for (const group of groups) {
    for (const member of group.members) {
      const key = member.address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push({
        ...member,
        gardenId: group.gardenId,
        gardenName: group.gardenName,
        isMine: group.isMine,
      });
    }
  }
  return flat;
}

/** One garden a member belongs to, with the roles they hold there. */
export interface RecipientGardenMembership {
  gardenId: string;
  gardenName: string;
  isMine: boolean;
  roles: GardenRole[];
}

/** A recipient across the whole directory, with per-garden membership. */
export interface DirectoryMember {
  address: Address;
  /** Every garden this member belongs to (mine and others). */
  gardens: RecipientGardenMembership[];
  /** Gardens the current user and this member both belong to. */
  sharedGardens: RecipientGardenMembership[];
}

/** A garden row for the "browse all gardens" drill-down list. */
export interface RecipientGardenSummary {
  gardenId: string;
  gardenName: string;
  memberCount: number;
  isMine: boolean;
}

export interface RecipientDirectory {
  /** Gardens the current user is a member of — members shown inline. */
  myGardens: RecipientGardenGroup[];
  /** Gardens the current user is NOT in — for garden-first drill-down. */
  otherGardens: RecipientGardenGroup[];
  /** Address (lowercased) → membership + shared-garden context. */
  byAddress: Map<string, DirectoryMember>;
}

/**
 * Build the recipient directory for the Send picker.
 *
 * Splits gardens into "mine" (members shown directly) and "others" (browsed via a
 * garden-first drill-down), and indexes every member by address so the UI can show
 * which gardens the sender and recipient share ("gardens you share") without a
 * global member directory (which doesn't exist).
 */
export function buildRecipientDirectory(
  gardens: Garden[] | undefined,
  self?: Address | string | null
): RecipientDirectory {
  const groups = buildSendRecipientGroups(gardens, self);
  const byAddress = new Map<string, DirectoryMember>();

  for (const group of groups) {
    for (const member of group.members) {
      const key = member.address.toLowerCase();
      const membership: RecipientGardenMembership = {
        gardenId: group.gardenId,
        gardenName: group.gardenName,
        isMine: group.isMine,
        roles: member.roles,
      };
      const existing = byAddress.get(key);
      if (existing) {
        existing.gardens.push(membership);
        if (group.isMine) existing.sharedGardens.push(membership);
      } else {
        byAddress.set(key, {
          address: member.address,
          gardens: [membership],
          sharedGardens: group.isMine ? [membership] : [],
        });
      }
    }
  }

  return {
    myGardens: groups.filter((group) => group.isMine),
    otherGardens: groups.filter((group) => !group.isMine),
    byAddress,
  };
}

/** Garden names the current user shares with a member, for the "Together in …" line. */
export function sharedGardenNames(directory: RecipientDirectory, address: Address): string[] {
  return (
    directory.byAddress.get(address.toLowerCase())?.sharedGardens.map((g) => g.gardenName) ?? []
  );
}
