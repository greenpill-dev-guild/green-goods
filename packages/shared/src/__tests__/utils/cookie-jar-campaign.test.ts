import { describe, expect, it } from "vitest";
import {
  aggregateCampaignCookieJarOperators,
  buildCampaignCookieJarMetadata,
  diffCampaignCookieJarAllowlist,
  parseCampaignAddressList,
  parseCampaignCookieJarMetadata,
} from "../../utils/cookie-jar-campaign";
import type { Address } from "../../types/domain";

const GARDEN_A = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN_B = "0x2222222222222222222222222222222222222222" as Address;
const GARDEN_C = "0x3333333333333333333333333333333333333333" as Address;
const OPERATOR_A = "0x4444444444444444444444444444444444444444" as Address;
const OPERATOR_B = "0x5555555555555555555555555555555555555555" as Address;
const EXTRA = "0x6666666666666666666666666666666666666666" as Address;

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
      sourceGardens: [GARDEN_A, GARDEN_A, GARDEN_B],
      extraAllowlist: [EXTRA],
      chainId: 11155111,
      createdAt: 1770000000,
    });

    expect(metadata.sourceGardens).toEqual([GARDEN_A, GARDEN_B]);
    expect(parseCampaignCookieJarMetadata(JSON.stringify(metadata))).toEqual(metadata);
    expect(
      parseCampaignCookieJarMetadata(JSON.stringify({ ...metadata, kind: "other" }))
    ).toBeNull();
  });

  it("diffs current and desired allowlists case-insensitively", () => {
    const diff = diffCampaignCookieJarAllowlist({
      current: [OPERATOR_A.toUpperCase() as Address, OPERATOR_B],
      desired: [OPERATOR_A, EXTRA],
    });

    expect(diff.grant).toEqual([EXTRA]);
    expect(diff.revoke).toEqual([OPERATOR_B]);
  });
});
