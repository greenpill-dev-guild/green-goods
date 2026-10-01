import { describe, expect, it } from "vitest";

import {
  type GroupableCommitment,
  groupCommitmentsForDisplay,
  selectRewardEdit,
} from "../modules/commitment-pooling/display-groups";
import {
  type CommitmentMetadataV1,
  parseCommitmentMetadata,
} from "../modules/commitment-pooling/metadata";
import type { Address } from "../types/domain";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const LINA = "0x2222222222222222222222222222222222222222" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

const WATER = "group-water-0001";
const COMPOST = "group-compost-01";

const metadata = new Map<string, CommitmentMetadataV1>([
  [
    "cid-water",
    { version: 1, title: "Household water survey", displayGroup: { version: 1, id: WATER } },
  ],
  [
    "cid-compost",
    { version: 1, title: "Household water survey", displayGroup: { version: 1, id: COMPOST } },
  ],
  ["cid-plain", { version: 1, title: "Repair the drip line" }],
]);

let nextId = 0;
function record(
  overrides: Partial<GroupableCommitment> & { id?: string } = {}
): GroupableCommitment & { id: string } {
  return {
    id: overrides.id ?? `c${++nextId}`,
    chainId: 42161,
    onchainState: "REQUESTED",
    cycleId: 3n,
    targetUnits: 1n,
    declaredUnitValue: null,
    declaredValueBasis: null,
    confirmers: [LINA],
    poolId: 7n,
    commitmentSeriesId: 0n,
    creator: STEWARD,
    unitLabel: "survey",
    needUID: null,
    counterCommitmentId: 0n,
    considerationRail: "CELO_SETTLEMENT",
    considerationSource: ZERO,
    considerationToken: ZERO,
    direction: "REQUEST",
    commitmentType: "SUPPORT_SERVICE",
    claimMode: "OPEN",
    dueDate: 1_790_000_000n,
    requiresAssessment: false,
    contributorPolicy: "LEAD_MANAGED",
    confirmationThreshold: 1,
    protocolFallbackEnabled: false,
    metadataCID: "cid-water",
    ...overrides,
  };
}

const copies = (count: number, overrides: Partial<GroupableCommitment> = {}) =>
  Array.from({ length: count }, () => record(overrides));

describe("promises shown as groups", () => {
  it("folds a set's copies into one entry where the first stood, counting every state", () => {
    const before = record({ metadataCID: "cid-plain" });
    const set = [
      ...copies(4),
      ...copies(2, { onchainState: "ACCEPTED" }),
      record({ onchainState: "READY_FOR_CONFIRMATION" }),
      ...copies(2, { onchainState: "FULFILLED" }),
      record({ onchainState: "EXPIRED" }),
      record({ onchainState: "UNKNOWN" }),
    ];
    const after = record({ metadataCID: "cid-plain" });

    const entries = groupCommitmentsForDisplay({
      commitments: [before, set[0]!, after, ...set.slice(1)],
      metadataByCID: metadata,
    });

    expect(entries.map((entry) => entry.kind)).toEqual(["single", "group", "single"]);
    const group = entries[1];
    expect(group?.kind === "group" && group.displayGroupId).toBe(WATER);
    expect(group?.kind === "group" && group.counts).toEqual({
      published: 11,
      available: 4,
      inProgress: 3,
      kept: 2,
      ended: 1,
      other: 1,
    });
  });

  it("keeps apart copies from another set, or with other terms, but not another reward amount", () => {
    const entries = groupCommitmentsForDisplay({
      commitments: [
        ...copies(3),
        ...copies(2, { metadataCID: "cid-compost" }),
        ...copies(2, { dueDate: 1_790_086_400n }),
        ...copies(2, { claimMode: "APPROVAL_GATED" }),
        // Only a garden may take these up: another promise, even under the same id.
        ...copies(2, { claimType: "GARDEN" }),
        // Edit Reward changed the untaken copies' amount: still the same group.
        ...copies(2, { considerationAmount: 40_000n } as Partial<GroupableCommitment>),
      ],
      metadataByCID: metadata,
    });

    expect(
      entries.map((entry) => (entry.kind === "group" ? entry.children.length : "single"))
    ).toEqual([5, 2, 2, 2, 2]);
  });

  it("shows ordinary rows when the group can't be read", () => {
    const unreadable = [
      record({ metadataCID: null }),
      record({ metadataCID: "cid-not-fetched" }),
      record({ metadataCID: "cid-plain" }),
      record({ metadataCID: "0" }),
    ];
    // Metadata reaches the fold through the parser, which reads a display group
    // of a later version as none.
    const later = new Map(metadata);
    const parsed = parseCommitmentMetadata({
      version: 1,
      title: "Household water survey",
      displayGroup: { version: 2, id: WATER },
    });
    if (parsed) later.set("cid-water", parsed);

    for (const [commitments, metadataByCID] of [
      [unreadable, metadata],
      [copies(3), later],
    ] as const) {
      const entries = groupCommitmentsForDisplay({ commitments, metadataByCID });
      expect(entries.every((entry) => entry.kind === "single")).toBe(true);
      expect(entries).toHaveLength(commitments.length);
    }
  });

  it("shows a lone published copy as an ordinary row", () => {
    const entries = groupCommitmentsForDisplay({ commitments: copies(1), metadataByCID: metadata });
    expect(entries.map((entry) => entry.kind)).toEqual(["single"]);
  });

  it("makes one group of fifteen after five are added to a group of ten", () => {
    const added = [...copies(10), ...copies(5)];
    const [entry, ...rest] = groupCommitmentsForDisplay({
      commitments: added,
      metadataByCID: metadata,
    });

    expect(rest).toEqual([]);
    expect(entry?.kind === "group" && entry.counts.published).toBe(15);
    expect(
      entry?.kind === "group" && new Set(entry.children.map((child) => child.dueDate)).size
    ).toBe(1);
  });
});

describe("Edit Reward", () => {
  const taken = record({ onchainState: "ACCEPTED" });
  const open = [record(), record(), record({ onchainState: "OFFERED" })];

  it("changes only the copies nobody has taken", () => {
    const edit = selectRewardEdit([taken, ...open, record({ onchainState: "CANCELLED" })]);
    expect(edit).toEqual({ open: true, targets: open });
  });

  it.each([
    {
      label: "one copy is kept",
      children: [record({ onchainState: "FULFILLED" }), ...open],
      unsent: 0,
      reason: "kept",
    },
    { label: "a copy is still unsent", children: open, unsent: 1, reason: "unsent" },
    { label: "every copy is taken", children: [taken, taken], unsent: 0, reason: "none-available" },
  ])("closes once $label", ({ children, unsent, reason }) => {
    expect(selectRewardEdit(children, { unsent })).toEqual({ open: false, reason });
  });
});
