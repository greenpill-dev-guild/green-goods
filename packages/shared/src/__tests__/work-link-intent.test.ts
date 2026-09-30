import { describe, expect, it } from "vitest";
import {
  hasWorkLinkIntentParams,
  parseWorkLinkIntent,
  workLinkReturnGarden,
  writeWorkLinkIntent,
} from "../modules/commitment-pooling/work-link-intent";

const GARDEN = "0x1111111111111111111111111111111111111111" as const;

function complete() {
  return writeWorkLinkIntent(new URLSearchParams(), {
    commitmentId: 9n,
    requirementIndex: 0,
    actionUID: 7,
    garden: GARDEN,
    commitmentTitle: "Tree planting",
    requirementLabel: "1",
    returnTo: `/home/${GARDEN}/commitments/9`,
  });
}

describe("Work link intent", () => {
  it("round-trips one complete safe intent", () => {
    const params = complete();
    expect(hasWorkLinkIntentParams(params)).toBe(true);
    expect(parseWorkLinkIntent(params)).toMatchObject({
      commitmentId: 9n,
      requirementIndex: 0,
      actionUID: 7,
      garden: GARDEN,
    });
    expect(workLinkReturnGarden(parseWorkLinkIntent(params)!)).toBe(GARDEN);
  });

  it.each([
    "linkCommitmentId",
    "linkRequirementIndex",
    "linkActionUID",
  ])("rejects a partial intent missing %s", (key) => {
    const params = complete();
    params.delete(key);
    expect(hasWorkLinkIntentParams(params)).toBe(true);
    expect(parseWorkLinkIntent(params)).toBeNull();
  });

  it("rejects cross-origin-shaped return paths", () => {
    const params = complete();
    params.set("returnTo", "//example.com/path");
    expect(parseWorkLinkIntent(params)).toBeNull();
  });
});
