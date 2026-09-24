/**
 * gardenRosterCache Tests
 *
 * A failed membership write undoes only what its optimistic step changed. The
 * regression: cancelling the wallet prompt for someone who already held the
 * role "undid" a no-op add into a removal, hiding a real member until refetch.
 */

import { describe, expect, it } from "vitest";
import {
  applyOptimisticUpdate,
  isOnCachedRoster,
  rollBackFailedWrite,
} from "../../../hooks/garden/gardenRosterCache";
import type { Garden } from "../../../types/domain";

const GARDEN_ID = "0x1111111111111111111111111111111111111111";
// The indexer stores lowercase; stewards type or paste checksummed addresses.
const MEMBER = "0xabcdef0000000000000000000000000000000001";
const MEMBER_CHECKSUMMED = "0xABCDEF0000000000000000000000000000000001";
const NEWCOMER = "0x2222222222222222222222222222222222222222";

function gardensWithGardeners(gardeners: string[]): Garden[] {
  return [{ id: GARDEN_ID, gardeners } as unknown as Garden];
}

function failAfterOptimisticStep(
  gardens: Garden[],
  operationType: "add" | "remove",
  targetAddress: string
): Garden[] {
  const wasOnRoster = isOnCachedRoster(gardens, GARDEN_ID, "gardener", targetAddress);
  const optimistic = applyOptimisticUpdate(
    gardens,
    GARDEN_ID,
    "gardener",
    operationType,
    targetAddress
  );
  return rollBackFailedWrite(
    optimistic,
    GARDEN_ID,
    { memberType: "gardener", operationType, targetAddress },
    wasOnRoster
  );
}

describe("hooks/garden/gardenRosterCache", () => {
  it("keeps an existing member when their duplicate add fails", () => {
    const after = failAfterOptimisticStep(
      gardensWithGardeners([MEMBER]),
      "add",
      MEMBER_CHECKSUMMED
    );

    expect(after[0].gardeners).toEqual([MEMBER]);
  });

  it("drops a newcomer whose add failed", () => {
    const after = failAfterOptimisticStep(gardensWithGardeners([MEMBER]), "add", NEWCOMER);

    expect(after[0].gardeners).toEqual([MEMBER]);
  });

  it("restores a member whose removal failed", () => {
    const after = failAfterOptimisticStep(gardensWithGardeners([MEMBER]), "remove", MEMBER);

    expect(after[0].gardeners).toEqual([MEMBER]);
  });
});
