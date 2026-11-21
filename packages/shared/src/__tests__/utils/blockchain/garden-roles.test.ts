import { describe, expect, it } from "vitest";
import {
  type GardenRole,
  type GardenRoleRemovalInput,
  gardenRoleRemovalBlock,
  restorableSubRoles,
} from "../../../utils/blockchain/garden-roles";

const OWNER = "0x1111111111111111111111111111111111111111";
const STEWARD = "0x2222222222222222222222222222222222222222";
const PEER = "0x3333333333333333333333333333333333333333";

const asOwner = { viewer: OWNER, viewerIsOwner: true, viewerCanManage: true };
const asSteward = { viewer: STEWARD, viewerIsOwner: false, viewerCanManage: true };

function block(
  viewer: Pick<GardenRoleRemovalInput, "viewer" | "viewerIsOwner" | "viewerCanManage">,
  person: string,
  personRoles: GardenRole[],
  role: GardenRole,
  ownerCount = 2
) {
  return gardenRoleRemovalBlock({ ...viewer, person, personRoles, role, ownerCount });
}

describe("utils/blockchain/garden-roles gardenRoleRemovalBlock", () => {
  it("lets an owner remove any role from anyone, other owners included", () => {
    expect(block(asOwner, PEER, ["owner", "steward"], "owner")).toBeNull();
    expect(block(asOwner, PEER, ["steward", "evaluator"], "steward")).toBeNull();
    expect(block(asOwner, OWNER, ["owner", "steward", "gardener"], "gardener")).toBeNull();
  });

  it("keeps the viewer's own Owner and Steward roles and the last Owner out of reach", () => {
    expect(block(asOwner, OWNER, ["owner", "steward"], "owner")).toBe("own-access");
    expect(block(asOwner, OWNER, ["owner", "steward"], "steward")).toBe("own-access");
    expect(block(asSteward, STEWARD, ["steward", "evaluator"], "steward")).toBe("own-access");
    expect(block(asOwner, PEER, ["owner"], "owner", 1)).toBe("last-owner");
  });

  it("keeps a steward off an owner's roles and another steward's Steward role", () => {
    expect(block(asSteward, OWNER, ["owner", "steward", "gardener"], "gardener")).toBe(
      "owner-only"
    );
    expect(block(asSteward, PEER, ["steward", "evaluator", "gardener"], "steward")).toBe(
      "owner-steward"
    );
  });

  it("lets a steward remove roles below Steward from anyone who is not an owner", () => {
    expect(block(asSteward, PEER, ["steward", "evaluator", "gardener"], "evaluator")).toBeNull();
    expect(block(asSteward, PEER, ["community"], "community")).toBeNull();
    expect(block(asSteward, STEWARD, ["steward", "evaluator"], "evaluator")).toBeNull();
  });

  it("offers nothing to someone who cannot manage roles", () => {
    expect(
      block(
        { viewer: PEER, viewerIsOwner: false, viewerCanManage: false },
        STEWARD,
        ["gardener"],
        "gardener"
      )
    ).toBe("no-access");
  });
});

describe("utils/blockchain/garden-roles restorableSubRoles", () => {
  const nothingRevoked: GardenRole[] = [];

  it("never asks an owner for Evaluator: their Steward hat comes from the Owner grant", () => {
    expect(restorableSubRoles(["owner", "steward", "gardener"], nothingRevoked)).toEqual([]);
    expect(restorableSubRoles(["owner", "steward"], nothingRevoked)).toEqual(["gardener"]);
    expect(restorableSubRoles(["owner", "funder"], nothingRevoked)).toEqual([
      "steward",
      "gardener",
    ]);
  });

  it("names the Evaluator and Gardener a steward's own grant gives", () => {
    expect(restorableSubRoles(["steward", "gardener"], nothingRevoked)).toEqual(["evaluator"]);
    expect(restorableSubRoles(["steward"], nothingRevoked)).toEqual(["evaluator", "gardener"]);
  });

  it("leaves a sub-role someone revoked on purpose (the 18 Nov audit's two cases)", () => {
    // A steward whose Evaluator was revoked by itself.
    expect(restorableSubRoles(["steward", "gardener"], ["evaluator"])).toEqual([]);
    // An owner whose Evaluator and Gardener were revoked before the Owner grant.
    expect(restorableSubRoles(["owner", "steward"], ["evaluator", "gardener"])).toEqual([]);
  });

  it("finds nothing missing for roles with no sub-roles", () => {
    expect(restorableSubRoles(["steward", "evaluator", "gardener"], nothingRevoked)).toEqual([]);
    expect(restorableSubRoles(["evaluator", "funder", "community"], nothingRevoked)).toEqual([]);
  });
});
