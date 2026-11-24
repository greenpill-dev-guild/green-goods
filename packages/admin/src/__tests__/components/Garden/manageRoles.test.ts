/**
 * The Hub's rank rule for role changes (PRD-1391), as the garden's role rule on chain ranks them
 * (`Hats._requireRoleManager`): an Owner grants any role to anyone, a Steward any role below Owner
 * and never changes an Owner, and the protocol team grants Steward.
 */

import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { describe, expect, it } from "vitest";
import { grantableRoles, rosterForViewer } from "@/components/Garden/manageRoles";

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const STEWARD = "0x2222222222222222222222222222222222222222" as Address;
const GARDENER = "0x3333333333333333333333333333333333333333" as Address;

const ROSTER: Record<GardenRole, Address[]> = {
  owner: [OWNER],
  steward: [OWNER, STEWARD],
  evaluator: [],
  gardener: [GARDENER],
  funder: [],
  community: [],
};

const asOwner = { address: OWNER, isOwner: true, canManage: true };
const asSteward = { address: STEWARD, isOwner: false, canManage: true };
const asTeam = { address: null, isOwner: false, canManage: false, canManageStewards: true };

describe("the Hub's rank rule for role changes", () => {
  it("grants an Owner every role, a Steward every role below Owner, and the team only Steward", () => {
    expect(grantableRoles(asOwner)).toContain("owner");
    expect(grantableRoles(asSteward)).not.toContain("owner");
    expect(grantableRoles(asSteward)).toEqual(
      expect.arrayContaining(["steward", "evaluator", "gardener", "funder", "community"])
    );
    expect(grantableRoles(asTeam)).toEqual(["steward"]);
  });

  it("leaves a Steward no row on which to add or restore an Owner's roles", () => {
    const keys = (viewer: Parameters<typeof rosterForViewer>[1]) =>
      [...rosterForViewer(ROSTER, viewer).addable].sort();
    const all = [OWNER, STEWARD, GARDENER].map((address) => address.toLowerCase()).sort();

    expect(keys(asSteward)).toEqual([STEWARD, GARDENER].map((a) => a.toLowerCase()).sort());
    expect(keys(asOwner)).toEqual(all);
    expect(keys(asTeam)).toEqual(all);
    // Removal stays ranked as before: a Steward can take none of an Owner's roles.
    expect(
      rosterForViewer(ROSTER, asSteward).blocked.get(OWNER.toLowerCase())?.get("steward")
    ).toBe("owner-only");
  });
});
