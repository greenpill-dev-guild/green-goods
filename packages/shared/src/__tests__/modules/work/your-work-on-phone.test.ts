/**
 * Your Work on this phone, in one garden: what Home's Continue lists (PWA Home step 8) and the
 * Your Work badge counts once it counts the active garden (decisions 4 and 15, DL-061).
 */

import { describe, expect, it } from "vitest";
import {
  isInGarden,
  isWorkOnThisDevice,
  selectYourWorkOnPhone,
} from "../../../modules/work/your-work-on-phone";
import type { Work } from "../../../types/domain";
import { createMockWork } from "../../test-utils/mock-factories";

const ME = "0xA11CE00000000000000000000000000000000001";
const SOMEONE_ELSE = "0xB0B0000000000000000000000000000000000002";
const GARDEN = "0x6A7DE00000000000000000000000000000000AAA";
const OTHER_GARDEN = "0x0757E00000000000000000000000000000000BBB";

function work(overrides: Partial<Work> & { id: string }): Work {
  return createMockWork({
    gardenerAddress: ME,
    gardenAddress: GARDEN,
    status: "pending",
    createdAt: 1_700_000_000,
    ...overrides,
  });
}

function select(input: Partial<Parameters<typeof selectYourWorkOnPhone>[0]>) {
  return selectYourWorkOnPhone({
    gardenId: GARDEN,
    viewer: ME,
    works: [],
    decidedHere: [],
    waitingDecisionWorkIds: new Set(),
    drafts: [],
    proofs: [],
    ...input,
  });
}

describe("isWorkOnThisDevice", () => {
  it.each([
    ["queued offline", true, work({ id: "0xoffline_00ab", status: "offline" })],
    ["sending", true, work({ id: "0xoffline_00ac", status: "uploading" })],
    ["being checked", true, work({ id: "0xoffline_00ad", status: "syncing" })],
    ["stopped after its tries", true, work({ id: "0xoffline_00ae", status: "sync_failed" })],
    ["named by its client id", true, work({ id: "c7f1e2", status: "pending" })],
    ["on the record, waiting for review", false, work({ id: "0x9f00", status: "pending" })],
  ])("%s → %s", (_case, expected, item) => {
    expect(isWorkOnThisDevice(item)).toBe(expected);
  });
});

describe("isInGarden", () => {
  it("matches the garden whatever the address's case, and never another garden", () => {
    expect(isInGarden(GARDEN.toLowerCase(), GARDEN)).toBe(true);
    expect(isInGarden(OTHER_GARDEN, GARDEN)).toBe(false);
  });

  it("keeps an item whose garden is not known yet in every garden", () => {
    expect(isInGarden(null, GARDEN)).toBe(true);
    expect(isInGarden(undefined, OTHER_GARDEN)).toBe(true);
  });
});

describe("selectYourWorkOnPhone", () => {
  it("lists the reader's own queued work in the garden, and nothing on the record or elsewhere", () => {
    const queuedHere = work({ id: "0xoffline_0001", status: "offline" });
    const queuedLowercase = work({
      id: "0xoffline_0002",
      status: "sync_failed",
      gardenAddress: GARDEN.toLowerCase(),
    });
    const queuedElsewhere = work({
      id: "0xoffline_0003",
      status: "offline",
      gardenAddress: OTHER_GARDEN,
    });
    const sentInReview = work({ id: "0x5e47", status: "pending" });
    const approved = work({ id: "0xoffline_0004", status: "approved" });
    const someoneElses = work({
      id: "0xoffline_0005",
      status: "offline",
      gardenerAddress: SOMEONE_ELSE,
    });

    const { submissions } = select({
      works: [queuedHere, queuedLowercase, queuedElsewhere, sentInReview, approved, someoneElses],
    });

    expect(submissions.map((item) => item.id)).toEqual(["0xoffline_0001", "0xoffline_0002"]);
  });

  it("lists a review made here only while its upload waits, and only in its garden", () => {
    const waiting = work({ id: "0xDEC1", status: "approved", gardenerAddress: SOMEONE_ELSE });
    const alreadySent = work({ id: "0xdec2", status: "rejected", gardenerAddress: SOMEONE_ELSE });
    const waitingElsewhere = work({
      id: "0xdec3",
      status: "approved",
      gardenerAddress: SOMEONE_ELSE,
      gardenAddress: OTHER_GARDEN,
    });

    const { decisions } = select({
      decidedHere: [waiting, alreadySent, waitingElsewhere],
      // The upload queue names works in lowercase.
      waitingDecisionWorkIds: new Set(["0xdec1", "0xdec3"]),
    });

    expect(decisions.map((item) => item.id)).toEqual(["0xDEC1"]);
  });

  it("lists drafts and unsent proof in the garden, and those whose garden is not known yet", () => {
    const drafts = [
      { id: "here", gardenAddress: GARDEN.toLowerCase() },
      { id: "elsewhere", gardenAddress: OTHER_GARDEN },
      { id: "no-garden-yet", gardenAddress: null },
    ];
    const proofs = [
      { id: "proof-here", garden: GARDEN },
      { id: "proof-elsewhere", garden: OTHER_GARDEN },
      { id: "promise-unread", garden: null },
    ];

    const selected = select({ drafts, proofs });

    expect(selected.drafts.map((draft) => draft.id)).toEqual(["here", "no-garden-yet"]);
    expect(selected.proofs.map((proof) => proof.id)).toEqual(["proof-here", "promise-unread"]);
  });

  it("lists nothing of the reader's work before the reader is known", () => {
    const { submissions } = select({
      viewer: undefined,
      works: [work({ id: "0xoffline_0006", status: "offline" })],
    });

    expect(submissions).toEqual([]);
  });
});
