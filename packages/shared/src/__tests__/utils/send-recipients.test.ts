import { describe, expect, it } from "vitest";
import type { Address, Garden } from "../../types/domain";
import {
  buildRecipientDirectory,
  buildSendRecipientGroups,
  flattenRecipientMembers,
  sharedGardenNames,
} from "../../utils/app/send-recipients";

const SELF = "0x1111111111111111111111111111111111111111" as Address;
const ALICE = "0x2222222222222222222222222222222222222222" as Address;
const BOB = "0x3333333333333333333333333333333333333333" as Address;

function garden(partial: Partial<Garden>): Garden {
  return {
    id: "0xgarden",
    name: "Garden",
    location: "",
    bannerImage: "",
    chainId: 42161,
    tokenAddress: "0x0000000000000000000000000000000000000000" as Address,
    tokenID: 0n,
    description: "",
    createdAt: 0,
    operators: [],
    gardeners: [],
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    assessments: [],
    works: [],
    ...partial,
  } as Garden;
}

describe("buildSendRecipientGroups", () => {
  it("excludes the current user and flags their gardens as mine, sorted first", () => {
    const groups = buildSendRecipientGroups(
      [
        garden({ id: "0xa", name: "A (not mine)", gardeners: [ALICE] }),
        garden({ id: "0xb", name: "B (mine)", gardeners: [SELF, BOB] }),
      ],
      SELF
    );

    expect(groups[0].gardenName).toBe("B (mine)");
    expect(groups[0].isMine).toBe(true);
    // SELF is never listed as a recipient.
    expect(groups[0].members.map((m) => m.address)).toEqual([BOB]);
    expect(groups[1].isMine).toBe(false);
  });

  it("merges roles for a member who holds several in one garden", () => {
    const [group] = buildSendRecipientGroups(
      [garden({ gardeners: [ALICE], operators: [ALICE], owners: [ALICE] })],
      SELF
    );
    expect(group.members).toHaveLength(1);
    // Canonical order: owner before operator before gardener.
    expect(group.members[0].roles).toEqual(["owner", "operator", "gardener"]);
  });

  it("drops gardens with no other members", () => {
    const groups = buildSendRecipientGroups([garden({ gardeners: [SELF] })], SELF);
    expect(groups).toEqual([]);
  });
});

describe("flattenRecipientMembers", () => {
  it("dedupes an address that appears across multiple gardens", () => {
    const groups = buildSendRecipientGroups(
      [
        garden({ id: "0xa", name: "A", gardeners: [ALICE] }),
        garden({ id: "0xb", name: "B", operators: [ALICE, BOB] }),
      ],
      SELF
    );
    const flat = flattenRecipientMembers(groups);
    const alice = flat.filter((m) => m.address === ALICE);
    expect(alice).toHaveLength(1);
    expect(flat.map((m) => m.address).sort()).toEqual([ALICE, BOB].sort());
  });
});

describe("buildRecipientDirectory", () => {
  it("splits my gardens from others and indexes members by address", () => {
    const directory = buildRecipientDirectory(
      [
        garden({ id: "0xmine", name: "Mine", gardeners: [SELF, ALICE] }),
        garden({ id: "0xother", name: "Other", gardeners: [ALICE, BOB] }),
      ],
      SELF
    );

    expect(directory.myGardens.map((g) => g.gardenName)).toEqual(["Mine"]);
    expect(directory.otherGardens.map((g) => g.gardenName)).toEqual(["Other"]);
    // Alice belongs to both gardens.
    expect(directory.byAddress.get(ALICE.toLowerCase())?.gardens).toHaveLength(2);
  });

  it("computes the gardens the sender and a member share", () => {
    const directory = buildRecipientDirectory(
      [
        garden({ id: "0xmine", name: "Mine", gardeners: [SELF, ALICE] }),
        garden({ id: "0xother", name: "Other", gardeners: [ALICE, BOB] }),
      ],
      SELF
    );

    // Alice shares "Mine" with the sender; Bob shares nothing.
    expect(sharedGardenNames(directory, ALICE)).toEqual(["Mine"]);
    expect(sharedGardenNames(directory, BOB)).toEqual([]);
  });
});
