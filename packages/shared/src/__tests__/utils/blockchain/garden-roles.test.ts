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
  const neverGranted: GardenRole[] = [];

  it("offers an owner only Gardener: never Evaluator, and never Steward, whose grant mints Evaluator", () => {
    expect(restorableSubRoles(["owner", "steward", "gardener"], neverGranted)).toEqual([]);
    expect(restorableSubRoles(["owner", "steward"], neverGranted)).toEqual(["gardener"]);
    expect(restorableSubRoles(["owner", "funder"], neverGranted)).toEqual(["gardener"]);
  });

  it("offers a steward the Evaluator and Gardener their grant gives", () => {
    expect(restorableSubRoles(["steward", "gardener"], neverGranted)).toEqual(["evaluator"]);
    expect(restorableSubRoles(["steward"], neverGranted)).toEqual(["evaluator", "gardener"]);
  });

  it("never offers back a sub-role that was ever granted (the 18 Nov audit's two cases)", () => {
    // A steward whose Evaluator was granted, then revoked by itself.
    expect(
      restorableSubRoles(["steward", "gardener"], ["steward", "evaluator", "gardener"])
    ).toEqual([]);
    // The Safe: Evaluator and Gardener granted, revoked, then Owner granted.
    expect(
      restorableSubRoles(["owner", "steward"], ["owner", "steward", "evaluator", "gardener"])
    ).toEqual([]);
  });

  it("never offers Evaluator to a former owner whose Steward came from the Owner grant", () => {
    // Owner revoked later; the Steward and Gardener the Owner grant gave remain.
    expect(restorableSubRoles(["steward", "gardener"], ["owner", "steward", "gardener"])).toEqual(
      []
    );
    // A former owner may still be given back a Gardener no grant minted.
    expect(restorableSubRoles(["steward"], ["owner", "steward"])).toEqual(["gardener"]);
  });

  it("never offers back a sub-role with only a recorded revocation, such as a hat minted before indexing", () => {
    expect(restorableSubRoles(["steward", "gardener"], ["steward", "evaluator"])).toEqual([]);
  });

  it("finds nothing for roles with no sub-roles", () => {
    expect(restorableSubRoles(["evaluator", "funder", "community"], neverGranted)).toEqual([]);
  });
});
