import { createMockHypercertRecord, createMockWork } from "../../test-utils/mock-factories";
import { describe, expect, it } from "vitest";
import {
  filterAssessments,
  filterHypercerts,
  filterWorksByScope,
  selectToConfirmForGarden,
} from "../../../hooks/admin-ui/hub/hub.filters";
import type { Address } from "../../../types/domain";
import { commitmentFixture, toConfirmFixture } from "../../test-utils/commitment-pooling-fixtures";

const idsOf = (list: { id: string }[]) => list.map((item) => item.id);

describe("Hub Work tab scopes", () => {
  const CLEANUP_ACTION = 7;
  const actions = new Map([[CLEANUP_ACTION, { title: "Riverbank cleanup" }]]);
  const works = [
    createMockWork({ id: "pending-old", createdAt: 1, status: "pending", actionUID: 1 }),
    createMockWork({ id: "pending-new", createdAt: 4, status: "pending", actionUID: 1 }),
    createMockWork({
      id: "approved-old",
      createdAt: 2,
      status: "approved",
      actionUID: CLEANUP_ACTION,
    }),
    createMockWork({ id: "approved-new", createdAt: 3, status: "approved", actionUID: 1 }),
    // Rejected work belongs to neither scope.
    createMockWork({ id: "rejected", createdAt: 5, status: "rejected", actionUID: 1 }),
  ];

  it.each([
    { scope: "pending", sort: "newest", search: "", expected: ["pending-new", "pending-old"] },
    { scope: "pending", sort: "oldest", search: "", expected: ["pending-old", "pending-new"] },
    { scope: "approved", sort: "newest", search: "", expected: ["approved-new", "approved-old"] },
    { scope: "approved", sort: "oldest", search: "", expected: ["approved-old", "approved-new"] },
    { scope: "approved", sort: "newest", search: "riverbank", expected: ["approved-old"] },
    { scope: "pending", sort: "newest", search: "riverbank", expected: [] },
  ] as const)('lists $scope work, $sort first, searching "$search"', ({
    scope,
    sort,
    search,
    expected,
  }) => {
    expect(idsOf(filterWorksByScope(works, scope, actions, search, sort))).toEqual(expected);
  });
});

describe("Hub record lists", () => {
  it("lists every assessment, newest first, and searches its title and description", () => {
    const assessments = [
      { id: "older", title: "Q1 baseline", description: "Riverbank survey", createdAt: 1 },
      { id: "newer", title: "Q2 baseline", description: null, createdAt: 2 },
    ];

    expect(idsOf(filterAssessments(assessments, ""))).toEqual(["newer", "older"]);
    expect(idsOf(filterAssessments(assessments, "riverbank"))).toEqual(["older"]);
    expect(idsOf(filterAssessments(assessments, "q2"))).toEqual(["newer"]);
  });

  it("lists minted hypercerts, newest first, and searches title and work scopes", () => {
    const hypercerts = [
      createMockHypercertRecord({
        id: "42161-1",
        title: "Canopy 2025",
        description: null,
        workScopes: ["planting"],
        mintedAt: 10,
      }),
      createMockHypercertRecord({
        id: "42161-2",
        title: "Solar sessions",
        description: null,
        workScopes: ["training"],
        mintedAt: 20,
      }),
    ];

    expect(idsOf(filterHypercerts(hypercerts, ""))).toEqual(["42161-2", "42161-1"]);
    expect(idsOf(filterHypercerts(hypercerts, "planting"))).toEqual(["42161-1"]);
    expect(idsOf(filterHypercerts(hypercerts, "solar"))).toEqual(["42161-2"]);
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
