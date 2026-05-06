import { describe, expect, it } from "vitest";
import {
  aggregateCampaignCookieJarOperators,
  buildCampaignCookieJarCampaigns,
  buildCampaignCookieJarMetadata,
  deriveCampaignCookieJarClaimState,
  diffCampaignCookieJarAllowlist,
  parseCampaignAddressList,
  parseCampaignCookieJarFallbacks,
  parseCampaignCookieJarMetadata,
} from "../../utils/cookie-jar-campaign";
import type { Address } from "../../types/domain";
import type { IndexedCampaignCookieJar } from "../../types/cookie-jar";

const GARDEN_A = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN_B = "0x2222222222222222222222222222222222222222" as Address;
const GARDEN_C = "0x3333333333333333333333333333333333333333" as Address;
const OPERATOR_A = "0x4444444444444444444444444444444444444444" as Address;
const OPERATOR_B = "0x5555555555555555555555555555555555555555" as Address;
const EXTRA = "0x6666666666666666666666666666666666666666" as Address;
const JAR = "0x7777777777777777777777777777777777777777" as Address;
const CREATOR = "0x8888888888888888888888888888888888888888" as Address;

function indexedJar(overrides: Partial<IndexedCampaignCookieJar> = {}): IndexedCampaignCookieJar {
  return {
    id: `11155111-${JAR.toLowerCase()}`,
    chainId: 11155111,
    factoryAddress: "0x9999999999999999999999999999999999999999" as Address,
    jarAddress: JAR,
    creator: CREATOR,
    rawMetadata: JSON.stringify(
      buildCampaignCookieJarMetadata({
        title: "Earth Week Cookie Jar",
        slug: "earth-week",
        sourceGardens: [GARDEN_A],
        extraAllowlist: [EXTRA],
        chainId: 11155111,
        createdAt: 1770000000,
      })
    ),
    sourceGardens: [],
    extraAllowlist: [],
    isValidCampaign: true,
    createdAt: 1770000000,
    metadataUpdatedAt: 1770000001,
    txHash: "0xtx",
    ...overrides,
  };
}

describe("cookie jar campaign utilities", () => {
  it("parses comma, whitespace, and CSV-style address lists with invalid tokens", () => {
    const result = parseCampaignAddressList(`${OPERATOR_A}, ${OPERATOR_A}\n${EXTRA}; nope`);

    expect(result.addresses).toEqual([OPERATOR_A, EXTRA]);
    expect(result.invalidAddresses).toEqual(["nope"]);
  });

  it("aggregates one operator per selected garden and dedupes manual extras", () => {
    const result = aggregateCampaignCookieJarOperators({
      gardens: [
        {
          id: GARDEN_A,
          name: "North Garden",
          operators: [OPERATOR_A, OPERATOR_B],
        },
        {
          id: GARDEN_B,
          name: "South Garden",
          operators: [OPERATOR_A],
        },
        {
          id: GARDEN_C,
          name: "No Operators",
          operators: [],
        },
      ],
      selectedGardenIds: [GARDEN_A, GARDEN_B, GARDEN_C],
      extraAddressesInput: `${OPERATOR_B}, ${EXTRA}`,
    });

    expect(result.allowlist).toEqual([OPERATOR_A, OPERATOR_B, EXTRA]);
    expect(result.sources).toHaveLength(3);
    expect(result.missingOperatorGardens.map((source) => source.gardenAddress)).toEqual([GARDEN_C]);
    expect(result.extraAllowlist).toEqual([OPERATOR_B, EXTRA]);
  });

  it("round-trips compact metadata and drops invalid metadata", () => {
    const metadata = buildCampaignCookieJarMetadata({
      title: "Earth Week",
      slug: "earth-week",
      description: "A seasonal campaign for garden operator rewards.",
      image: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzd",
      externalUrl: "https://greengoods.app/cookies?campaign=earth-week",
      sourceGardens: [GARDEN_A, GARDEN_A, GARDEN_B],
      extraAllowlist: [EXTRA],
      chainId: 11155111,
      createdAt: 1770000000,
    });

    expect(metadata.sourceGardens).toEqual([GARDEN_A, GARDEN_B]);
    expect(metadata.description).toBe("A seasonal campaign for garden operator rewards.");
    expect(metadata.image).toBe(
      "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzd"
    );
    expect(metadata.externalUrl).toBe("https://greengoods.app/cookies?campaign=earth-week");
    expect(parseCampaignCookieJarMetadata(JSON.stringify(metadata))).toEqual(metadata);
    expect(
      parseCampaignCookieJarMetadata(JSON.stringify({ ...metadata, kind: "other" }))
    ).toBeNull();
  });

  it("drops unsafe optional metadata URLs", () => {
    const metadata = buildCampaignCookieJarMetadata({
      title: "Earth Week",
      slug: "earth-week",
      description: "Launch<script>alert('x')</script>",
      image: "javascript:alert(1)",
      externalUrl: "ftp://example.com/campaign",
      sourceGardens: [GARDEN_A],
      extraAllowlist: [],
      chainId: 11155111,
      createdAt: 1770000000,
    });

    expect(metadata.description).toBe("Launch<script>alert('x')</script>");
    expect(metadata.image).toBeUndefined();
    expect(metadata.externalUrl).toBeUndefined();
  });

  it("lists only jars from trusted creators with valid campaign metadata", () => {
    const trusted = buildCampaignCookieJarCampaigns({
      indexedJars: [
        indexedJar(),
        indexedJar({
          id: "11155111-0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          jarAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address,
          creator: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address,
        }),
        indexedJar({
          id: "11155111-0xcccccccccccccccccccccccccccccccccccccccc",
          jarAddress: "0xcccccccccccccccccccccccccccccccccccccccc" as Address,
          rawMetadata: JSON.stringify({ kind: "other", version: 1 }),
        }),
      ],
      trustedCreators: [CREATOR],
    });

    expect(trusted).toHaveLength(1);
    expect(trusted[0]).toMatchObject({
      address: JAR,
      slug: "earth-week",
      title: "Earth Week Cookie Jar",
      source: "indexed",
    });
  });

  it("uses fresh factory metadata over stale indexed metadata", () => {
    const freshMetadata = buildCampaignCookieJarMetadata({
      title: "GoodDollar Cookie Jar",
      slug: "good-dollar",
      sourceGardens: [GARDEN_B],
      extraAllowlist: [],
      chainId: 11155111,
      createdAt: 1770000100,
    });

    const campaigns = buildCampaignCookieJarCampaigns({
      indexedJars: [indexedJar({ rawMetadata: "" })],
      trustedCreators: [CREATOR],
      metadataByJarAddress: {
        [JAR.toLowerCase()]: JSON.stringify(freshMetadata),
      },
    });

    expect(campaigns[0]?.slug).toBe("good-dollar");
    expect(campaigns[0]?.title).toBe("GoodDollar Cookie Jar");
  });

  it("parses dev fallback jars without classifying them as indexed campaigns", () => {
    const fallbacks = parseCampaignCookieJarFallbacks(JSON.stringify({ "earth-week": JAR }));

    expect(fallbacks).toEqual([
      expect.objectContaining({
        address: JAR,
        slug: "earth-week",
        source: "fallback",
      }),
    ]);
  });

  it("diffs current and desired allowlists case-insensitively", () => {
    const diff = diffCampaignCookieJarAllowlist({
      current: [OPERATOR_A.toUpperCase() as Address, OPERATOR_B],
      desired: [OPERATOR_A, EXTRA],
    });

    expect(diff.grant).toEqual([EXTRA]);
    expect(diff.revoke).toEqual([OPERATOR_B]);
  });

  it("requires fixed jars to cover the fixed amount before claiming", () => {
    const state = deriveCampaignCookieJarClaimState({
      hasConnectedUser: true,
      isEligible: true,
      isPaused: false,
      withdrawalType: "fixed",
      fixedAmount: 10n,
      maxWithdrawal: 10n,
      balance: 5n,
      oneTimeWithdrawal: false,
      totalWithdrawn: 0n,
      withdrawalInterval: 0n,
      lastWithdrawalTime: 0n,
    });

    expect(state).toEqual({ canClaimNow: false, nextClaimAt: null });
  });

  it("allows variable jars to claim less than max when the jar has some balance", () => {
    const state = deriveCampaignCookieJarClaimState({
      hasConnectedUser: true,
      isEligible: true,
      isPaused: false,
      withdrawalType: "variable",
      fixedAmount: 0n,
      maxWithdrawal: 100n,
      balance: 5n,
      oneTimeWithdrawal: false,
      totalWithdrawn: 0n,
      withdrawalInterval: 0n,
      lastWithdrawalTime: 0n,
    });

    expect(state).toEqual({ canClaimNow: true, nextClaimAt: null });
  });

  it("blocks paused, already-claimed, and cooling-down jars", () => {
    const base = {
      hasConnectedUser: true,
      isEligible: true,
      withdrawalType: "fixed" as const,
      fixedAmount: 10n,
      maxWithdrawal: 10n,
      balance: 10n,
      withdrawalInterval: 100n,
      lastWithdrawalTime: 1_000n,
      now: 1_050,
    };

    expect(
      deriveCampaignCookieJarClaimState({
        ...base,
        isPaused: true,
        oneTimeWithdrawal: false,
        totalWithdrawn: 0n,
      }).canClaimNow
    ).toBe(false);
    expect(
      deriveCampaignCookieJarClaimState({
        ...base,
        isPaused: false,
        oneTimeWithdrawal: true,
        totalWithdrawn: 10n,
      }).canClaimNow
    ).toBe(false);
    expect(
      deriveCampaignCookieJarClaimState({
        ...base,
        isPaused: false,
        oneTimeWithdrawal: false,
        totalWithdrawn: 0n,
      })
    ).toEqual({ canClaimNow: false, nextClaimAt: 1_100 });
  });
});
