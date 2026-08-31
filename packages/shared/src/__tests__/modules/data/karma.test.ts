import { describe, expect, it, vi } from "vitest";

import { getKarmaGardenProjection } from "../../../modules/data/karma";
import type { GraphQLReader } from "../../../modules/data/graphql-client";
import type { Address } from "../../../types/domain";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const ZERO_UID = `0x${"00".repeat(32)}` as const;

describe("getKarmaGardenProjection", () => {
  it("maps indexer states and normalizes bytes32(0) to no project", async () => {
    const query = vi.fn().mockResolvedValue({
      data: {
        Garden: [
          {
            gapProjectUID: ZERO_UID,
            karmaProjectState: "UNKNOWN",
            karmaDetailsState: "PENDING",
            karmaMembershipState: "SYNCED",
            karmaAccessState: "FAILED",
            karmaProjectUpdateState: "UNKNOWN",
            karmaAccessFailedAccounts: [GARDEN],
            karmaLastSyncAt: 123,
          },
        ],
      },
    });

    const projection = await getKarmaGardenProjection(GARDEN, 42161, {
      query,
    } as GraphQLReader);

    expect(query).toHaveBeenCalledWith(
      expect.anything(),
      { gardenAddress: GARDEN, chainId: 42161 },
      "getKarmaGardenProjection"
    );
    expect(projection).toMatchObject({
      projectUID: null,
      projectState: "unknown",
      detailsState: "pending",
      membershipState: "synced",
      accessState: "failed",
      projectUpdateState: "unknown",
      accessFailedAccounts: [GARDEN],
      lastSyncAt: 123,
    });
  });

  it("surfaces GraphQL reader errors", async () => {
    const failure = new Error("indexer unavailable");
    const reader = {
      query: vi.fn().mockResolvedValue({ error: failure }),
    } as GraphQLReader;

    await expect(getKarmaGardenProjection(GARDEN, 42161, reader)).rejects.toBe(failure);
  });
});
