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
