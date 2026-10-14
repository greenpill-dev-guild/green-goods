import { describe, expect, it } from "vitest";
import { nextSpeedDialActionId } from "../../components/Canvas/speedDialNavigation";

// Disabled actions stay in the list, so a keyboard reaches the reason they give.
const ACTIONS = ["submit-work", "fund-jar", "invite"] as const;

describe("nextSpeedDialActionId", () => {
  it.each([
    ["ArrowDown", null, "submit-work"],
    ["ArrowDown", "submit-work", "fund-jar"],
    ["ArrowRight", "invite", "submit-work"],
    ["ArrowUp", null, "invite"],
    ["ArrowLeft", "submit-work", "invite"],
    ["Home", "invite", "submit-work"],
    ["End", "submit-work", "invite"],
    ["Tab", "submit-work", null],
  ] as const)("moves %s from %s to %s", (key, current, expected) => {
    expect(nextSpeedDialActionId(ACTIONS, current, key)).toBe(expected);
  });

  it("has nowhere to go without actions", () => {
    expect(nextSpeedDialActionId([], null, "ArrowDown")).toBeNull();
  });
});
