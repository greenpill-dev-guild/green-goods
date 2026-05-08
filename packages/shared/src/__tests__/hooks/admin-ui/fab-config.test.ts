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

import { buildCommunityFabConfig } from "../../../hooks/admin-ui/community/community.utils";
import {
  buildGardenFabConfig,
  buildGardenViewActions,
} from "../../../hooks/admin-ui/garden/garden.utils";

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
      "invite-gardener",
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
