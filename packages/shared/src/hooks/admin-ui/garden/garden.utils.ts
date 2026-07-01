import {
  adminRoutes,
  type AdminGardenRouteContext,
  type MetaStripItem,
  type ViewAction,
} from "@green-goods/shared";
import { RiExternalLinkLine, RiSettings3Line, RiUserAddLine } from "@remixicon/react";

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
 * Per Tier 4 of the admin design handoff (audit IA-Garden decision):
 * Overview / Activity / Settings. The legacy "impact" tab was dropped — Hub
 * Certify + History abstracts hypercert flow. Members was a fourth tab under
 * this decision; it's since been retired as a browsable destination in favor
 * of "Manage members" opening the roles flow directly (/garden/members is
 * now that flow's route, not a workspace tab — see views.tsx).
 */
export type GardenWorkspaceView = "overview" | "activity" | "settings";

export function resolveGardenView(pathname: string): GardenWorkspaceView {
  if (pathname.startsWith("/garden/activity")) return "activity";
  if (pathname.startsWith("/garden/settings")) return "settings";
  return "overview";
}

/**
 * Garden view-level actions — stable trio: the same set renders on every
 * view, in the same order, so positions never shift between tabs. Add member
 * is the fixed primary; the remaining actions stay secondary/ghost so emphasis
 * no longer follows the active view:
 *
 * - Add member opens the left-sheet write path in one click from any view.
 * - Edit garden navigates to Settings, where the form owns Save/Cancel.
 * - View public stays ghost because it leaves the admin context.
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
  routeContext?: AdminGardenRouteContext,
  onAddMember?: () => void
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
      id: "add-member",
      label: "Add member",
      labelId: "cockpit.garden.action.addMember",
      icon: RiUserAddLine,
      // Opens the add-member left sheet in ONE click from any Garden view: the
      // sheet is declared at the always-mounted workspace shell
      // (GardenSheetDescriptor) and driven by controller state, so it no longer
      // navigates to the members tab first and waits for a second click.
      onClick: () => onAddMember?.(),
      variant: "primary",
      visible: hasSelectedGarden && canManage,
      primary: true,
    },
    {
      id: "edit-garden",
      label: "Edit garden",
      labelId: "cockpit.garden.action.editGarden",
      icon: RiSettings3Line,
      onClick: () => navigate(adminRoutes.gardenSettings(routeContext)),
      variant: "secondary",
      visible: hasSelectedGarden && canManage,
      primary: false,
    },
  ];
}
