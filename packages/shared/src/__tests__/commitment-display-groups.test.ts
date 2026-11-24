import { describe, expect, it } from "vitest";

import {
  editsTermsFromGroup,
  type GroupableCommitment,
  groupCommitmentsForDisplay,
  identicalOpenCopyKey,
  selectConfirmerEdit,
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
    creationSeen: true,
    requirements: [],
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
    claimType: "INDIVIDUAL",
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

    expect(entries.map((entry) => entry.kind)).toEqual(["single", "group", "single", "single"]);
    const group = entries[1];
    expect(group?.kind === "group" && group.displayGroupId).toBe(WATER);
    expect(group?.kind === "group" && group.counts).toEqual({
      published: 10,
      available: 4,
      inProgress: 3,
      kept: 2,
      ended: 1,
      other: 0,
    });
  });

  it("keeps apart copies from another set, or with other terms, but not another reward or confirmers", () => {
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
        // Edit Confirmers named others on the untaken copies: still the same group.
        ...copies(2, { confirmers: [STEWARD, LINA], confirmationThreshold: 2 }),
      ],
      metadataByCID: metadata,
    });

    expect(
      entries.map((entry) => (entry.kind === "group" ? entry.children.length : "single"))
    ).toEqual([7, 2, 2, 2, 2]);
  });

  it("requires known matching action/count terms and task content, while ignoring reward records", () => {
    const documents = new Map(metadata);
    documents.set("cid-other-task", {
      ...metadata.get("cid-water")!,
      note: "Repair the compost bins",
    });
    documents.set("cid-new-reward", {
      ...metadata.get("cid-water")!,
      reward: { version: 1, usdCents: "700", goodDollarWei: "7000" },
    });
    const entries = groupCommitmentsForDisplay({
      commitments: [
        ...copies(2, { requirements: [{ actionUID: 44n, requiredCount: 2 }] }),
        ...copies(2, { requirements: [{ actionUID: 45n, requiredCount: 2 }] }),
        ...copies(2, { requirements: [{ actionUID: 44n, requiredCount: 3 }] }),
        ...copies(2, { metadataCID: "cid-other-task" }),
        ...copies(2, { requirements: null }),
        ...copies(2, { metadataCID: "cid-new-reward" }),
        ...copies(2),
      ],
      metadataByCID: documents,
    });
    expect(
      entries.map((entry) => (entry.kind === "group" ? entry.children.length : "single"))
    ).toEqual([2, 2, 2, 2, "single", "single", 4]);
  });

  it("separates titles and links under one id, including delimiter-like content", () => {
    const documents = new Map(metadata);
    documents.set("cid-other-title", { ...metadata.get("cid-water")!, title: "Water | survey" });
    documents.set("cid-other-link", {
      ...metadata.get("cid-water")!,
      links: [{ url: "https://example.com/survey", label: "Field guide" }],
    });
    const entries = groupCommitmentsForDisplay({
      commitments: [
        ...copies(2),
        ...copies(2, { metadataCID: "cid-other-title" }),
        ...copies(2, { metadataCID: "cid-other-link" }),
      ],
      metadataByCID: documents,
    });
    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => entry.kind === "group" && entry.children.length === 2)).toBe(
      true
    );
  });

  it("keeps a later metadata document individual even if it carries a familiar group hint", () => {
    const documents = new Map(metadata);
    documents.set("cid-water", { ...metadata.get("cid-water")!, version: 2 });
    expect(
      groupCommitmentsForDisplay({ commitments: copies(2), metadataByCID: documents }).map(
        (entry) => entry.kind
      )
    ).toEqual(["single", "single"]);
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

  it.each([
    { unknown: "unseen creation", terms: { creationSeen: false } },
    { unknown: "UNKNOWN lifecycle", terms: { onchainState: "UNKNOWN" as const } },
    { unknown: "missing claim type", terms: { claimType: undefined } },
    { unknown: "UNKNOWN claim type", terms: { claimType: "UNKNOWN" as const } },
    { unknown: "missing assessment rule", terms: { requiresAssessment: undefined } },
    { unknown: "missing fallback rule", terms: { protocolFallbackEnabled: undefined } },
    { unknown: "missing confirmer list", terms: { confirmers: undefined } },
    { unknown: "missing threshold", terms: { confirmationThreshold: undefined } },
    { unknown: "missing deadline", terms: { dueDate: undefined } },
    { unknown: "missing consideration rail", terms: { considerationRail: undefined } },
    { unknown: "UNKNOWN consideration rail", terms: { considerationRail: "UNKNOWN" as const } },
    { unknown: "missing consideration source", terms: { considerationSource: undefined } },
    { unknown: "missing series sentinel", terms: { commitmentSeriesId: undefined } },
    { unknown: "missing unit label", terms: { unitLabel: undefined } },
    { unknown: "missing creator", terms: { creator: undefined } },
  ])("leaves siblings with $unknown individual instead of inferring compatibility", ({ terms }) => {
    const entries = groupCommitmentsForDisplay({
      commitments: copies(2, terms),
      metadataByCID: metadata,
    });
    expect(entries.map((entry) => entry.kind)).toEqual(["single", "single"]);
  });

  it("groups explicit no-deadline and no-consideration terms without treating false as missing", () => {
    const entries = groupCommitmentsForDisplay({
      commitments: copies(2, {
        dueDate: null,
        considerationRail: "NONE",
        considerationSource: null,
        considerationToken: null,
        commitmentSeriesId: null,
        requiresAssessment: false,
        protocolFallbackEnabled: false,
      }),
      metadataByCID: metadata,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "group", counts: { published: 2 } });
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

describe("identical open copies made apart (DL-150)", () => {
  const keyOf = (overrides: Partial<GroupableCommitment> = {}) =>
    identicalOpenCopyKey(record({ metadataCID: "cid-plain", ...overrides }), metadata);

  it("gives copies with no group id one key, whatever their reward amount", () => {
    expect(keyOf()).not.toBeNull();
    expect(keyOf()).toBe(keyOf());
    expect(keyOf()).toBe(keyOf({ considerationAmount: 40_000n } as Partial<GroupableCommitment>));
  });

  it.each<[string, Partial<GroupableCommitment>]>([
    ["creator", { creator: LINA }],
    ["kind", { commitmentType: "DOMAIN_IMPACT" }],
    ["direction", { direction: "OFFER" }],
    ["state", { onchainState: "OFFERED" }],
    ["due date", { dueDate: 1_790_086_400n }],
    ["cycle", { cycleId: 4n }],
    ["units", { targetUnits: 2n }],
    ["claim mode", { claimMode: "APPROVAL_GATED" }],
    ["requirements", { requirements: [{ actionUID: 44n, requiredCount: 2 }] }],
    ["reward rail", { considerationRail: "NONE" }],
    ["confirmer group", { confirmers: [STEWARD] }],
    ["words", { metadataCID: "cid-water" }],
  ])("keeps apart another %s", (_term, change) => {
    const key = keyOf(change);
    expect(key).not.toBeNull();
    expect(key).not.toBe(keyOf());
  });

  it.each<[string, Partial<GroupableCommitment>]>([
    ["taken up", { onchainState: "ACCEPTED" }],
    ["kept", { onchainState: "FULFILLED" }],
    ["missing a term", { requirements: null }],
    ["without words", { metadataCID: null }],
  ])("gives none to a record %s", (_state, change) => {
    expect(keyOf(change)).toBeNull();
  });

  it("folds unread words under their one CID, and leaves words it can't read ordinary", () => {
    const unread = identicalOpenCopyKey(record({ metadataCID: "cid-unread" }), metadata);
    expect(unread).not.toBeNull();
    expect(identicalOpenCopyKey(record({ metadataCID: "cid-other-unread" }), metadata)).not.toBe(
      unread
    );
    const later = new Map(metadata);
    later.set("cid-plain", { ...metadata.get("cid-plain")!, version: 2 });
    expect(identicalOpenCopyKey(record({ metadataCID: "cid-plain" }), later)).toBeNull();
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

describe("Edit Confirmers", () => {
  const open = [record(), record({ onchainState: "OFFERED" })];

  it("changes only the copies nobody has taken, even once one is kept", () => {
    const children = [record({ onchainState: "FULFILLED" }), record({ onchainState: "ACCEPTED" })];
    expect(selectConfirmerEdit([...children, ...open])).toEqual({ open: true, targets: open });
  });

  it("closes while a copy is unsent, and once every copy is taken", () => {
    expect(selectConfirmerEdit(open, { unsent: 1 })).toEqual({ open: false, reason: "unsent" });
    expect(selectConfirmerEdit([record({ onchainState: "ACCEPTED" })])).toEqual({
      open: false,
      reason: "none-available",
    });
  });
});

// PRD-1548: a copy whose words name a group is edited from the group only while the list shows
// one, or while the group still has copies queued to send.
describe("where a copy's reward and confirmers are edited", () => {
  const settled = { metadataByCID: metadata, wordsSettled: true, queuedCopies: 0 };

  it("edits a copy shown in its group from the group", () => {
    const [lone, sibling] = copies(2);
    expect(
      editsTermsFromGroup(lone!, { ...settled, groupId: WATER, commitments: [lone!, sibling!] })
    ).toBe(true);
  });

  it("edits a group's lone surviving copy on its own", () => {
    const lone = record();
    expect(editsTermsFromGroup(lone, { ...settled, groupId: WATER, commitments: [lone] })).toBe(
      false
    );
  });

  it("keeps both edits with the group while its other copies are still queued", () => {
    const lone = record();
    expect(
      editsTermsFromGroup(lone, {
        ...settled,
        groupId: WATER,
        commitments: [lone],
        queuedCopies: 2,
      })
    ).toBe(true);
  });

  // The inspector's own read carries no requirements, so it would never fold by itself: the
  // list's row for the copy decides.
  it("decides from the list's own row, not the copy as the inspector read it", () => {
    const [copy, sibling] = copies(2);
    const detailRead = { ...copy!, requirements: undefined } as unknown as typeof copy & {};
    expect(
      editsTermsFromGroup(detailRead, {
        ...settled,
        groupId: WATER,
        commitments: [copy!, sibling!],
      })
    ).toBe(true);
  });

  it("can't say until the list has the copy", () => {
    const [copy, sibling] = copies(2);
    expect(
      editsTermsFromGroup(copy!, { ...settled, groupId: WATER, commitments: [sibling!] })
    ).toBeNull();
  });

  it("edits a promise in no group on its own", () => {
    const plain = record({ metadataCID: "cid-plain" });
    expect(editsTermsFromGroup(plain, { ...settled, groupId: null, commitments: null })).toBe(
      false
    );
  });

  it("can't say while the pool's promises or their words are still being read", () => {
    const lone = record();
    expect(editsTermsFromGroup(lone, { ...settled, groupId: WATER, commitments: null })).toBeNull();
    expect(
      editsTermsFromGroup(lone, {
        ...settled,
        groupId: WATER,
        commitments: [lone],
        wordsSettled: false,
      })
    ).toBeNull();
  });
});
