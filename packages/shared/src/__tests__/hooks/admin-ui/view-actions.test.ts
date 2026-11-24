/**
 * View-action grammar tests.
 *
 * Review, Garden, and Community keep fixed header actions. Community exposes the
 * same three coordination actions on every tab, with tab bodies carrying the
 * detail work.
 *
 *   1. id/order stability across tabs (button positions never shift),
 *   2. exactly one `primary` per active action set,
 *   3. the primary opens its flow directly on first click (no select-then-act),
 *   4. real targets only (no self-nav, no removed edit-domains header action),
 *   5. role/ownership gating still blanks unavailable actions.
 *
 * Supersedes the earlier tab-specific Community action grammar.
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildCommunityViewActions,
  type CommunityWorkspaceMode,
} from "../../../hooks/admin-ui/community/community.utils";
import {
  buildGardenViewActions,
  type GardenWorkspaceView,
} from "../../../hooks/admin-ui/garden/garden.utils";
import {
  buildReviewViewActions,
  type ReviewPipelineStage,
} from "../../../hooks/admin-ui/review/review.utils";

const GARDEN = "0xabcabcabcabcabcabcabcabcabcabcabcabcabca";

const REVIEW_STAGES: ReviewPipelineStage[] = ["confirm", "work", "assess", "certify"];
const GARDEN_VIEWS: GardenWorkspaceView[] = ["health", "pool", "activity", "impact"];

function visibleIds(actions: Array<{ id: string; visible?: boolean }>): string[] {
  return actions.filter((action) => action.visible !== false).map((action) => action.id);
}

function primaryIds(actions: Array<{ id: string; visible?: boolean; primary?: boolean }>) {
  return actions
    .filter((action) => action.visible !== false && action.primary)
    .map((action) => action.id);
}

describe("buildReviewViewActions — fixed primary", () => {
  const buildFor = (stage: ReviewPipelineStage) =>
    buildReviewViewActions(stage, true, true, vi.fn(), { gardenAddress: GARDEN });

  it("keeps the same action ids and order on every stage", () => {
    const expected = ["submit-work", "create-assessment", "create-hypercert"];
    for (const stage of REVIEW_STAGES) {
      expect(visibleIds(buildFor(stage))).toEqual(expected);
    }
  });

  it("declares submit-work as the fixed primary on every stage", () => {
    for (const stage of REVIEW_STAGES) {
      expect(primaryIds(buildFor(stage))).toEqual(["submit-work"]);
    }
  });

  it("keeps the full action trio on the confirmation stage", () => {
    const confirm = buildFor("confirm");
    expect(visibleIds(confirm)).toHaveLength(3);
    expect(primaryIds(confirm)).toEqual(["submit-work"]);
  });

  it("renders the trio outlined on every stage, so no action out-shouts the queue (DL-043)", () => {
    for (const stage of REVIEW_STAGES) {
      const variants = buildFor(stage).map((action) => action.variant);
      expect(variants).toEqual(["secondary", "secondary", "secondary"]);
    }
  });

  it("blanks role-gated actions for read-only stewards", () => {
    const actions = buildReviewViewActions("work", false, false, vi.fn(), {
      gardenAddress: GARDEN,
    });
    expect(visibleIds(actions)).toEqual([]);
  });

  it("makes create-assessment the declared primary for evaluator-only viewers, still outlined", () => {
    const actions = buildReviewViewActions("assess", false, true, vi.fn(), {
      gardenAddress: GARDEN,
    });

    expect(visibleIds(actions)).toEqual(["create-assessment"]);
    expect(primaryIds(actions)).toEqual(["create-assessment"]);
    expect(actions.find((action) => action.id === "create-assessment")?.variant).toBe("secondary");
  });

  it.each([
    "work",
    "confirm",
    "assess",
    "certify",
  ] as const)("opens each flow over %s, keeping its sort and scope (DL-140)", (stage) => {
    const navigate = vi.fn();
    const actions = buildReviewViewActions(stage, true, true, navigate, {
      gardenAddress: GARDEN,
      sort: "oldest",
      scope: "approved",
    });

    for (const id of ["submit-work", "create-assessment", "create-hypercert"]) {
      actions.find((action) => action.id === id)?.onClick();
    }

    const stageUrl = `/review/${stage}?gardenId=${GARDEN}&sort=oldest&scope=approved`;
    expect(navigate.mock.calls.map(([target]) => target)).toEqual([
      `${stageUrl}&item=submit-work`,
      `${stageUrl}&item=create-assessment`,
      `${stageUrl}&item=create-hypercert`,
    ]);
  });
});

describe("buildGardenViewActions — fixed primary", () => {
  const buildFor = (view: GardenWorkspaceView) =>
    buildGardenViewActions(view, true, true, vi.fn(), { gardenAddress: GARDEN });

  it("keeps View Public and Edit Garden first, in order, on every view", () => {
    for (const view of GARDEN_VIEWS) {
      expect(visibleIds(buildFor(view)).slice(0, 2)).toEqual(["view-public", "edit-garden"]);
    }
  });

  it("makes Seed Promises the Promises tab's primary, so its + leads to adding (PRD-1491)", () => {
    for (const view of GARDEN_VIEWS) {
      const actions = buildFor(view);
      if (view === "pool") {
        expect(visibleIds(actions)).toEqual(["view-public", "edit-garden", "seed-promises"]);
        expect(primaryIds(actions)).toEqual(["seed-promises"]);
      } else {
        expect(visibleIds(actions)).toEqual(["view-public", "edit-garden"]);
        expect(primaryIds(actions)).toEqual(["edit-garden"]);
      }
    }
    // The canonical gardenId and the older gardenAddress both reach the seeding flow.
    for (const context of [{ gardenId: GARDEN }, { gardenAddress: GARDEN }]) {
      const navigate = vi.fn();
      buildGardenViewActions("pool", true, true, navigate, context)
        .find((action) => action.id === "seed-promises")
        ?.onClick();
      expect(navigate).toHaveBeenCalledWith(`/garden/pool/seed?gardenId=${GARDEN}`);
    }
  });

  it("dropped the header edit-domains action — domains are edited in Settings", () => {
    for (const view of GARDEN_VIEWS) {
      expect(buildFor(view).some((action) => action.id === "edit-domains")).toBe(false);
    }
  });

  it("opens Edit Garden over the view it was pressed from, keeping its context (DL-140)", () => {
    const navigate = vi.fn();
    buildGardenViewActions("impact", true, true, navigate, {
      gardenAddress: GARDEN,
      range: "90d",
      section: "hypercerts",
    })
      .find((action) => action.id === "edit-garden")
      ?.onClick();

    expect(navigate).toHaveBeenCalledWith(
      `/garden/impact?gardenId=${GARDEN}&range=90d&section=hypercerts&item=edit-garden`
    );
  });

  it("dropped the header add-member action — membership is community-owned", () => {
    // Membership lives at /community/members (Manage Members → Add members);
    // the Garden header must not re-grow a parallel add path.
    for (const view of GARDEN_VIEWS) {
      expect(buildFor(view).some((action) => action.id === "add-member")).toBe(false);
    }
  });

  it("leaves only the public link for viewers who cannot manage", () => {
    for (const view of ["health", "pool"] as const) {
      const actions = buildGardenViewActions(view, false, true, vi.fn(), {
        gardenAddress: GARDEN,
      });
      expect(visibleIds(actions)).toEqual(["view-public"]);
    }
  });
});

describe("buildCommunityViewActions — fixed Community header", () => {
  const buildFor = (mode: CommunityWorkspaceMode, { canManage = true, isOwner = true } = {}) =>
    buildCommunityViewActions(mode, canManage, isOwner, true, vi.fn(), {
      gardenAddress: GARDEN,
    });

  it("keeps the same action ids and order on every mode", () => {
    const expected = ["add-member", "deposit-withdraw", "fund-payout-jar"];
    for (const mode of ["members", "coordination", "endowment", "payouts"] as const) {
      expect(visibleIds(buildFor(mode))).toEqual(expected);
    }
  });

  it("declares Add member as the fixed primary on every mode", () => {
    for (const mode of ["members", "coordination", "endowment", "payouts"] as const) {
      expect(primaryIds(buildFor(mode))).toEqual(["add-member"]);
    }
  });

  it("renders only Add member as the filled desktop action", () => {
    const actions = buildFor("members");

    expect(
      actions.filter((action) => action.visible !== false && action.variant === "primary")
    ).toEqual([expect.objectContaining({ id: "add-member" })]);
    expect(
      actions
        .filter((action) => action.visible !== false && action.id !== "add-member")
        .map((action) => action.variant)
    ).toEqual(["secondary", "secondary"]);
  });

  it("links Add member to the community-owned members flow", () => {
    const navigate = vi.fn();
    buildCommunityViewActions("members", true, false, true, navigate, {
      gardenAddress: GARDEN,
    })
      .find((action) => action.id === "add-member")
      ?.onClick();
    expect(navigate).toHaveBeenCalledTimes(1);
    // Community owns membership — the flow must stay under /community so the
    // NavigationBar tab does not flip to Garden while the dialog is open.
    expect(navigate).toHaveBeenCalledWith(`/community/members?gardenId=${GARDEN}&item=add-member`);
  });

  it("opens Add Member over the tab it was pressed from (DL-140)", () => {
    const navigate = vi.fn();
    buildCommunityViewActions("payouts", true, true, true, navigate, {
      gardenAddress: GARDEN,
    })
      .find((action) => action.id === "add-member")
      ?.onClick();

    expect(navigate).toHaveBeenCalledWith(`/community/payouts?gardenId=${GARDEN}&item=add-member`);
  });

  it("links Deposit / withdraw to the route-backed endowment vault surface", () => {
    const navigate = vi.fn();
    buildCommunityViewActions("endowment", true, true, true, navigate, {
      gardenAddress: GARDEN,
    })
      .find((action) => action.id === "deposit-withdraw")
      ?.onClick();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/endowment/vault");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });

  it("opens Fund Cookie Jar over the tab it was pressed from (DL-140)", () => {
    const navigate = vi.fn();
    buildCommunityViewActions("endowment", true, true, true, navigate, {
      gardenAddress: GARDEN,
    })
      .find((action) => action.id === "fund-payout-jar")
      ?.onClick();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(`/community/endowment?gardenId=${GARDEN}&item=fund-jar`);
  });

  it("keeps Fund Cookie Jar in place but disabled, with its reason, for a garden with no jar", () => {
    const navigate = vi.fn();
    const actions = buildCommunityViewActions(
      "payouts",
      true,
      true,
      true,
      navigate,
      { gardenAddress: GARDEN },
      false
    );
    const fund = actions.find((action) => action.id === "fund-payout-jar");

    // Same position on every tab (D10): visible, disabled, and saying why.
    expect(visibleIds(actions)).toEqual(["add-member", "deposit-withdraw", "fund-payout-jar"]);
    expect(fund).toMatchObject({
      disabled: true,
      disabledReasonId: "hub.community.action.fundPayoutJarNoJar",
      disabledReason: "This garden has no payout jar yet.",
    });
  });

  it("gates owner and management actions without duplicating the public link", () => {
    expect(visibleIds(buildFor("endowment", { canManage: false, isOwner: true }))).toEqual([
      "deposit-withdraw",
    ]);
    expect(visibleIds(buildFor("members", { canManage: true, isOwner: false }))).toEqual([
      "add-member",
      "fund-payout-jar",
    ]);
    expect(visibleIds(buildFor("coordination", { canManage: false, isOwner: false }))).toEqual([]);
  });
});
