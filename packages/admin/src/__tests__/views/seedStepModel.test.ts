import { cycleFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import type { SeedCopyProgress } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import {
  COMMITMENT_COMPOSER_DEFAULTS,
  COMMITMENT_COMPOSER_ERROR_IDS,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  carriedOverUsd,
  needsGoodDollarPrice,
  rewardAmountAtCreate,
} from "@/views/Garden/Pool/Seed/seedReward";
import { seedStatusView } from "@/views/Garden/Pool/Seed/seedStatus";
import {
  actionUIDOf,
  buildSeedCycleOptions,
  buildSeedStepConfigs,
  CONFIRMER_ADDRESS_PATTERN,
  seedBlockedReason,
  STEP_FIELDS,
  STEPS,
  seedErrorText,
  stepFieldsFor,
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

  it("asks garden work for no unit, since it is counted in hours, and every other kind for one", () => {
    expect(stepFieldsFor("howMuch", "GARDEN_WORK")).not.toContain("unitLabel");
    expect(stepFieldsFor("howMuch", "GARDEN_WORK")).toContain("targetUnits");
    expect(stepFieldsFor("howMuch", "SERVICE")).toContain("unitLabel");
    expect(stepFieldsFor("howMuch", "SEASON_CAMPAIGN")).toContain("unitLabel");
    expect(stepFieldsFor("proof", "GARDEN_WORK")).toEqual(STEP_FIELDS.proof);
  });

  it("names the first reason seeding is off", () => {
    const open = { poolOpen: true, capacityOver: false, priceUnavailable: false };
    expect(seedBlockedReason(open)).toBeNull();
    expect(seedBlockedReason({ ...open, poolOpen: false, capacityOver: true })?.id).toBe(
      "cockpit.garden.pool.seed.blocked.poolClosed"
    );
    expect(seedBlockedReason({ ...open, capacityOver: true })?.id).toBe(
      "cockpit.garden.pool.seed.blocked.capacity"
    );
    expect(seedBlockedReason({ ...open, priceUnavailable: true })?.id).toBe(
      "cockpit.garden.pool.seed.blocked.price"
    );
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
    expect(seedErrorText(COMMITMENT_COMPOSER_ERROR_IDS.countTooMany, format)).toBe(
      "Create 50 promises or fewer at once."
    );
    // The composer's remaining messages are English prose, shown as they are.
    expect(seedErrorText("How many?", format)).toBe("How many?");
  });
});

/** The reserve's price on 2026-09-30, in cUSD per G$ with 18 decimals: $5.00 is about 38,866 G$. */
const PRICE = 128_647_930_734_508n;

describe("a reward in dollars", () => {
  const dollars = {
    considerationRail: "CELO_SETTLEMENT",
    considerationUsd: "5.00",
    considerationAmount: "",
  } as const;

  it("is turned into G$ at Create, at the price read for it, and never without one", () => {
    expect(rewardAmountAtCreate(dollars, PRICE)).toBe("38865763105965141239068");
    expect(() => rewardAmountAtCreate(dollars, null)).toThrow();
    expect(needsGoodDollarPrice([{ ...COMMITMENT_COMPOSER_DEFAULTS, ...dollars }])).toBe(true);
  });

  it("keeps an amount carried over in G$, and gives none to a promise without a reward", () => {
    const carried = {
      considerationRail: "CELO_SETTLEMENT",
      considerationUsd: undefined,
      considerationAmount: "38865000000000000000000",
    } as const;
    expect(rewardAmountAtCreate(carried, null)).toBe("38865000000000000000000");
    expect(needsGoodDollarPrice([{ ...COMMITMENT_COMPOSER_DEFAULTS, ...carried }])).toBe(false);
    // Shown back in dollars at today's rate, rounded down to the cent.
    expect(carriedOverUsd(carried.considerationAmount, PRICE)).toBe("4.99");
    expect(rewardAmountAtCreate({ ...dollars, considerationRail: "NONE" }, PRICE)).toBe("");
  });
});

describe("the review's status row", () => {
  type Status = SeedCopyProgress["status"];
  type Miss = SeedCopyProgress["miss"];
  const copies = (...runs: Array<[number, Status, Miss?]>): SeedCopyProgress[] =>
    runs.flatMap(([count, status, miss], run) =>
      Array.from({ length: count }, (_, index) => ({
        clientCommitmentId: `copy-${run}-${index}`,
        status,
        ...(miss ? { miss } : {}),
        txHash: null,
        jobId: miss === "declined" || miss === "refused" ? null : "job",
      }))
    );
  const view = (sent: SeedCopyProgress[], options: { sending?: boolean; pass?: number } = {}) =>
    seedStatusView({
      mode: "bundle",
      isSending: options.sending ?? false,
      copies: sent,
      pass: options.pass === undefined ? sent : sent.slice(sent.length - options.pass),
      total: sent.length,
      grouped: true,
      formatMessage: createIntl({ locale: "en", messages: {}, onError: () => {} }).formatMessage,
    });

  it.each([
    ["declined", copies([10, "not-sent", "declined"]), "declined", 10],
    ["refused", copies([9, "not-sent", "declined"], [1, "not-sent", "refused"]), "refused", 10],
    ["lost", copies([10, "not-sent", "failed"]), "unconfirmed", 10],
    ["partial", copies([7, "created"], [2, "not-sent", "declined"], [1, "later"]), "partial", 2],
    ["finished later", copies([9, "created"], [1, "later"]), "finishLater", 0],
    ["created", copies([10, "created"]), "created", 0],
  ] as const)("reads a %s pass, with what Try Again would send", (_, sent, phase, retry) => {
    expect(view([...sent])).toMatchObject({ phase, retry });
  });

  it("asks the wallet about the copies this Create sends, a bundle of ten at a time", () => {
    expect(view(copies([15, "wallet"]), { sending: true }).title).toBe(
      "Approve in your wallet: 10 promises in one request (1 of 2)"
    );
    // A Try Again of three asks about three, not the ten in the set.
    expect(view(copies([7, "created"], [3, "wallet"]), { sending: true, pass: 3 }).title).toBe(
      "Approve in your wallet: 3 promises in one request"
    );
  });
});
