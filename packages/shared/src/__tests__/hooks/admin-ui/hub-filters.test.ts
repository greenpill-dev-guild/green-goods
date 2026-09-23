import { createMockWork } from "@green-goods/shared/testing";
import { describe, expect, it } from "vitest";
import {
  filterAssessmentQueue,
  filterPendingWorks,
  selectToConfirmForGarden,
} from "../../../hooks/admin-ui/hub/hub.filters";
import type { Address } from "../../../types/domain";
import { commitmentFixture, toConfirmFixture } from "../../test-utils/commitment-pooling-fixtures";

describe("Hub work queue filters", () => {
  it("moves only the reviewed work out of pending and into its next state", () => {
    const reviewed = createMockWork({ id: "reviewed", createdAt: 2, status: "pending" });
    const unrelated = createMockWork({ id: "unrelated", createdAt: 1, status: "pending" });
    const actions = new Map();

    const reconciled = [{ ...reviewed, status: "approved" as const }, unrelated];

    expect(filterPendingWorks(reconciled, actions, "", "newest")).toEqual([unrelated]);
    expect(filterAssessmentQueue(reconciled, actions, "")).toEqual([
      expect.objectContaining({ id: reviewed.id, status: "approved" }),
    ]);
  });
});

describe("selectToConfirmForGarden", () => {
  const ROCINHA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
  const AIYELOJA = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address;
  const row = (id: bigint, poolGarden: Address) => ({
    commitment: commitmentFixture({ commitmentId: id, onchainState: "READY_FOR_CONFIRMATION" }),
    seat: "confirmer" as const,
    needsYou: true,
    poolGarden,
  });
  const fallback = (
    id: bigint,
    garden: Address,
    path: "POOL_FALLBACK" | "PROTOCOL_FALLBACK" = "POOL_FALLBACK"
  ) => ({
    commitment: commitmentFixture({ commitmentId: id, onchainState: "READY_FOR_CONFIRMATION" }),
    path,
    garden,
    gardenName: garden === ROCINHA ? "Rocinha" : "Aiyeloja",
    activeContributors: [],
  });
  const disputed = (id: bigint, garden: Address) => ({
    commitment: commitmentFixture({ commitmentId: id, onchainState: "DISPUTED" }),
    garden,
    gardenName: garden === ROCINHA ? "Rocinha" : "Aiyeloja",
  });
  // What the reader's stewardship spans: two gardens, and a protocol fallback
  // whose acting authority happens to be the garden in the header.
  const everyGarden = toConfirmFixture({
    groups: [
      { garden: ROCINHA, gardenName: "Rocinha", rows: [row(1n, ROCINHA), row(2n, AIYELOJA)] },
      { garden: AIYELOJA, gardenName: "Aiyeloja", rows: [row(3n, AIYELOJA)] },
    ],
    fallback: [
      fallback(4n, ROCINHA),
      fallback(5n, AIYELOJA),
      fallback(6n, ROCINHA, "PROTOCOL_FALLBACK"),
    ],
    disputed: [disputed(7n, ROCINHA), disputed(8n, AIYELOJA)],
    count: 8,
  });
  const ids = (scoped: typeof everyGarden) => ({
    groups: scoped.groups.flatMap((group) => group.rows.map((r) => r.commitment.commitmentId)),
    fallback: scoped.fallback.map((r) => r.commitment.commitmentId),
    disputed: (scoped.disputed ?? []).map((r) => r.commitment.commitmentId),
    count: scoped.count,
  });

  it.each([
    {
      header: "Rocinha, in any letter case",
      garden: ROCINHA.toUpperCase().replace("0X", "0x") as Address,
      // Row 2 lives in Aiyeloja's pool but is Rocinha's to confirm, so it stays;
      // the protocol fallback belongs to Community → Coordination, never here.
      expected: { groups: [1n, 2n], fallback: [4n], disputed: [7n], count: 4 },
    },
    {
      header: "Aiyeloja",
      garden: AIYELOJA,
      expected: { groups: [3n], fallback: [5n], disputed: [8n], count: 3 },
    },
    {
      header: "no garden",
      garden: null,
      expected: { groups: [], fallback: [], disputed: [], count: 0 },
    },
  ])("lists only what $header confirms, and counts only that", ({ garden, expected }) => {
    expect(ids(selectToConfirmForGarden(everyGarden, garden))).toEqual(expected);
  });

  it("keeps the read state and reads a queue with no disputes as none", () => {
    const scoped = selectToConfirmForGarden({ ...everyGarden, disputed: undefined }, ROCINHA);
    expect(scoped.disputed).toEqual([]);
    expect(scoped).toMatchObject({ isSteward: true, isLoading: false, isError: false });
    expect(scoped.refetch).toBe(everyGarden.refetch);
  });
});
