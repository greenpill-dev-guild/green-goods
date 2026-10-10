import { describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";
import { getGardenCommunityFromSubgraph } from "../../../modules/data/gardens";
import type { GraphQLReader } from "../../../modules/data/graphql-client";

const COMMUNITY = "0x1111111111111111111111111111111111111111" as Address;
const GARDEN = "0x2222222222222222222222222222222222222222" as Address;

describe("Gardens GraphQLReader boundary", () => {
  it("maps a community using an injected reader", async () => {
    const query = vi.fn().mockResolvedValue({
      data: {
        registryCommunity: {
          id: COMMUNITY,
          communityName: "River Garden",
          registerStakeAmount: "12",
          registerToken: "0x3333333333333333333333333333333333333333",
          membersCount: 4,
          garden: { id: GARDEN },
          strategies: [],
        },
      },
    });

    await expect(
      getGardenCommunityFromSubgraph(COMMUNITY, GARDEN, 42161, {
        query,
      } as GraphQLReader)
    ).resolves.toMatchObject({
      gardenAddress: GARDEN,
      communityAddress: COMMUNITY,
      stakeAmount: 12n,
    });
    expect(query).toHaveBeenCalledWith(
      expect.anything(),
      { communityAddress: COMMUNITY },
      expect.any(String)
    );
  });
});
