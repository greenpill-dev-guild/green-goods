/**
 * Active garden resolver tests: which garden Home opens in, from the account's gardens and the
 * garden this device remembers for the chain and account (spec, Persistence and state
 * architecture).
 */

import { describe, expect, it } from "vitest";
import {
  type ActiveGardenInputs,
  activeGardenScope,
  resolveActiveGarden,
} from "../../../modules/garden/active-garden";

const CHAIN_ID = 42161;
const ALICE = "0xa11ce00000000000000000000000000000000001";
const BOB = "0xb0b0000000000000000000000000000000000002";
const ALICE_SCOPE = `${CHAIN_ID}:${ALICE}`;
const BOB_SCOPE = `${CHAIN_ID}:${BOB}`;
const GARDEN_A = "0xA000000000000000000000000000000000000001";
const GARDEN_B = "0xB000000000000000000000000000000000000002";

function inputs(
  gardenIds: string[] | "loading" | "failed",
  remembered: Record<string, string> = {},
  scope: string | null = ALICE_SCOPE
): ActiveGardenInputs {
  const known = Array.isArray(gardenIds);
  return {
    scope,
    remembered,
    myGardens: {
      gardens: known ? gardenIds.map((id) => ({ garden: { id } })) : [],
      isLoaded: known,
      isError: gardenIds === "failed",
    },
  };
}

describe("resolveActiveGarden", () => {
  it.each([
    ["zero gardens", inputs([]), { status: "none", gardenId: null }],
    [
      "one garden, which selects itself and is remembered",
      inputs([GARDEN_A]),
      { status: "ready", gardenId: GARDEN_A, remember: true },
    ],
    [
      "several gardens with nothing remembered",
      inputs([GARDEN_A, GARDEN_B]),
      { status: "choose", gardenId: null },
    ],
    [
      "several gardens and a remembered one that is still theirs (stored-eligible)",
      inputs([GARDEN_A, GARDEN_B], { [ALICE_SCOPE]: GARDEN_B.toLowerCase() }),
      { status: "ready", gardenId: GARDEN_B, remember: false },
    ],
    [
      "several gardens and a remembered one they no longer hold (stored-stale)",
      inputs([GARDEN_A, GARDEN_B], { [ALICE_SCOPE]: "0xC000000000000000000000000000000000000003" }),
      { status: "choose", gardenId: null },
    ],
    [
      "one garden replacing a remembered one they no longer hold",
      inputs([GARDEN_A], { [ALICE_SCOPE]: GARDEN_B }),
      { status: "ready", gardenId: GARDEN_A, remember: true },
    ],
    [
      "no gardens left, with the remembered one kept in storage",
      inputs([], { [ALICE_SCOPE]: GARDEN_A }),
      { status: "none", gardenId: null },
    ],
  ] as const)("resolves %s", (_case, given, expected) => {
    expect(resolveActiveGarden(given)).toEqual(expected);
  });

  it("keeps the remembered garden while the gardens are unknown (cached-while-loading)", () => {
    expect(resolveActiveGarden(inputs("loading", { [ALICE_SCOPE]: GARDEN_A }))).toEqual({
      status: "loading",
      gardenId: GARDEN_A,
    });
    expect(resolveActiveGarden(inputs("loading"))).toEqual({ status: "loading", gardenId: null });
  });

  it("reports a failed read with nothing remembered as an error, not as no gardens", () => {
    expect(resolveActiveGarden(inputs("failed"))).toEqual({ status: "error", gardenId: null });
    // With a remembered garden an offline or failed open still goes straight in.
    expect(resolveActiveGarden(inputs("failed", { [ALICE_SCOPE]: GARDEN_A }))).toEqual({
      status: "loading",
      gardenId: GARDEN_A,
    });
  });

  it("never gives one account's remembered garden to another (account switch)", () => {
    const remembered = { [ALICE_SCOPE]: GARDEN_A };

    expect(resolveActiveGarden(inputs([GARDEN_A, GARDEN_B], remembered, BOB_SCOPE))).toEqual({
      status: "choose",
      gardenId: null,
    });
    expect(resolveActiveGarden(inputs("loading", remembered, BOB_SCOPE))).toEqual({
      status: "loading",
      gardenId: null,
    });
    expect(resolveActiveGarden(inputs([GARDEN_A, GARDEN_B], remembered, null))).toEqual({
      status: "loading",
      gardenId: null,
    });
  });
});

describe("activeGardenScope", () => {
  it("scopes a choice to one chain and one account, whatever the address's case", () => {
    expect(activeGardenScope(CHAIN_ID, ALICE.toUpperCase().replace("0X", "0x"))).toBe(ALICE_SCOPE);
    expect(activeGardenScope(11155111, ALICE)).not.toBe(ALICE_SCOPE);
    expect(activeGardenScope(CHAIN_ID, null)).toBeNull();
  });
});
