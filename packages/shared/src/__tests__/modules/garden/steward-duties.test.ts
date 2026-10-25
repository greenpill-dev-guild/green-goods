/**
 * What waits for a steward in one garden (PWA Home step 19, decisions 22 and 27): the queues the
 * phone can act on, in Needs Your Attention's order, each counted from what its own screen lists.
 * Who may see each queue is decided where the queues are read (hooks/garden/useStewardDuties).
 */

import { describe, expect, it } from "vitest";
import type {
  CommitmentClaimRequestRecord,
  CommitmentReadModel,
  PoolClaimRequestRow,
} from "../../../modules/commitment-pooling/types-core";
import { selectStewardDuties } from "../../../modules/garden/steward-duties";
import type { Work } from "../../../types/domain";
import { createMockWork } from "../../test-utils/mock-factories";

function work(id: string, createdAt: number): Work {
  return createMockWork({ id, createdAt, status: "pending" });
}

function commitment(commitmentId: bigint): CommitmentReadModel {
  return { commitmentId, id: `42161-${commitmentId}` } as unknown as CommitmentReadModel;
}

const READER = "0xa11ce00000000000000000000000000000000001";
const NEIGHBOUR = "0xb0b0000000000000000000000000000000000002";

function claim(
  commitmentId: bigint,
  requestedAt: number,
  state = "PENDING",
  who: { claimant?: string; requestedBy?: string } = {}
): PoolClaimRequestRow {
  const claimant = who.claimant ?? NEIGHBOUR;
  return {
    claim: {
      commitmentId,
      requestedAt,
      state,
      claimant,
      requestedBy: who.requestedBy ?? claimant,
    } as unknown as CommitmentClaimRequestRecord,
    commitment: commitment(commitmentId),
  };
}

const NOTHING = { viewer: READER, toReview: [], pendingClaims: [], toConfirm: [] };

describe("selectStewardDuties", () => {
  it("lists nothing when nothing waits", () => {
    expect(selectStewardDuties(NOTHING)).toEqual([]);
  });

  it("lists work to review, then take-up requests, then promises to confirm, each with its count", () => {
    const duties = selectStewardDuties({
      viewer: READER,
      toReview: [work("0x02", 200), work("0x01", 100)],
      pendingClaims: [claim(4n, 10)],
      toConfirm: [commitment(9n), commitment(8n)],
    });

    expect(duties.map((duty) => [duty.kind, duty.count])).toEqual([
      ["review", 2],
      ["takeUp", 1],
      ["confirm", 2],
    ]);
  });

  it("marks work to review uncounted while the garden's list is incomplete, keeping what it read", () => {
    const duties = selectStewardDuties({
      ...NOTHING,
      toReview: [createMockWork({ id: "0x02" })],
      reviewComplete: false,
    });

    expect(duties).toMatchObject([{ kind: "review", count: 1, uncounted: true }]);
  });

  it("names the work waiting longest first, so its row can say how long someone has waited", () => {
    const [review] = selectStewardDuties({
      ...NOTHING,
      toReview: [work("0x03", 300), work("0x01", 100), work("0x02", 200)],
    });

    expect(review.kind === "review" && review.works.map((item) => item.id)).toEqual([
      "0x01",
      "0x02",
      "0x03",
    ]);
  });

  it("gives each promise with waiting take-up requests its own row, newest request first", () => {
    const duties = selectStewardDuties({
      ...NOTHING,
      pendingClaims: [claim(4n, 10), claim(5n, 50), claim(4n, 30), claim(6n, 40, "ACCEPTED")],
    });

    expect(
      duties.map((duty) =>
        duty.kind === "takeUp" ? [duty.commitment.commitmentId, duty.count, duty.newestAt] : null
      )
    ).toEqual([
      [5n, 1, 50],
      [4n, 2, 30],
    ]);
  });

  it("does not count a take-up request the reader made, for themselves or for someone else", () => {
    const duties = selectStewardDuties({
      ...NOTHING,
      pendingClaims: [
        claim(4n, 10, "PENDING", { claimant: READER.toUpperCase().replace("0X", "0x") }),
        claim(4n, 20, "PENDING", { claimant: NEIGHBOUR, requestedBy: READER }),
        claim(4n, 30),
      ],
    });

    expect(duties.map((duty) => (duty.kind === "takeUp" ? duty.count : null))).toEqual([1]);
  });
});
