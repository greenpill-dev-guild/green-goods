import { cycleFixture } from "@green-goods/shared/testing";
import { describe, expect, it } from "vitest";
import {
  actionUIDOf,
  buildSeedCycleOptions,
  buildSeedStepConfigs,
  CONFIRMER_ADDRESS_PATTERN,
  SEED_ERROR_DESCRIPTOR_BY_ID,
  STEP_FIELDS,
  STEPS,
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

  it("maps composer message ids to operator-facing descriptors", () => {
    expect(
      SEED_ERROR_DESCRIPTOR_BY_ID.get("cockpit.garden.pool.seed.error.considerationAmount")
    ).toMatchObject({ defaultMessage: "Enter a whole amount above zero." });
  });
});
