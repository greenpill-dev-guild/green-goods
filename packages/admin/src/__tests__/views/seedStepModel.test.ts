import { cycleFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { COMMITMENT_COMPOSER_ERROR_IDS } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  formatRewardAmount,
  rewardAmountFromBaseUnits,
  rewardAmountToBaseUnits,
  rewardUnitsFor,
  seedRowRewardReady,
} from "@/views/Garden/Pool/Seed/seedRewardAmount";
import {
  actionUIDOf,
  buildSeedCycleOptions,
  buildSeedStepConfigs,
  CONFIRMER_ADDRESS_PATTERN,
  STEP_FIELDS,
  STEPS,
  seedErrorText,
  withConfirmer,
} from "@/views/Garden/Pool/Seed/seedStepModel";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const ZERO = "0x0000000000000000000000000000000000000000";
const formatMessage = ({ defaultMessage }: { defaultMessage: string }) => defaultMessage;

describe("seedStepModel", () => {
  it("declares the four steps and the fields each step owns", () => {
    expect(STEPS).toEqual(["what", "howMuch", "proof", "review"]);
    expect(STEP_FIELDS.what).toContain("title");
    expect(STEP_FIELDS.howMuch).toContain("requirements");
    expect(STEP_FIELDS.proof).toContain("confirmers");
    expect(STEP_FIELDS.review).toEqual([]);
    expect(buildSeedStepConfigs(formatMessage).map((step) => step.id)).toEqual(STEPS);
  });

  it("accepts a real confirmer once and rejects malformed, zero, and duplicate addresses", () => {
    expect(CONFIRMER_ADDRESS_PATTERN.test(ADDRESS)).toBe(true);
    expect(withConfirmer([], ` ${ADDRESS} `)).toEqual([ADDRESS]);
    expect(withConfirmer([ADDRESS], ADDRESS.toUpperCase())).toBeNull();
    expect(withConfirmer([], ZERO)).toBeNull();
    expect(withConfirmer([], "0x1")).toBeNull();
    expect(withConfirmer([ADDRESS], OTHER)).toEqual([ADDRESS, OTHER]);
  });

  it.each([
    ["42161-1", 42161, "1"],
    ["42161-0", 42161, "0"],
    ["42161-0x1", 42161, null],
    ["10-1", 42161, null],
    ["42161-", 42161, null],
  ] as const)("reads decimal action id %s for chain %s", (id, chainId, expected) => {
    expect(actionUIDOf(id, chainId)).toBe(expected);
  });

  it("orders the season, campaigns, and cycle-less option", () => {
    const season = cycleFixture({ cycleId: 10n, cycleType: "SEASON" });
    const campaign = cycleFixture({ cycleId: 11n, cycleType: "CAMPAIGN" });
    const options = buildSeedCycleOptions({
      season,
      campaigns: [campaign],
      cycleNames: new Map([
        ["10", { status: "resolved", name: "Rain season" }],
        ["11", { status: "resolved", name: "Tool drive" }],
      ]),
      formatMessage,
    });

    expect(options).toEqual([
      { value: "10", label: "Season · Rain season" },
      { value: "11", label: "Campaign · Tool drive" },
      { value: "0", label: "No cycle (runs on its own)" },
    ]);
    expect(
      buildSeedCycleOptions({
        season: null,
        campaigns: [],
        cycleNames: new Map(),
        formatMessage,
      })
    ).toEqual([{ value: "0", label: "No cycle (runs on its own)" }]);
  });

  it("says what the composer said in the steward's words, naming limits from their constants", () => {
    const { formatMessage: format } = createIntl({ locale: "en", messages: {}, onError: () => {} });
    expect(seedErrorText(COMMITMENT_COMPOSER_ERROR_IDS.considerationAmount, format)).toBe(
      "Enter an amount above zero."
    );
    expect(seedErrorText(COMMITMENT_COMPOSER_ERROR_IDS.titleTooLong, format)).toBe(
      "Shorten the title to 60 characters or fewer."
    );
    // The composer's remaining messages are English prose, shown as they are.
    expect(seedErrorText("How many?", format)).toBe("How many?");
  });
});

describe("declared reward units", () => {
  const usdc = { status: "ready", decimals: 6, symbol: "USDC" } as const;

  it.each([
    { text: "10", decimals: 18, baseUnits: "10000000000000000000", errorId: null },
    { text: "2.5", decimals: 6, baseUnits: "2500000", errorId: null },
    { text: ".5", decimals: 6, baseUnits: "500000", errorId: null },
    { text: "  ", decimals: 18, baseUnits: "", errorId: null },
    { text: "1.1234567", decimals: 6, baseUnits: "", errorId: "app.treasury.tooManyDecimals" },
    { text: "1,5", decimals: 6, baseUnits: "", errorId: "app.treasury.invalidAmount" },
  ])("stores $text as $baseUnits in $decimals-decimal units", ({ text, decimals, ...stored }) => {
    expect(rewardAmountToBaseUnits(text, decimals)).toEqual(stored);
  });

  it.each([
    { baseUnits: "10000000000000000000", decimals: 18, text: "10" },
    { baseUnits: "2500000", decimals: 6, text: "2.5" },
    { baseUnits: "", decimals: 18, text: "" },
  ])("reads $baseUnits back as '$text'", ({ baseUnits, decimals, text }) => {
    expect(rewardAmountFromBaseUnits(baseUnits, decimals)).toBe(text);
  });

  it("takes Celo settlement in G$ and waits on an external token until it answers", () => {
    expect(rewardUnitsFor("CELO_SETTLEMENT", { status: "idle" })).toEqual({
      status: "ready",
      decimals: 18,
      symbol: "G$",
    });
    expect(rewardUnitsFor("NONE", { status: "idle" })).toEqual({ status: "none" });
    expect(rewardUnitsFor("ARBITRUM_EXTERNAL", { status: "idle" })).toEqual({
      status: "waiting",
      reason: "noToken",
    });
    expect(rewardUnitsFor("ARBITRUM_EXTERNAL", { status: "unreadable" })).toEqual({
      status: "waiting",
      reason: "unreadable",
    });
    expect(
      rewardUnitsFor("ARBITRUM_EXTERNAL", {
        status: "ready",
        metadata: { decimals: 6, symbol: "USDC" },
      })
    ).toEqual(usdc);
  });

  it.each([
    { rail: "NONE", token: "", status: "idle", ready: true },
    { rail: "CELO_SETTLEMENT", token: "", status: "idle", ready: true },
    { rail: "ARBITRUM_EXTERNAL", token: ADDRESS, status: "idle", ready: false },
    { rail: "ARBITRUM_EXTERNAL", token: ADDRESS, status: "loading", ready: false },
    { rail: "ARBITRUM_EXTERNAL", token: ADDRESS, status: "unreadable", ready: false },
    { rail: "ARBITRUM_EXTERNAL", token: ADDRESS, status: "ready", ready: true },
  ] as const)("allows $rail with $status token units: $ready", ({ rail, token, status, ready }) => {
    const metadata =
      status === "ready"
        ? ({ status, metadata: { decimals: 6, symbol: "USDC" } } as const)
        : ({ status } as const);
    expect(
      seedRowRewardReady(
        { considerationRail: rail, considerationToken: token.toUpperCase() },
        new Map([[token.toLowerCase(), metadata]])
      )
    ).toBe(ready);
  });

  it("reviews an amount in token units, and never in units it does not know", () => {
    expect(formatRewardAmount("2500000", usdc, "en")).toBe("2.5 USDC");
    expect(
      formatRewardAmount("12345678901", { status: "ready", decimals: 18, symbol: "G$" }, "en")
    ).toBe("0.000000012345678901 G$");
    expect(formatRewardAmount("2500000", { status: "waiting", reason: "loading" }, "en")).toBe("—");
  });
});
