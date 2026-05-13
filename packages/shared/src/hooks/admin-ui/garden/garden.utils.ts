import {
  adminRoutes,
  type AdminGardenRouteContext,
  type FabConfig,
  type MetaStripItem,
  type ViewAction,
} from "@green-goods/shared";
import {
  RiAddLine,
  RiExternalLinkLine,
  RiHandCoinLine,
  RiPencilLine,
  RiSettings3Line,
  RiUserAddLine,
} from "@remixicon/react";

/**
 * Inputs for the Garden header stats slot. Pulled directly off the values the
 * GardenWorkspaceController already returns so wiring is a passthrough — the
 * view does not have to compute anything.
 */
export interface GardenHeaderStatsInput {
  hasSelectedGarden: boolean;
  gardenerCount: number;
  pendingWorkCount: number;
  treasuryBalance: string;
  formatMessage: (
    descriptor: { id: string; defaultMessage?: string },
    values?: Record<string, unknown>
  ) => string;
}

/**
 * Cleanup A6: build the inline MetaStrip items rendered in the Garden header
 * after Tier 4 dropped the legacy garden-name re-declaration (Frontend Rule 17).
 * Returns [] when no garden is selected so the metadata slot stays clean
 * during the workspace selection gate.
 *
 * Stat shape (3 items): gardeners count · pending work · treasury.
 * Per audit §5.6 the slot must NOT include the garden name.
 */
export function buildGardenHeaderStats({
  hasSelectedGarden,
  gardenerCount,
  pendingWorkCount,
  treasuryBalance,
  formatMessage,
}: GardenHeaderStatsInput): MetaStripItem[] {
  if (!hasSelectedGarden) return [];

  return [
    {
      id: "gardeners",
      value: String(gardenerCount),
      label: formatMessage(
        {
          id: "cockpit.garden.stats.gardeners",
          defaultMessage: "{count, plural, one {gardener} other {gardeners}}",
        },
        { count: gardenerCount }
      ),
    },
    {
      id: "pending-work",
      value: String(pendingWorkCount),
      label: formatMessage(
        {
          id: "cockpit.garden.stats.pendingWork",
          defaultMessage: "{count, plural, one {pending work} other {pending work}}",
        },
        { count: pendingWorkCount }
      ),
    },
    {
      id: "treasury",
      value: treasuryBalance,
      label: formatMessage({
        id: "cockpit.garden.stats.treasury",
        defaultMessage: "treasury",
      }),
    },
  ];
}

/**
 * Per Tier 4 of the admin design handoff (audit IA-Garden decision):
 * Overview / Activity / Members / Settings. The legacy "impact" tab was
 * dropped — Hub Certify + History abstracts hypercert flow.
 */
export type GardenWorkspaceView = "overview" | "activity" | "members" | "settings";

export function resolveGardenView(pathname: string): GardenWorkspaceView {
  if (pathname.startsWith("/garden/activity")) return "activity";
  if (pathname.startsWith("/garden/members")) return "members";
  if (pathname.startsWith("/garden/settings")) return "settings";
  return "overview";
}

/**
 * Garden view-level actions. Exposes the same set on every tab — view-specific
 * gating happens via `visible`. The Settings tab disables gates that don't make
 * sense alongside the Settings UI itself.
 *
 * Reference design (`design_handoff_admin-revamp/screenshots/02-garden.png`):
 * View public (ghost) + Edit garden (primary) + Invite gardener (secondary).
 *
 * "View public" links to the client app via the admin's `/gardens/:id` redirect
 * route, which resolves to the public garden page.
 */
export function buildGardenViewActions(
  view: GardenWorkspaceView,
  canManage: boolean,
  hasSelectedGarden: boolean,
  navigate: (path: string) => void,
  routeContext?: AdminGardenRouteContext,
  onEditDomains?: () => void
): ViewAction[] {
  const gardenAddress = routeContext?.gardenAddress;
  const communityRouteContext = { gardenAddress };
  return [
    {
      id: "view-public",
      label: "View public",
      labelId: "cockpit.garden.action.viewPublic",
      icon: RiExternalLinkLine,
      onClick: () => {
        if (!gardenAddress) return;
        // The admin route `/gardens/:gardenId` redirects to the client app.
        // Open in a new tab — public is a separate context.
        const url = `/gardens/${encodeURIComponent(gardenAddress)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      },
      variant: "ghost",
      visible: hasSelectedGarden && Boolean(gardenAddress),
    },
    {
      id: "edit-domains",
      label: "Edit domains",
      labelId: "cockpit.garden.action.editDomains",
      icon: RiPencilLine,
      onClick: () => onEditDomains?.(),
      variant: "secondary",
      visible: hasSelectedGarden && canManage && Boolean(onEditDomains),
      primary: view === "settings",
    },
    {
      id: "invite-gardener",
      label: "Invite gardener",
      labelId: "cockpit.garden.action.inviteGardener",
      icon: RiUserAddLine,
      onClick: () => navigate(adminRoutes.communityMembers(communityRouteContext)),
      variant: "secondary",
      visible: hasSelectedGarden && canManage,
    },
    {
      id: "edit-garden",
      label: "Edit garden",
      labelId: "cockpit.garden.action.editGarden",
      icon: RiSettings3Line,
      onClick: () => navigate(adminRoutes.gardenSettings(routeContext)),
      variant: "primary",
      visible: hasSelectedGarden && canManage && view !== "settings",
      primary: true,
    },
  ];
}

/** @deprecated Use `buildGardenViewActions` + `useViewActions` instead. Retained
 *  during the transition until all consumers are migrated. */
export function buildGardenFabConfig(
  view: GardenWorkspaceView,
  canManage: boolean,
  hasSelectedGarden: boolean,
  navigate: (path: string) => void,
  routeContext?: AdminGardenRouteContext
): FabConfig | null {
  if (!hasSelectedGarden || !canManage || view === "settings") return null;

  const communityRouteContext = { gardenAddress: routeContext?.gardenAddress };

  return {
    icon: RiAddLine,
    label: "Garden Actions",
    actions: [
      {
        id: "edit-garden",
        icon: RiSettings3Line,
        label: "Edit garden",
        labelId: "cockpit.garden.fab.editGarden",
      },
      {
        id: "invite-gardener",
        icon: RiUserAddLine,
        label: "Invite gardener",
        labelId: "cockpit.garden.fab.inviteGardener",
      },
      {
        id: "send-distribution",
        icon: RiHandCoinLine,
        label: "Send distribution",
        labelId: "cockpit.garden.fab.sendDistribution",
      },
    ],
    onAction: (actionId: string) => {
      if (actionId === "edit-garden") navigate(adminRoutes.gardenSettings(routeContext));
      else if (actionId === "invite-gardener")
        navigate(adminRoutes.communityMembers(communityRouteContext));
      else if (actionId === "send-distribution")
        navigate(adminRoutes.communityPayouts(communityRouteContext));
    },
  };
}
