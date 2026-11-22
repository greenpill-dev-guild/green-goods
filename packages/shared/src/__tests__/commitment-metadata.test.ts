import { describe, expect, it, vi } from "vitest";

import {
  buildCommitmentMetadata,
  COMMITMENT_METADATA_VERSION,
  isResolvableMetadataCID,
  parseCommitmentMetadata,
  rewardCentsAsSet,
} from "../modules/commitment-pooling/metadata";
import {
  promiseRewardLegsOf,
  rewardCentsAsSetTotal,
} from "../modules/commitment-pooling/reward-legs";
import {
  buildCommitmentCreationPayload,
  COMMITMENT_COMPOSER_DEFAULTS,
} from "../hooks/commitment-pooling/useCommitmentComposerForm";
import type { Address } from "../types/domain";

// Preserve the future enabled reward metadata contract.
vi.mock("../config/app", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../config/app")>()),
  SETTLEMENT_ENABLED: true,
}));

describe("commitment metadata", () => {
  it("keeps a title to one line so a pasted paragraph cannot break a row", () => {
    expect(buildCommitmentMetadata({ title: "Compost\n\n  workshop " }).title).toBe(
      "Compost workshop"
    );
  });

  it("refuses to publish a commitment with no name", () => {
    expect(() => buildCommitmentMetadata({ title: "   " })).toThrow();
  });

  // The write limits and the read tolerance side by side: metadata written
  // before the limits, longer than anyone can write today, still reads whole.
  const text = (length: number) => "x".repeat(length);
  it.each([
    { label: "a 60-character title", field: "title", length: 60, written: 60, read: 60 },
    { label: "a 61-character title", field: "title", length: 61, written: "refused", read: 61 },
    { label: "a 121-character title", field: "title", length: 121, written: "refused", read: 120 },
    { label: "a 280-character note", field: "note", length: 280, written: 280, read: 280 },
    { label: "a 281-character note", field: "note", length: 281, written: "refused", read: 281 },
    {
      label: "a 2,001-character note",
      field: "note",
      length: 2001,
      written: "refused",
      read: 2000,
    },
  ] as const)("writes and reads $label", ({ field, length, written, read }) => {
    const words =
      field === "title" ? { title: text(length) } : { title: "Rides", note: text(length) };
    const write = () => buildCommitmentMetadata(words)[field]?.length;
    if (written === "refused") expect(write).toThrow(`${field} can be at most`);
    else expect(write()).toBe(written);
    expect(parseCommitmentMetadata({ version: 1, ...words })?.[field]?.length).toBe(read);
  });

  it("omits an absent note rather than writing an empty one", () => {
    expect(buildCommitmentMetadata({ title: "Rides" })).toEqual({
      version: COMMITMENT_METADATA_VERSION,
      title: "Rides",
    });
    expect(buildCommitmentMetadata({ title: "Rides", note: "  " })).not.toHaveProperty("note");
  });

  it("reads back what it wrote", () => {
    const written = buildCommitmentMetadata({ title: "Rides", note: "To the market" });
    expect(parseCommitmentMetadata(written)).toEqual(written);
  });

  it("returns null rather than throwing on anything unusable", () => {
    // A commitment whose caption is missing is still real and still binding, so
    // the screen has to keep rendering.
    for (const junk of [null, undefined, 42, "a string", {}, { title: "" }, { title: 7 }]) {
      expect(parseCommitmentMetadata(junk)).toBeNull();
    }
  });

  it("keeps an unknown version rather than discarding a readable title", () => {
    expect(parseCommitmentMetadata({ version: 99, title: "Rides" })).toEqual({
      version: 99,
      title: "Rides",
    });
  });

  it("spends a request only on a CID that could resolve", () => {
    expect(isResolvableMetadataCID("bafy...")).toBe(true);
    for (const empty of [null, undefined, "", "   ", "0", "-"]) {
      expect(isResolvableMetadataCID(empty)).toBe(false);
    }
  });
});

describe("composer metadata handoff", () => {
  const payload = () =>
    buildCommitmentCreationPayload({
      values: {
        ...COMMITMENT_COMPOSER_DEFAULTS,
        title: "Compost workshop",
        note: "Two hours on Saturday",
        unitLabel: "hours",
        targetUnits: 2,
      },
      clientCommitmentId: "draft-1",
      poolId: 7n,
      creator: "0x1111111111111111111111111111111111111111" as Address,
      gardenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address,
      nowSeconds: 1_700_000_000,
    });

  it("carries the words instead of a CID, so composing works with no signal", () => {
    const built = payload();
    expect(built.metadataCID).toBe("");
    expect(built.metadata).toEqual({
      version: COMMITMENT_METADATA_VERSION,
      title: "Compost workshop",
      note: "Two hours on Saturday",
    });
  });

  it("stays a pure function, so the same draft always hashes the same", () => {
    expect(payload()).toEqual(payload());
  });

  it("gives a copy of a set the set's deadline and group, whenever it is built", () => {
    const copy = (nowSeconds: number) =>
      buildCommitmentCreationPayload({
        values: {
          ...COMMITMENT_COMPOSER_DEFAULTS,
          title: "Survey",
          unitLabel: "survey",
          count: 10,
        },
        clientCommitmentId: "copy-1",
        poolId: 7n,
        creator: "0x1111111111111111111111111111111111111111" as Address,
        gardenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address,
        nowSeconds,
        dueDate: 1_790_000_000n,
        displayGroup: { version: 1, id: "group-00000001" },
      });

    expect(copy(1_700_000_000)).toEqual(copy(1_700_086_400));
    expect(copy(1_700_000_000)).toMatchObject({
      dueDate: 1_790_000_000n,
      metadata: { displayGroup: { version: 1, id: "group-00000001" } },
    });
  });
});

describe("commitment metadata v1 note and links", () => {
  it("writes the note and links under the schema's names", () => {
    expect(
      buildCommitmentMetadata({
        title: "Prune",
        note: "  Bring  gloves ",
        links: [{ url: "https://example.org/plan", label: "Plan" }],
      })
    ).toEqual({
      version: 1,
      title: "Prune",
      note: "Bring gloves",
      links: [{ url: "https://example.org/plan", label: "Plan" }],
    });
  });

  it("reads a note, and still reads the older description field as the note", () => {
    expect(
      parseCommitmentMetadata({ version: 1, title: "Prune", note: "Bring gloves" })?.note
    ).toBe("Bring gloves");
    expect(
      parseCommitmentMetadata({ version: 1, title: "Prune", description: "Bring gloves" })?.note
    ).toBe("Bring gloves");
  });

  it("drops links that are not web addresses rather than failing the whole document", () => {
    expect(
      parseCommitmentMetadata({
        version: 1,
        title: "Prune",
        links: [{ url: "https://example.org/a" }, { url: "javascript:alert(1)" }, { url: 5 }],
      })?.links
    ).toEqual([{ url: "https://example.org/a" }]);
  });
});

describe("commitment metadata display group", () => {
  const group = { version: 1 as const, id: "5f0c2b1e-8a4d-4c2e-9f3a-1b2c3d4e5f60" };

  it("writes a set's group into every copy and reads it back", () => {
    const written = buildCommitmentMetadata({
      title: "Household water survey",
      displayGroup: group,
    });
    expect(written.displayGroup).toEqual(group);
    expect(parseCommitmentMetadata(written)).toEqual(written);
  });

  it("refuses a group id no reader could use, rather than writing a copy that stands alone", () => {
    for (const id of ["", "short", "has spaces in it", "<script>x</script>", "x".repeat(65)]) {
      expect(() =>
        buildCommitmentMetadata({ title: "Survey", displayGroup: { version: 1, id } })
      ).toThrow("display group");
    }
  });

  it("reads a group it doesn't understand as none, and keeps the title", () => {
    for (const displayGroup of [
      { version: 2, id: group.id },
      { version: 1, id: 42 },
      "group-1",
      null,
    ]) {
      const parsed = parseCommitmentMetadata({ version: 1, title: "Survey", displayGroup });
      expect(parsed).toEqual({ version: 1, title: "Survey" });
    }
  });
});

describe("commitment metadata reward, as the steward set it", () => {
  /** $5.00 at the reserve's 2026-09-30 price. */
  const wei = 38_865_763_105_965_141_239_068n;
  const reward = { version: 1 as const, usdCents: "500", goodDollarWei: wei.toString() };

  it("keeps the dollars typed beside the G$ they became, once per set", () => {
    const built = buildCommitmentCreationPayload({
      values: {
        ...COMMITMENT_COMPOSER_DEFAULTS,
        title: "Survey",
        unitLabel: "survey",
        considerationRail: "CELO_SETTLEMENT",
        considerationUsd: "$5.00",
        considerationAmount: wei.toString(),
      },
      clientCommitmentId: "copy-1",
      poolId: 7n,
      creator: "0x1111111111111111111111111111111111111111" as Address,
      gardenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address,
      nowSeconds: 1_700_000_000,
    });
    expect(built.metadata?.reward).toEqual(reward);
    expect(parseCommitmentMetadata(built.metadata)).toEqual(built.metadata);
  });

  it("reads the dollars only while the chain still holds that G$ amount", () => {
    const metadata = buildCommitmentMetadata({ title: "Survey", reward });
    expect(rewardCentsAsSet(metadata, wei)).toBe(500n);
    // After Edit Reward the amount moved and the record did not: today's rate, then.
    expect(rewardCentsAsSet(metadata, wei + 1n)).toBeNull();
    expect(rewardCentsAsSet({}, wei)).toBeNull();
  });

  it("refuses a record no reader could use, and reads one it doesn't understand as none", () => {
    expect(() =>
      buildCommitmentMetadata({ title: "Survey", reward: { ...reward, usdCents: "0" } })
    ).toThrow("reward record");
    for (const bad of [{ ...reward, version: 2 }, { ...reward, goodDollarWei: "-5" }, "500"]) {
      expect(parseCommitmentMetadata({ version: 1, title: "Survey", reward: bad })).toEqual({
        version: 1,
        title: "Survey",
      });
    }
  });
});

describe("commitment reward legs, declared at Create", () => {
  const ARBITRUM_USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
  const wei = 38_865_763_105_965_141_239_068n;
  const reward = {
    version: 1 as const,
    usdCents: "500",
    goodDollarWei: wei.toString(),
    goodDollarPrice: "128647930734508",
  };
  const usdcLeg = {
    version: 1 as const,
    chainId: 42161,
    token: ARBITRUM_USDC,
    amount: "5000000",
    usdCents: "500",
  };
  const goodDollarPromise = {
    considerationRail: "CELO_SETTLEMENT" as const,
    considerationAmount: wei,
  };

  it("keeps the G$ price and the USDC part, and reads them back as one reward", () => {
    const metadata = buildCommitmentMetadata({ title: "Survey", reward, rewardLegs: [usdcLeg] });
    expect(parseCommitmentMetadata(metadata)).toEqual(metadata);
    const read = promiseRewardLegsOf(goodDollarPromise, metadata);
    expect(read?.incomplete).toBe(false);
    expect(read?.legs.map((leg) => [leg.rail, leg.symbol, leg.chainId, leg.amount])).toEqual([
      ["celo-settlement", "G$", 42220, wei],
      ["steward-wallet", "USDC", 42161, 5_000_000n],
    ]);
    expect(rewardCentsAsSetTotal(read!)).toBe(1_000n);
  });

  it("records the G$ price and the declared parts when a promise is created", () => {
    const built = buildCommitmentCreationPayload({
      values: {
        ...COMMITMENT_COMPOSER_DEFAULTS,
        title: "Survey",
        unitLabel: "survey",
        considerationRail: "CELO_SETTLEMENT",
        considerationUsd: "$5.00",
        considerationAmount: wei.toString(),
      },
      clientCommitmentId: "copy-1",
      poolId: 7n,
      creator: "0x1111111111111111111111111111111111111111" as Address,
      gardenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address,
      nowSeconds: 1_700_000_000,
      goodDollarPrice: 128_647_930_734_508n,
      rewardLegs: [usdcLeg],
    });
    expect(built.metadata?.reward).toEqual(reward);
    expect(built.metadata?.rewardLegs).toEqual([usdcLeg]);
  });

  it("refuses a Create whose USDC part isn't the G$ part's dollars", () => {
    const build = (rewardLegs: (typeof usdcLeg)[], considerationUsd = "$5.00") =>
      buildCommitmentCreationPayload({
        values: {
          ...COMMITMENT_COMPOSER_DEFAULTS,
          title: "Survey",
          unitLabel: "survey",
          considerationRail: "CELO_SETTLEMENT",
          considerationUsd,
          considerationAmount: wei.toString(),
        },
        clientCommitmentId: "copy-1",
        poolId: 7n,
        creator: "0x1111111111111111111111111111111111111111" as Address,
        gardenAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address,
        nowSeconds: 1_700_000_000,
        rewardLegs,
      });
    expect(() => build([{ ...usdcLeg, usdCents: "600", amount: "6000000" }])).toThrow("equal");
    // The amount paid is exactly the dollars it stands for: $5.00 is never 5,000 USDC.
    expect(() => build([{ ...usdcLeg, amount: "5000000000" }])).toThrow("equal");
    // Without the price the G$ amount came from, nothing shows the two parts balance.
    expect(() => build([usdcLeg])).toThrow("equal");
    // With no G$ part set in dollars there is nothing to balance it against.
    expect(() => build([usdcLeg], "")).toThrow();
  });

  it("reads a G$-only reward as one part, as before there were parts", () => {
    const read = promiseRewardLegsOf(
      goodDollarPromise,
      buildCommitmentMetadata({ title: "Survey", reward })
    );
    expect(read).toEqual({
      incomplete: false,
      legs: [expect.objectContaining({ symbol: "G$", amount: wei, usdCentsAsSet: 500n })],
    });
    expect(
      promiseRewardLegsOf({ considerationRail: "NONE", considerationAmount: 0n }, null)
    ).toBeNull();
  });

  it("says part of a reward can't be shown rather than show part of it as the whole", () => {
    // A leg this reader can't parse makes the list unreadable, never shorter.
    const unreadable = parseCommitmentMetadata({
      version: 1,
      title: "Survey",
      rewardLegs: [usdcLeg, { ...usdcLeg, token: "not-an-address" }],
    });
    expect(unreadable?.rewardLegs).toBeUndefined();
    expect(promiseRewardLegsOf(goodDollarPromise, unreadable)?.incomplete).toBe(true);
    // A token the registry doesn't list, and G$ itself, can't be a wallet-paid part.
    for (const token of [
      "0x1111111111111111111111111111111111111111",
      "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a",
    ]) {
      const metadata = buildCommitmentMetadata({
        title: "Survey",
        rewardLegs: [{ ...usdcLeg, chainId: token.startsWith("0x62") ? 42220 : 42161, token }],
      });
      expect(promiseRewardLegsOf(goodDollarPromise, metadata)?.incomplete).toBe(true);
    }
    // A part whose amount isn't the dollars it states can't be shown truthfully.
    expect(
      promiseRewardLegsOf(
        goodDollarPromise,
        buildCommitmentMetadata({
          title: "Survey",
          rewardLegs: [{ ...usdcLeg, amount: "5000000000" }],
        })
      )?.incomplete
    ).toBe(true);
    // A total never mixes dollars as set with a part that reads only in G$.
    expect(
      rewardCentsAsSetTotal(
        promiseRewardLegsOf(
          goodDollarPromise,
          buildCommitmentMetadata({ title: "Survey", rewardLegs: [usdcLeg] })
        )!
      )
    ).toBeNull();
  });

  it("refuses legs no reader could use: a token twice, too many, or a bad amount", () => {
    for (const rewardLegs of [
      [usdcLeg, usdcLeg],
      Array.from({ length: 5 }, (_, index) => ({ ...usdcLeg, chainId: index + 1 })),
      [{ ...usdcLeg, amount: "0" }],
    ]) {
      expect(() => buildCommitmentMetadata({ title: "Survey", rewardLegs })).toThrow("reward legs");
    }
  });
});
