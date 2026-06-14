/**
 * buildHubStageModel — stageCounts source-of-truth test
 *
 * Guards the Hub header "pipeline summary" (#563 review P2): the stage counts
 * that feed both the tab-rail badges and the header MetaStrip are derived from
 * the *unfiltered* works/assessments/hypercerts, independent of any active
 * search term. Reading the search-filtered queue lengths in the header made the
 * two disagree whenever an operator searched; this pins the unfiltered contract.
 */

import { describe, expect, it } from "vitest";

import { buildHubStageModel } from "../../../hooks/admin-ui/hub/hub.workbenchModel";

const baseInput = {
  requestedStage: "work" as const,
  canManage: true,
  canAssess: true,
  canCertify: true,
  canBrowseHistory: true,
};

describe("buildHubStageModel stageCounts", () => {
  it("derives unfiltered pipeline counts from raw works/assessments/hypercerts", () => {
    const { stageCounts } = buildHubStageModel({
      ...baseInput,
      works: [{ status: "pending" }, { status: "pending" }, { status: "approved" }],
      assessments: [{ id: "a1" }, { id: "a2" }, { id: "a3" }],
      hypercerts: [{ id: "a3" }], // a3 already certified → excluded from the certify queue
    });

    expect(stageCounts.work).toBe(2); // two pending submissions
    expect(stageCounts.assess).toBe(1); // one approved submission awaiting assessment
    expect(stageCounts.certify).toBe(2); // three assessments minus one already certified
    expect(stageCounts.history).toBeUndefined();
  });

  it("reports the full pipeline regardless of which stage is requested", () => {
    // The header summary must report every stage even when the operator is
    // viewing a single one — the counts are not scoped to requestedStage.
    const { stageCounts } = buildHubStageModel({
      ...baseInput,
      requestedStage: "certify",
      works: [{ status: "pending" }, { status: "approved" }, { status: "approved" }],
      assessments: [{ id: "a1" }],
      hypercerts: [],
    });

    expect(stageCounts.work).toBe(1);
    expect(stageCounts.assess).toBe(2);
    expect(stageCounts.certify).toBe(1);
  });
});
