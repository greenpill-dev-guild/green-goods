/**
 * Pending-review derivation tests — the shared filter behind the Work Dashboard's
 * Needs Review list and the arrival toast's review count.
 */

import { describe, expect, it } from "vitest";
import type { Work } from "../../types/domain";
import type { EASWorkApproval } from "../../types/eas-responses";
import {
  collectApprovalRecipientsForWorks,
  collectApprovedWorkUIDs,
  filterPendingNeedsReview,
} from "../../utils/work/pending-review";

const VIEWER = "0xAbC0000000000000000000000000000000000001";
const OTHER_GARDENER = "0xDef0000000000000000000000000000000000002";
const GARDEN = "0x1111111111111111111111111111111111111111";

function makeWork(id: string, gardenerAddress: string): Work {
  return { id, gardenerAddress } as unknown as Work;
}

function makeApproval(workUID: string): EASWorkApproval {
  return { workUID } as unknown as EASWorkApproval;
}

describe("filterPendingNeedsReview", () => {
  it("keeps only works not reviewed by anyone and not authored by the viewer", () => {
    const works = [
      makeWork("w1", OTHER_GARDENER), // pending, someone else's → needs review
      makeWork("w2", OTHER_GARDENER), // approved already → excluded
      makeWork("w3", VIEWER), // viewer's own submission → excluded
    ];

    const pending = filterPendingNeedsReview(works, new Set(["w2"]), VIEWER);

    expect(pending.map((work) => work.id)).toEqual(["w1"]);
  });

  it("compares the viewer address case-insensitively", () => {
    const works = [makeWork("w1", VIEWER.toUpperCase().replace("0X", "0x"))];
    expect(filterPendingNeedsReview(works, new Set(), VIEWER.toLowerCase())).toEqual([]);
  });

  it("excludes agent-approved works when the approval set was built recipient-agnostically", () => {
    // The agent bot attests approvals with recipient = gardener (not garden). As long as the
    // approvals were fetched for gardens ∪ candidate gardeners, the workUID set excludes them.
    const agentApprovedWork = makeWork("w-agent", OTHER_GARDENER);
    const approvedUIDs = collectApprovedWorkUIDs([makeApproval("w-agent")]);

    expect(filterPendingNeedsReview([agentApprovedWork], approvedUIDs, VIEWER)).toEqual([]);
  });
});

describe("collectApprovalRecipientsForWorks", () => {
  it("unions garden ids with the candidate works' gardeners, deduped case-insensitively", () => {
    const works = [
      makeWork("w1", OTHER_GARDENER),
      makeWork("w2", OTHER_GARDENER.toLowerCase()), // same gardener, different casing
      makeWork("w3", GARDEN), // gardener address equal to a garden id → deduped
    ];

    const recipients = collectApprovalRecipientsForWorks([GARDEN], works);

    expect(recipients.map((recipient) => recipient.toLowerCase()).sort()).toEqual(
      [GARDEN.toLowerCase(), OTHER_GARDENER.toLowerCase()].sort()
    );
  });

  it("returns just the gardens when there are no candidate works", () => {
    expect(collectApprovalRecipientsForWorks([GARDEN], [])).toEqual([GARDEN]);
  });
});

describe("collectApprovedWorkUIDs", () => {
  it("collects the referenced workUIDs", () => {
    const set = collectApprovedWorkUIDs([makeApproval("w1"), makeApproval("w2")]);
    expect(set.has("w1")).toBe(true);
    expect(set.has("w2")).toBe(true);
    expect(set.has("w3")).toBe(false);
  });
});
