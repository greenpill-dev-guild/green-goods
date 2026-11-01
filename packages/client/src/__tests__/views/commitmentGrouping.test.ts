import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import type { CommitmentMetadataV1, InboxCommitment } from "@green-goods/shared/commitment-pooling";
import { describe, expect, it } from "vitest";

import { foldIdenticalCopies, groupByGarden } from "../../views/Home/CommitmentsSheet/grouping";

const row = (id: string, poolId: bigint) =>
  ({ commitment: { id, poolId }, seat: "provider", needsYou: false }) as never;

const pool = (poolId: bigint, garden: string) => ({ poolId, garden }) as never;
const garden = (id: string, name: string) => ({ id, name }) as never;

describe("groupByGarden", () => {
  it("keeps two gardens that share a name apart", () => {
    const groups = groupByGarden(
      [row("a", 1n), row("b", 2n)],
      [pool(1n, "0xaaa"), pool(2n, "0xbbb")],
      [garden("0xaaa", "Riverside"), garden("0xbbb", "Riverside")]
    );
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.gardenName === "Riverside")).toBe(true);
  });

  it("collects gardens it cannot name into one group, not one each", () => {
    // A member holding a commitment in a garden they are not in has no name for
    // it. One heading per unknown garden, all reading the same word, tells them
    // less than a single group does.
    const groups = groupByGarden(
      [row("a", 1n), row("b", 2n)],
      [pool(1n, "0xaaa"), pool(2n, "0xbbb")],
      []
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toHaveLength(2);
  });

  it("puts what it cannot name after the gardens it can", () => {
    const groups = groupByGarden(
      [row("a", 1n), row("b", 2n)],
      [pool(1n, "0xaaa"), pool(2n, "0xzzz")],
      [garden("0xzzz", "Zinnia")]
    );
    expect(groups.map((g) => g.gardenName)).toEqual(["Zinnia", "Other"]);
  });
});

describe("foldIdenticalCopies", () => {
  const CID = "bafy-hub-day";
  const metadata = new Map<string, CommitmentMetadataV1>([
    [CID, { version: 1, title: "Four-hour hub day" }],
  ]);
  const offer = (
    commitmentId: bigint,
    overrides: Partial<InboxCommitment> = {}
  ): InboxCommitment => ({
    commitment: commitmentFixture({
      commitmentId,
      direction: "OFFER",
      onchainState: "OFFERED",
      derivedState: "OFFERED",
      metadataCID: CID,
    }),
    seat: "provider",
    needsYou: false,
    ...overrides,
  });
  const ids = (rows: InboxCommitment[]) => rows.map((entry) => entry.commitment.commitmentId);

  it("folds the copies where the first stood, and leaves everything else its own row", () => {
    const taken = offer(9n, {
      commitment: commitmentFixture({ commitmentId: 9n, metadataCID: CID }),
    });
    const entries = foldIdenticalCopies(
      [taken, offer(1n), offer(2n), offer(3n)],
      metadata,
      new Set()
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["row", "copies"]);
    const fold = entries[1];
    expect(fold?.kind === "copies" && ids(fold.rows)).toEqual([1n, 2n, 3n]);
  });

  it("keeps a copy's own row when it waits on the reader or didn't send", () => {
    const entries = foldIdenticalCopies(
      [offer(1n), offer(2n), offer(3n), offer(4n, { needsYou: true })],
      metadata,
      new Set(["3"])
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["copies", "row", "row"]);
  });

  it("shows a lone copy as an ordinary row", () => {
    expect(foldIdenticalCopies([offer(1n)], metadata, new Set())[0]?.kind).toBe("row");
  });
});
