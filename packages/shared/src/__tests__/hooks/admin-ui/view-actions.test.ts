/**
 * View-action grammar tests — the stable-trio contract.
 *
 * Every workspace builder returns the SAME action set, in the SAME order, on
 * every tab of its workspace; only the filled emphasis (`primary`) moves to
 * the tab whose workflow the action opens. These tests pin:
 *
 *   1. id/order stability across tabs (button positions never shift),
 *   2. at most one `primary` per tab, matching the tab→action map,
 *   3. read surfaces (Hub history, Garden overview/activity, Community
 *      payouts/people) carry no filled action,
 *   4. real targets only (no self-nav, no removed edit-domains header action).
 *
 * QA refinement pass on PR #562 — decision 1 (stable trio, active filled).
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

const HUB_STAGES: HubPipelineStage[] = ["work", "assess", "certify", "history"];
const GARDEN_VIEWS: GardenWorkspaceView[] = ["overview", "activity", "members", "settings"];
const COMMUNITY_MODES: CommunityWorkspaceMode[] = ["treasury", "governance", "payouts", "members"];

function visibleIds(actions: Array<{ id: string; visible?: boolean }>): string[] {
  return actions.filter((action) => action.visible !== false).map((action) => action.id);
}

function primaryIds(actions: Array<{ id: string; visible?: boolean; primary?: boolean }>) {
  return actions
    .filter((action) => action.visible !== false && action.primary)
    .map((action) => action.id);
}

describe("buildHubViewActions — stable trio", () => {
  const buildFor = (stage: HubPipelineStage) =>
    buildHubViewActions(stage, true, true, vi.fn(), { gardenAddress: GARDEN });

  it("keeps the same action ids and order on every stage", () => {
    const expected = ["submit-work", "create-assessment", "create-hypercert"];
    for (const stage of HUB_STAGES) {
      expect(visibleIds(buildFor(stage))).toEqual(expected);
    }
  });

  it("fills exactly the stage-owned creation action", () => {
    expect(primaryIds(buildFor("work"))).toEqual(["submit-work"]);
    expect(primaryIds(buildFor("assess"))).toEqual(["create-assessment"]);
    expect(primaryIds(buildFor("certify"))).toEqual(["create-hypercert"]);
  });

  it("keeps history all-outlined (audit surface, no creation flow → no FAB)", () => {
    const history = buildFor("history");
    expect(visibleIds(history)).toHaveLength(3);
    expect(primaryIds(history)).toEqual([]);
  });

  it("blanks role-gated actions for read-only operators", () => {
    const actions = buildHubViewActions("work", false, false, vi.fn(), {
      gardenAddress: GARDEN,
    });
    expect(visibleIds(actions)).toEqual([]);
  });
});

describe("buildGardenViewActions — stable trio", () => {
  const buildFor = (view: GardenWorkspaceView, onAddMember = vi.fn()) =>
    buildGardenViewActions(view, true, true, vi.fn(), { gardenAddress: GARDEN }, onAddMember);

  it("keeps the same action ids and order on every view", () => {
    const expected = ["view-public", "add-member", "edit-garden"];
    for (const view of GARDEN_VIEWS) {
      expect(visibleIds(buildFor(view))).toEqual(expected);
    }
  });

  it("fills exactly the view-owned action (members → add, settings → edit)", () => {
    expect(primaryIds(buildFor("members"))).toEqual(["add-member"]);
    expect(primaryIds(buildFor("settings"))).toEqual(["edit-garden"]);
    expect(primaryIds(buildFor("overview"))).toEqual([]);
    expect(primaryIds(buildFor("activity"))).toEqual([]);
  });

  it("dropped the header edit-domains action — domains are edited in Settings", () => {
    for (const view of GARDEN_VIEWS) {
      expect(buildFor(view).some((action) => action.id === "edit-domains")).toBe(false);
    }
  });

  it("opens the add-member flow in place on the members view and routes to it elsewhere", () => {
    const navigate = vi.fn();
    const addMember = vi.fn();

    buildGardenViewActions("members", true, true, navigate, { gardenAddress: GARDEN }, addMember)
      .find((action) => action.id === "add-member")
      ?.onClick();
    expect(addMember).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    buildGardenViewActions("overview", true, true, navigate, { gardenAddress: GARDEN }, addMember)
      .find((action) => action.id === "add-member")
      ?.onClick();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/garden/members");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });

  it("leaves only the public link for viewers who cannot manage", () => {
    const actions = buildGardenViewActions("overview", false, true, vi.fn(), {
      gardenAddress: GARDEN,
    });
    expect(visibleIds(actions)).toEqual(["view-public"]);
  });
});

describe("buildCommunityViewActions — stable trio", () => {
  const buildFor = (mode: CommunityWorkspaceMode, { canManage = true, isOwner = true } = {}) =>
    buildCommunityViewActions(mode, canManage, isOwner, true, vi.fn(), {
      gardenAddress: GARDEN,
    });

  it("keeps the same action ids and order on every mode", () => {
    const expected = ["view-public", "manage-members", "deposit-withdraw", "new-proposal"];
    for (const mode of COMMUNITY_MODES) {
      expect(visibleIds(buildFor(mode))).toEqual(expected);
    }
  });

  it("fills exactly the mode-owned action (treasury → deposit, governance → proposal, people → manage)", () => {
    expect(primaryIds(buildFor("treasury"))).toEqual(["deposit-withdraw"]);
    expect(primaryIds(buildFor("governance"))).toEqual(["new-proposal"]);
    // Payouts stays panel-owned (no header primary); People fills Manage members.
    expect(primaryIds(buildFor("payouts"))).toEqual([]);
    expect(primaryIds(buildFor("members"))).toEqual(["manage-members"]);
  });

  it("routes the governance action to the hypercert signal pool register flow", () => {
    const navigate = vi.fn();
    const actions = buildCommunityViewActions("governance", true, false, true, navigate, {
      gardenAddress: GARDEN,
    });

    actions.find((action) => action.id === "new-proposal")?.onClick();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/governance/signal-pool/hypercert");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });

  it("links Manage members to the Garden members management surface", () => {
    const navigate = vi.fn();
    buildCommunityViewActions("members", true, false, true, navigate, {
      gardenAddress: GARDEN,
    })
      .find((action) => action.id === "manage-members")
      ?.onClick();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/garden/members");
  });

  it("gates deposit-withdraw on ownership and management actions on canManage", () => {
    expect(visibleIds(buildFor("treasury", { isOwner: false }))).toEqual([
      "view-public",
      "manage-members",
      "new-proposal",
    ]);
    expect(visibleIds(buildFor("treasury", { canManage: false, isOwner: false }))).toEqual([
      "view-public",
    ]);
  });
});
