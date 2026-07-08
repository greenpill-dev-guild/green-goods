import {
  adminRoutes,
  type AdminGardenRouteContext,
  type MetaStripItem,
  type ViewAction,
} from "@green-goods/shared";
import { RiExternalLinkLine, RiSettings3Line } from "@remixicon/react";

/**
 * Inputs for the Garden header stats slot. Pulled directly off the values the
 * GardenWorkspaceController already returns so wiring is a passthrough — the
 * view does not have to compute anything.
 */
export interface GardenHeaderStatsInput {
  hasSelectedGarden: boolean;
  gardenerCount: number;
  impactCount: number | null;
  formatMessage: (
    descriptor: { id: string; defaultMessage?: string },
    values?: Record<string, unknown>
  ) => string;
}

/**
 * Build the inline MetaStrip items rendered in the Garden header. Pairs the
 * garden's roster (gardeners) with its own output (certified impact) — the
 * "who's here + what they've produced" of a garden. Pending work is the Hub's
 * concern (the review queue lives there) and treasury lives on Community, so
 * neither is restated here. Returns [] when no garden is selected so the
 * metadata slot stays clean during the workspace selection gate. Per audit §5.6
 * the slot must NOT include the garden name.
 *
 * Stat shape: gardeners count · certified impact once hypercerts are loaded.
 */
export function buildGardenHeaderStats({
  hasSelectedGarden,
  gardenerCount,
  impactCount,
  formatMessage,
}: GardenHeaderStatsInput): MetaStripItem[] {
  if (!hasSelectedGarden) return [];

  const items: MetaStripItem[] = [
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
  ];

  if (impactCount !== null) {
    items.push({
      id: "impact",
      value: String(impactCount),
      label: formatMessage(
        {
          id: "cockpit.garden.stats.impact",
          defaultMessage: "{count, plural, one {impact} other {impacts}}",
        },
        { count: impactCount }
      ),
    });
  }

  return items;
}

/**
 * Garden is the internal readout surface. Settings remains route-backed for
 * deep links, but it opens as a dialog over the Health view rather than taking
 * a tab slot.
 */
export type GardenWorkspaceView = "health" | "impact" | "activity";

export function resolveGardenView(pathname: string): GardenWorkspaceView {
  if (pathname.startsWith("/garden/activity")) return "activity";
  if (pathname.startsWith("/garden/impact")) return "impact";
  return "health";
}

/**
 * Garden view-level actions — stable pair: the same set renders on every
 * view, in the same order, so positions never shift between tabs. Edit garden
 * is the fixed primary; View public stays ghost because it leaves the admin
 * context.
 *
 * Membership actions live on the Community workspace (Manage Members →
 * Add members at /community/members) — the Garden header no longer carries
 * an add-member entry.
 *
 * Domains are garden configuration and are edited from the Settings form,
 * not from the header (QA refinement pass — decision 4).
 *
 * "View public" links to the client app via the admin's `/gardens/:id`
 * redirect route, which resolves to the public garden page.
 */
export function buildGardenViewActions(
  view: GardenWorkspaceView,
  canManage: boolean,
  hasSelectedGarden: boolean,
  navigate: (path: string) => void,
  routeContext?: AdminGardenRouteContext
): ViewAction[] {
  const gardenAddress = routeContext?.gardenAddress;
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
      id: "edit-garden",
      label: "Edit garden",
      labelId: "cockpit.garden.action.editGarden",
      icon: RiSettings3Line,
      onClick: () => navigate(adminRoutes.gardenSettings(routeContext)),
      variant: "primary",
      visible: hasSelectedGarden && canManage,
      primary: true,
    },
  ];
}
