import { describe, expect, it } from "vitest";
import {
  fromDraftWorkLink,
  hasWorkLinkIntentParams,
  parseWorkLinkIntent,
  toDraftWorkLink,
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
  it("survives a work draft and comes back only through the page's own checks", () => {
    const intent = parseWorkLinkIntent(complete())!;
    const kept = toDraftWorkLink(intent);
    // The draft keeps the id as text, so it survives JSON and IndexedDB.
    expect(JSON.parse(JSON.stringify(kept))).toEqual({ ...intent, commitmentId: "9" });
    expect(fromDraftWorkLink(kept)).toEqual(intent);
    expect(fromDraftWorkLink({ ...kept, returnTo: "//example.com/path" })).toBeNull();
    expect(fromDraftWorkLink({ ...kept, commitmentId: "not a number" })).toBeNull();
  });

  it("keeps changing choice progress and dates out of persisted draft identity", () => {
    const intent = parseWorkLinkIntent(complete())!;
    const choice = { ...intent, approvedCount: 1, requiredCount: 3, dueDate: 1791331200n };
    expect(JSON.parse(JSON.stringify(toDraftWorkLink(choice)))).toEqual({
      ...intent,
      commitmentId: "9",
    });
  });

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
