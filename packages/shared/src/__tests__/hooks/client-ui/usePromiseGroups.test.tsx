/** @vitest-environment happy-dom */
// TEST-QUALITY: allow-small-test-file - the due clock's wiring into the Promises tab's group rows; how a set folds into one row and the count rule itself are proven in commitment-group-browsing.

/**
 * The Promises tab's group rows count a set's copies on the chain's clock, as the group's page
 * does (PRD-1347): a copy past due but still open on chain is ended, never available. No wallet
 * runtime is mounted here, so the device's clock stands in for the chain's.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type PoolListEntry,
  usePoolPromiseEntries,
} from "../../../hooks/client-ui/pool/usePromiseGroups";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type {
  CommitmentCycleRecord,
  CommitmentReadModel,
} from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import { commitmentFixture, cycleFixture } from "../../test-utils/commitment-pooling-fixtures";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const LINA = "0x2222222222222222222222222222222222222222" as Address;
const OMAR = "0x3333333333333333333333333333333333333333" as Address;

const mocks = vi.hoisted(() => ({
  /** The pool's cycles; undefined while unread. */
  cycles: undefined as CommitmentCycleRecord[] | undefined,
  metadata: new Map<string, CommitmentMetadataV1>([
    ["cid-dated", { version: 1, title: "Water survey", displayGroup: { version: 1, id: "dated" } }],
    ["cid-season", { version: 1, title: "Seed swap", displayGroup: { version: 1, id: "season" } }],
  ]),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentMetadata", () => ({
  useCommitmentMetadata: () => ({ byCID: mocks.metadata, isLoading: false }),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitmentCycles: () => ({
    data: mocks.cycles,
    isError: false,
    fetchStatus: "idle",
    refetch: vi.fn(),
  }),
}));

/** A copy of one of the steward's sets of requests, open on chain unless told otherwise. */
const copy = (id: number, metadataCID: string, overrides: Partial<CommitmentReadModel> = {}) =>
  commitmentFixture({
    commitmentId: BigInt(id),
    direction: "REQUEST",
    onchainState: "REQUESTED",
    derivedState: "REQUESTED",
    creator: STEWARD,
    leadProvider: null,
    metadataCID,
    ...overrides,
  });

/** A minute ago on the device's clock. */
const aMinuteAgo = () => BigInt(Math.floor(Date.now() / 1000)) - 60n;

/** The Promises tab with every copy listed, as Status: All and Kind: All list them. */
const render = (commitments: CommitmentReadModel[]) => {
  const rows = commitments.map((commitment) => ({ commitment }));
  return renderHookWithProviders(() =>
    usePoolPromiseEntries({ chainId: 42161, poolId: 7n, rows, commitments, viewer: LINA })
  );
};

const countsOf = (entries: readonly PoolListEntry<unknown>[], displayGroupId: string) => {
  const entry = entries.find(
    (each) => each.kind === "group" && each.group.displayGroupId === displayGroupId
  );
  if (entry?.kind !== "group") throw new Error(`expected the ${displayGroupId} set as one row`);
  return entry.group.counts;
};

describe("usePoolPromiseEntries", () => {
  beforeEach(() => {
    mocks.cycles = undefined;
  });

  it("counts a set past its due date as ended, none available, as the group's page does", () => {
    // Copies of a set share their due date, so they lapse together.
    const dueDate = aMinuteAgo();
    const { result } = render([
      copy(11, "cid-dated", { dueDate }),
      copy(12, "cid-dated", { dueDate }),
      copy(13, "cid-dated", {
        dueDate,
        onchainState: "ACCEPTED",
        derivedState: "ACTIVE",
        leadProvider: OMAR,
      }),
    ]);

    // Anyone may expire an untaken copy now; the one taken up keeps its count.
    expect(countsOf(result.current, "dated")).toMatchObject({
      published: 3,
      available: 0,
      inProgress: 1,
      ended: 2,
    });
  });

  it("keeps a set's chain counts while its season's end is unread, without holding another set", () => {
    const lapsed = aMinuteAgo();
    const { result, rerender } = render([
      // Without due dates of their own, these fall due when season 5 ends.
      copy(21, "cid-season", { cycleId: 5n }),
      copy(22, "cid-season", { cycleId: 5n }),
      copy(11, "cid-dated", { dueDate: lapsed }),
      copy(12, "cid-dated", { dueDate: lapsed }),
    ]);

    // Season 5's end is unread, so its set has no due date to pass yet. The dated set's has passed.
    expect(countsOf(result.current, "season")).toMatchObject({ available: 2, ended: 0 });
    expect(countsOf(result.current, "dated")).toMatchObject({ available: 0, ended: 2 });

    mocks.cycles = [cycleFixture({ cycleId: 5n, endTime: lapsed })];
    rerender();
    expect(countsOf(result.current, "season")).toMatchObject({ available: 0, ended: 2 });
  });
});
