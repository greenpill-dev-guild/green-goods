import type { MetaStripItem } from "../../../components/Canvas/MetaStrip";
import type { ViewAction } from "../../../components/Canvas/viewActions.types";
import {
  type AdminGardenRouteContext,
  adminRoutes,
  EDIT_GARDEN_ROUTE_ITEM,
} from "../../../utils/navigation/admin-routes";
import { pushRouteItem } from "../../navigation/useCanvasSearchParams";
import { RiExternalLinkLine, RiSeedlingLine, RiSettings3Line } from "@remixicon/react";

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
    values?: Record<string, string | number | boolean | Date | null | undefined>
  ) => string;
}

/**
 * Build the inline MetaStrip items rendered in the Garden header. Pairs the
 * garden's roster (gardeners) with its own output (certified impact) — the
 * "who's here + what they've produced" of a garden. Pending work is Review's
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
          id: "hub.garden.stats.gardeners",
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
          id: "hub.garden.stats.impact",
          defaultMessage: "{count, plural, one {impact} other {impacts}}",
        },
        { count: impactCount }
      ),
    });
  }

  return items;
}

/**
 * Garden is the internal readout surface. Edit Garden is a route item that opens
 * as a dialog over whichever tab the URL is on, rather than taking a tab slot.
 */
export type GardenWorkspaceView = "health" | "impact" | "activity" | "pool";

export function resolveGardenView(pathname: string): GardenWorkspaceView {
  if (pathname.startsWith("/garden/activity")) return "activity";
  if (pathname.startsWith("/garden/impact")) return "impact";
  // The pool console and its seed / commitment inspectors all sit on the Pool tab.
  if (pathname.startsWith("/garden/pool")) return "pool";
  return "health";
}

/**
 * Garden view-level actions. View public and Edit garden render on every view, in
 * the same order, so their positions never shift between tabs; View public stays
 * ghost because it leaves the admin context, and Edit garden opens over the active
 * view (DL-140). The Promises tab adds Seed Promises as its filled action, last on
 * the desktop row and first in the phone's dial, so the "+" there leads to adding a
 * promise; Edit garden steps back to secondary on that tab only (PRD-1491). The
 * seeding dialog explains a pool that is not open, so the action is not gated here.
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
  const onPromises = view === "pool";
  return [
    {
      id: "view-public",
      label: "View public",
      labelId: "hub.garden.action.viewPublic",
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
      labelId: "hub.garden.action.editGarden",
      icon: RiSettings3Line,
      onClick: () =>
        pushRouteItem(
          navigate,
          adminRoutes.gardenMode(view, { ...routeContext, item: EDIT_GARDEN_ROUTE_ITEM })
        ),
      variant: onPromises ? "secondary" : "primary",
      visible: hasSelectedGarden && canManage,
      primary: !onPromises,
    },
    ...(onPromises
      ? [
          {
            id: "seed-promises",
            label: "Seed Promises",
            labelId: "hub.garden.pool.act.seedPromises",
            icon: RiSeedlingLine,
            onClick: () => navigate(adminRoutes.gardenPoolSeed({ gardenId: gardenAddress })),
            variant: "primary" as const,
            visible: hasSelectedGarden && canManage,
            primary: true,
          },
        ]
      : []),
  ];
}
