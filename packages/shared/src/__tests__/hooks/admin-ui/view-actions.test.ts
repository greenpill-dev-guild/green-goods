/**
 * View-action grammar tests — one fixed primary per view.
 *
 * Every workspace builder returns the SAME action set, in the SAME order, on
 * every tab, and declares ONE fixed primary action (filled, rendered rightmost
 * by AdminViewActions) that does NOT move with the active tab. These tests pin:
 *
 *   1. id/order stability across tabs (button positions never shift),
 *   2. exactly one fixed `primary` per view — Hub→submit-work,
 *      Garden→add-member, Community→new-proposal — independent of the tab,
 *   3. the primary opens its flow directly on first click (no select-then-act),
 *   4. real targets only (no self-nav, no removed edit-domains header action),
 *   5. role/ownership gating still blanks unavailable actions.
 *
 * Supersedes the earlier "stable trio, active-tab filled" grammar.
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

  it("keeps the full action trio on the history (audit) stage", () => {
    const history = buildFor("history");
    expect(visibleIds(history)).toHaveLength(3);
    expect(primaryIds(history)).toEqual(["submit-work"]);
  });

  it("blanks role-gated actions for read-only operators", () => {
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
});

describe("buildGardenViewActions — fixed primary", () => {
  const buildFor = (view: GardenWorkspaceView, onAddMember = vi.fn()) =>
    buildGardenViewActions(view, true, true, vi.fn(), { gardenAddress: GARDEN }, onAddMember);

  it("keeps the same action ids and order on every view", () => {
    const expected = ["view-public", "add-member", "edit-garden"];
    for (const view of GARDEN_VIEWS) {
      expect(visibleIds(buildFor(view))).toEqual(expected);
    }
  });

  it("declares add-member as the fixed primary on every view", () => {
    for (const view of GARDEN_VIEWS) {
      expect(primaryIds(buildFor(view))).toEqual(["add-member"]);
    }
  });

  it("dropped the header edit-domains action — domains are edited in Settings", () => {
    for (const view of GARDEN_VIEWS) {
      expect(buildFor(view).some((action) => action.id === "edit-domains")).toBe(false);
    }
  });

  it("opens the add-member flow in one click from any view (no select-then-act)", () => {
    const addMember = vi.fn();

    for (const view of GARDEN_VIEWS) {
      const navigate = vi.fn();
      buildGardenViewActions(view, true, true, navigate, { gardenAddress: GARDEN }, addMember)
        .find((action) => action.id === "add-member")
        ?.onClick();
      // First click opens directly — never a navigate-to-tab detour.
      expect(navigate).not.toHaveBeenCalled();
    }
    expect(addMember).toHaveBeenCalledTimes(GARDEN_VIEWS.length);
  });

  it("leaves only the public link for viewers who cannot manage", () => {
    const actions = buildGardenViewActions("overview", false, true, vi.fn(), {
      gardenAddress: GARDEN,
    });
    expect(visibleIds(actions)).toEqual(["view-public"]);
  });
});

describe("buildCommunityViewActions — fixed primary", () => {
  const buildFor = (mode: CommunityWorkspaceMode, { canManage = true, isOwner = true } = {}) =>
    buildCommunityViewActions(mode, canManage, isOwner, true, vi.fn(), {
      gardenAddress: GARDEN,
    });

  it("keeps the same action ids and order on every mode", () => {
    const expected = ["manage-members", "deposit-withdraw", "new-proposal"];
    for (const mode of COMMUNITY_MODES) {
      expect(visibleIds(buildFor(mode))).toEqual(expected);
    }
  });

  it("declares new-proposal as the fixed primary on every mode", () => {
    for (const mode of COMMUNITY_MODES) {
      expect(primaryIds(buildFor(mode))).toEqual(["new-proposal"]);
    }
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

  it("gates owner and management actions without duplicating the public link", () => {
    expect(visibleIds(buildFor("treasury", { isOwner: false }))).toEqual([
      "manage-members",
      "new-proposal",
    ]);
    expect(visibleIds(buildFor("treasury", { canManage: false, isOwner: false }))).toEqual([]);
  });
});
