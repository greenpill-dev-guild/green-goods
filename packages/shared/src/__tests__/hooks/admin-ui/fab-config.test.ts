/**
 * FAB-config builder tests
 *
 * Pins the per-view FAB action sets and navigation targets shipped by the
 * cleanup A4 pass. Each builder gates on canManage / hasSelectedGarden so
 * the unauthenticated-or-empty paths are also covered.
 *
 * Cleanup item A4 from .plans/active/admin-design-revamp/handoffs/claude-cleanup.md.
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildCommunityFabConfig,
  buildCommunityViewActions,
} from "../../../hooks/admin-ui/community/community.utils";
import {
  buildGardenFabConfig,
  buildGardenViewActions,
} from "../../../hooks/admin-ui/garden/garden.utils";
import { buildHubViewActions } from "../../../hooks/admin-ui/hub/hub.utils";

const GARDEN = "0xabcabcabcabcabcabcabcabcabcabcabcabcabca";

describe("buildGardenFabConfig", () => {
  it("returns null when no garden is selected", () => {
    const config = buildGardenFabConfig("overview", true, false, vi.fn());
    expect(config).toBeNull();
  });

  it("returns null when the operator cannot manage the garden", () => {
    const config = buildGardenFabConfig("overview", false, true, vi.fn(), {
      gardenAddress: GARDEN,
    });
    expect(config).toBeNull();
  });

  it("returns null on the settings tab to avoid duplicating tab affordances", () => {
    const config = buildGardenFabConfig("settings", true, true, vi.fn(), {
      gardenAddress: GARDEN,
    });
    expect(config).toBeNull();
  });

  it("exposes edit/invite/distribution actions in that priority order", () => {
    const config = buildGardenFabConfig("overview", true, true, vi.fn(), {
      gardenAddress: GARDEN,
    });

    expect(config?.actions.map((a) => a.id)).toEqual([
      "edit-garden",
      "invite-gardener",
      "send-distribution",
    ]);
    expect(config?.actions.map((a) => a.labelId)).toEqual([
      "cockpit.garden.fab.editGarden",
      "cockpit.garden.fab.inviteGardener",
      "cockpit.garden.fab.sendDistribution",
    ]);
  });

  it("routes edit-garden to garden settings", () => {
    const navigate = vi.fn();
    const config = buildGardenFabConfig("overview", true, true, navigate, {
      gardenAddress: GARDEN,
    });
    config?.onAction("edit-garden");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/garden/settings");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });

  it("routes invite-gardener to community members", () => {
    const navigate = vi.fn();
    const config = buildGardenFabConfig("overview", true, true, navigate, {
      gardenAddress: GARDEN,
    });
    config?.onAction("invite-gardener");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/members");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });

  it("routes send-distribution to community payouts", () => {
    const navigate = vi.fn();
    const config = buildGardenFabConfig("overview", true, true, navigate, {
      gardenAddress: GARDEN,
    });
    config?.onAction("send-distribution");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/payouts");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });

  it("ignores unknown action ids", () => {
    const navigate = vi.fn();
    const config = buildGardenFabConfig("overview", true, true, navigate, {
      gardenAddress: GARDEN,
    });
    config?.onAction("not-a-real-action");
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("buildGardenViewActions", () => {
  it("exposes domain editing through the shared view-action path", () => {
    const editDomains = vi.fn();
    const actions = buildGardenViewActions(
      "overview",
      true,
      true,
      vi.fn(),
      {
        gardenAddress: GARDEN,
      },
      editDomains
    ).filter((action) => action.visible !== false);

    expect(actions.map((action) => action.id)).toEqual([
      "view-public",
      "edit-domains",
      "add-member",
      "edit-garden",
    ]);
    expect(actions.map((action) => action.labelId)).toContain("cockpit.garden.action.editDomains");

    actions.find((action) => action.id === "edit-domains")?.onClick();
    expect(editDomains).toHaveBeenCalledTimes(1);
  });

  it("does not expose domain editing without a selected manageable garden", () => {
    const editDomains = vi.fn();
    const actions = buildGardenViewActions(
      "overview",
      false,
      true,
      vi.fn(),
      {
        gardenAddress: GARDEN,
      },
      editDomains
    );

    expect(actions.find((action) => action.id === "edit-domains")?.visible).toBe(false);
  });

  it("keeps the settings Domains editor on the inline settings row", () => {
    const editDomains = vi.fn();
    const actions = buildGardenViewActions(
      "settings",
      true,
      true,
      vi.fn(),
      {
        gardenAddress: GARDEN,
      },
      editDomains
    );

    expect(actions.find((action) => action.id === "edit-domains")?.visible).toBe(false);
  });

  it("marks exactly one mode-specific primary per garden view", () => {
    const primaryByView = (view: Parameters<typeof buildGardenViewActions>[0]) =>
      buildGardenViewActions(view, true, true, vi.fn(), { gardenAddress: GARDEN }, vi.fn(), vi.fn())
        .filter((action) => action.visible !== false && action.primary)
        .map((action) => action.id);

    expect(primaryByView("overview")).toEqual(["edit-garden"]);
    expect(primaryByView("members")).toEqual(["add-member"]);
    // Activity is a read surface; Settings owns its actions in the form.
    expect(primaryByView("activity")).toEqual([]);
    expect(primaryByView("settings")).toEqual([]);
  });

  it("opens the add-member flow on the members view and routes to it elsewhere", () => {
    const navigate = vi.fn();
    const addMember = vi.fn();

    buildGardenViewActions(
      "members",
      true,
      true,
      navigate,
      { gardenAddress: GARDEN },
      vi.fn(),
      addMember
    )
      .find((action) => action.id === "add-member")
      ?.onClick();
    expect(addMember).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();

    buildGardenViewActions(
      "overview",
      true,
      true,
      navigate,
      { gardenAddress: GARDEN },
      vi.fn(),
      addMember
    )
      .find((action) => action.id === "add-member")
      ?.onClick();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/garden/members");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });
});

describe("buildHubViewActions", () => {
  it("marks the stage-specific creation action as the single primary", () => {
    const primaryByStage = (stage: Parameters<typeof buildHubViewActions>[0]) =>
      buildHubViewActions(stage, true, true, vi.fn(), { gardenAddress: GARDEN })
        .filter((action) => action.visible !== false && action.primary)
        .map((action) => action.id);

    expect(primaryByStage("work")).toEqual(["submit-work"]);
    expect(primaryByStage("assess")).toEqual(["create-assessment"]);
    expect(primaryByStage("certify")).toEqual(["create-hypercert"]);
  });

  it("declares no actions on the history stage (audit surface, no creation target)", () => {
    expect(buildHubViewActions("history", true, true, vi.fn(), { gardenAddress: GARDEN })).toEqual(
      []
    );
  });
});

describe("buildCommunityViewActions", () => {
  it("marks deposit / withdraw as the treasury primary for owners", () => {
    const primaries = buildCommunityViewActions("treasury", true, true, true, vi.fn(), {
      gardenAddress: GARDEN,
    }).filter((action) => action.visible !== false && action.primary);

    expect(primaries.map((action) => action.id)).toEqual(["deposit-withdraw"]);
  });

  it("routes the governance primary to the hypercert signal pool register flow", () => {
    const navigate = vi.fn();
    const actions = buildCommunityViewActions("governance", true, false, true, navigate, {
      gardenAddress: GARDEN,
    });

    const primaries = actions.filter((action) => action.visible !== false && action.primary);
    expect(primaries.map((action) => action.id)).toEqual(["new-proposal"]);

    primaries[0]?.onClick();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/governance/signal-pool/hypercert");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });

  it("keeps payouts and people free of header primaries", () => {
    for (const mode of ["payouts", "members"] as const) {
      const primaries = buildCommunityViewActions(mode, true, true, true, vi.fn(), {
        gardenAddress: GARDEN,
      }).filter((action) => action.visible !== false && action.primary);
      expect(primaries).toEqual([]);
    }
  });

  it("links People to the Garden members management surface instead of role CTAs", () => {
    const navigate = vi.fn();
    const actions = buildCommunityViewActions("members", true, false, true, navigate, {
      gardenAddress: GARDEN,
    });

    expect(actions.find((action) => action.id === "manage-roles")).toBeUndefined();
    const manageMembers = actions.find((action) => action.id === "manage-members");
    expect(manageMembers?.visible).toBe(true);

    manageMembers?.onClick();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/garden/members");
  });
});

describe("buildCommunityFabConfig", () => {
  it("returns null when no garden is selected", () => {
    const config = buildCommunityFabConfig(true, false, vi.fn());
    expect(config).toBeNull();
  });

  it("returns null when the operator cannot manage the garden", () => {
    const config = buildCommunityFabConfig(false, true, vi.fn(), { gardenAddress: GARDEN });
    expect(config).toBeNull();
  });

  it("places new-proposal first to make it the mobile primary action", () => {
    const config = buildCommunityFabConfig(true, true, vi.fn(), { gardenAddress: GARDEN });
    expect(config?.actions[0]?.id).toBe("new-proposal");
  });

  it("exposes new-proposal / add-member / manage-vault in priority order", () => {
    const config = buildCommunityFabConfig(true, true, vi.fn(), { gardenAddress: GARDEN });
    expect(config?.actions.map((a) => a.id)).toEqual([
      "new-proposal",
      "add-member",
      "manage-vault",
    ]);
    expect(config?.actions.map((a) => a.labelId)).toEqual([
      "cockpit.community.fab.newProposal",
      "cockpit.community.fab.addMember",
      "cockpit.community.fab.manageVault",
    ]);
  });

  it("routes new-proposal to community governance", () => {
    const navigate = vi.fn();
    const config = buildCommunityFabConfig(true, true, navigate, { gardenAddress: GARDEN });
    config?.onAction("new-proposal");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/governance");
    expect(navigate.mock.calls[0]?.[0]).toContain(GARDEN);
  });

  it("routes add-member to community members", () => {
    const navigate = vi.fn();
    const config = buildCommunityFabConfig(true, true, navigate, { gardenAddress: GARDEN });
    config?.onAction("add-member");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/members");
  });

  it("routes manage-vault to community treasury vault", () => {
    const navigate = vi.fn();
    const config = buildCommunityFabConfig(true, true, navigate, { gardenAddress: GARDEN });
    config?.onAction("manage-vault");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toContain("/community/treasury/vault");
  });

  it("ignores unknown action ids", () => {
    const navigate = vi.fn();
    const config = buildCommunityFabConfig(true, true, navigate, { gardenAddress: GARDEN });
    config?.onAction("not-a-real-action");
    expect(navigate).not.toHaveBeenCalled();
  });
});
