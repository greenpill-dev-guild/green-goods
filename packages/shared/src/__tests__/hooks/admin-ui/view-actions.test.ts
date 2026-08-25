/**
 * View-action grammar tests.
 *
 * Hub, Garden, and Community keep fixed header actions. Community exposes the
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
import { buildHubViewActions, type HubPipelineStage } from "../../../hooks/admin-ui/hub/hub.utils";

const GARDEN = "0xabcabcabcabcabcabcabcabcabcabcabcabcabca";

const HUB_STAGES: HubPipelineStage[] = ["confirm", "work", "assess", "certify"];
const GARDEN_VIEWS: GardenWorkspaceView[] = ["health", "impact", "activity"];

function visibleIds(actions: Array<{ id: string; visible?: boolean }>): string[] {
  return actions.filter((action) => action.visible !== false).map((action) => action.id);
}

function primaryIds(actions: Array<{ id: string; visible?: boolean; primary?: boolean }>) {
  return actions
    .filter((action) => action.visible !== false && action.primary)
    .map((action) => action.id);
}

describe("buildHubViewActions — fixed primary", () => {
  const buildFor = (stage: HubPipelineStage) =>
    buildHubViewActions(stage, true, true, vi.fn(), { gardenAddress: GARDEN });

  it("keeps the same action ids and order on every stage", () => {
    const expected = ["submit-work", "create-assessment", "create-hypercert"];
    for (const stage of HUB_STAGES) {
      expect(visibleIds(buildFor(stage))).toEqual(expected);
    }
  });

  it("declares submit-work as the fixed primary on every stage", () => {
    for (const stage of HUB_STAGES) {
      expect(primaryIds(buildFor(stage))).toEqual(["submit-work"]);
    }
  });

  it("keeps the full action trio on the confirmation stage", () => {
    const confirm = buildFor("confirm");
    expect(visibleIds(confirm)).toHaveLength(3);
    expect(primaryIds(confirm)).toEqual(["submit-work"]);
  });

  it("blanks role-gated actions for read-only stewards", () => {
    const actions = buildHubViewActions("work", false, false, vi.fn(), {
      gardenAddress: GARDEN,
    });
    expect(visibleIds(actions)).toEqual([]);
  });

  it("promotes create-assessment when it is the evaluator-only Hub action", () => {
    const actions = buildHubViewActions("assess", false, true, vi.fn(), {
      gardenAddress: GARDEN,
    });

    expect(visibleIds(actions)).toEqual(["create-assessment"]);
    expect(primaryIds(actions)).toEqual(["create-assessment"]);
    expect(actions.find((action) => action.id === "create-assessment")?.variant).toBe("primary");
  });

  it("drops list sort state when opening Hub creation flows", () => {
    const navigate = vi.fn();
    const actions = buildHubViewActions("work", true, true, navigate, {
      gardenAddress: GARDEN,
      sort: "newest",
    });

    for (const id of ["submit-work", "create-assessment", "create-hypercert"]) {
      actions.find((action) => action.id === id)?.onClick();
    }

    expect(navigate).toHaveBeenCalledTimes(3);
    for (const [target] of navigate.mock.calls) {
      expect(target).toContain(GARDEN);
      expect(target).not.toContain("sort=");
    }
    expect(navigate.mock.calls.map(([target]) => target.split("?")[0])).toEqual([
      "/hub/work/submit",
      "/hub/assess/create",
      "/hub/certify/create",
    ]);
  });
});

describe("buildGardenViewActions — fixed primary", () => {
  const buildFor = (view: GardenWorkspaceView) =>
    buildGardenViewActions(view, true, true, vi.fn(), { gardenAddress: GARDEN });

  it("keeps the same action ids and order on every view", () => {
    const expected = ["view-public", "edit-garden"];
    for (const view of GARDEN_VIEWS) {
      expect(visibleIds(buildFor(view))).toEqual(expected);
    }
  });

  it("declares edit-garden as the fixed primary on every view", () => {
    for (const view of GARDEN_VIEWS) {
      expect(primaryIds(buildFor(view))).toEqual(["edit-garden"]);
    }
  });

  it("dropped the header edit-domains action — domains are edited in Settings", () => {
    for (const view of GARDEN_VIEWS) {
      expect(buildFor(view).some((action) => action.id === "edit-domains")).toBe(false);
    }
  });

  it("dropped the header add-member action — membership is community-owned", () => {
    // Membership lives at /community/members (Manage Members → Add members);
    // the Garden header must not re-grow a parallel add path.
    for (const view of GARDEN_VIEWS) {
      expect(buildFor(view).some((action) => action.id === "add-member")).toBe(false);
    }
  });

  it("leaves only the public link for viewers who cannot manage", () => {
    const actions = buildGardenViewActions("health", false, true, vi.fn(), {
      gardenAddress: GARDEN,
    });
    expect(visibleIds(actions)).toEqual(["view-public"]);
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
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/members");
    expect(navigate.mock.calls[0]?.[0]).toContain("item=add-member");
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

  it("links Fund payout jar to the route-backed payouts surface", () => {
    const navigate = vi.fn();
    buildCommunityViewActions("payouts", true, true, true, navigate, {
      gardenAddress: GARDEN,
    })
      .find((action) => action.id === "fund-payout-jar")
      ?.onClick();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/payouts");
    expect(navigate.mock.calls[0]?.[0]).toContain("item=fund-jar");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
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
