import { describe, expect, it } from "vitest";
import {
  type GardenRole,
  type GardenRoleRemovalInput,
  gardenRoleRemovalBlock,
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
  it("lets an owner remove any role from anyone but their own access and the last owner", () => {
    expect(block(asOwner, PEER, ["owner", "steward"], "owner")).toBeNull();
    expect(block(asOwner, PEER, ["steward", "evaluator"], "steward")).toBeNull();
    expect(block(asOwner, OWNER, ["owner", "steward", "gardener"], "gardener")).toBeNull();
    expect(block(asOwner, OWNER, ["owner", "steward"], "owner")).toBe("own-access");
    expect(block(asOwner, OWNER, ["owner", "steward"], "steward")).toBe("own-access");
    expect(block(asOwner, PEER, ["owner"], "owner", 1)).toBe("last-owner");
  });

  it("keeps a steward to roles below Steward, on people who are not owners", () => {
    expect(block(asSteward, OWNER, ["owner", "steward", "gardener"], "gardener")).toBe(
      "owner-only"
    );
    expect(block(asSteward, PEER, ["steward", "evaluator", "gardener"], "steward")).toBe(
      "owner-steward"
    );
    expect(block(asSteward, PEER, ["steward", "evaluator", "gardener"], "evaluator")).toBeNull();
    expect(block(asSteward, PEER, ["community"], "community")).toBeNull();
    expect(block(asSteward, STEWARD, ["steward", "evaluator"], "steward")).toBe("own-access");
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
