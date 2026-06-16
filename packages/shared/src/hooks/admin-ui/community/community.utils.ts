import {
  adminRoutes,
  type AdminCommunityRouteContext,
  formatTokenAmount,
  type MetaStripItem,
  type ViewAction,
} from "@green-goods/shared";
import {
  RiExternalLinkLine,
  RiMoneyDollarCircleLine,
  RiUserLine,
  RiUserVoiceLine,
} from "@remixicon/react";

/**
 * Inputs for the Community header stats slot.
 */
export interface CommunityHeaderStatsInput {
  hasSelectedGarden: boolean;
  vaultNetDeposited: bigint;
  distributedAmounts: readonly bigint[] | null;
  formatMessage: (
    descriptor: { id: string; defaultMessage?: string },
    values?: Record<string, unknown>
  ) => string;
}

/**
 * Build the inline MetaStrip items rendered in the Community header. The tab
 * rail already carries the People / Governance / Payouts *counts*, so the
 * header complements them with the treasury *magnitudes* the tabs don't show.
 * Returns [] when no garden is selected so the metadata slot stays clean during
 * the workspace selection gate. Per audit §5.6, the slot must NOT include the
 * garden name.
 *
 * Stat shape: treasury balance · total distributed when allocations are loaded
 * and the distribution is a single asset. Loading or multi-asset allocations
 * intentionally omit the distributed item until the header has truthful data
 * and an asset-specific display, because base units cannot be summed across
 * assets.
 */
export function buildCommunityHeaderStats({
  hasSelectedGarden,
  vaultNetDeposited,
  distributedAmounts,
  formatMessage,
}: CommunityHeaderStatsInput): MetaStripItem[] {
  if (!hasSelectedGarden) return [];

  const items: MetaStripItem[] = [
    {
      id: "treasury",
      value: formatTokenAmount(vaultNetDeposited),
      label: formatMessage({
        id: "cockpit.community.stats.treasury",
        defaultMessage: "treasury",
      }),
    },
  ];

  if (distributedAmounts !== null && distributedAmounts.length <= 1) {
    items.push({
      id: "distributed",
      value: formatTokenAmount(distributedAmounts[0] ?? 0n),
      label: formatMessage({
        id: "cockpit.community.stats.distributed",
        defaultMessage: "distributed",
      }),
    });
  }

  return items;
}

export type CommunityWorkspaceMode = "treasury" | "governance" | "payouts" | "members";

export function resolveCommunityMode(pathname: string): CommunityWorkspaceMode {
  if (pathname.startsWith("/community/governance")) return "governance";
  if (pathname.startsWith("/community/payouts")) return "payouts";
  if (pathname.startsWith("/community/members")) return "members";
  return "treasury";
}

export function communitySectionForMode(mode: CommunityWorkspaceMode) {
  if (mode === "governance") return "governance";
  if (mode === "payouts") return "cookie-jars";
  return mode;
}

/**
 * Community view-level actions — stable trio: the same set renders on every
 * mode, in the same order, so positions never shift between tabs. Only the
 * filled emphasis moves to the mode whose workflow the action opens:
 *
 * - `treasury`   → Deposit / withdraw filled (owner-gated; opens the vault
 *   sheet over the treasury route).
 * - `governance` → New proposal filled (opens the hypercert signal-pool
 *   sheet, where registering a hypercert is the proposal-creation write).
 * - `payouts` / `members` → no fill: the CookieJarPayoutPanel owns its
 *   actions in local context, and People stays engagement/read-only with
 *   Manage members linking to the Garden → Members management surface.
 */
export function buildCommunityViewActions(
  mode: CommunityWorkspaceMode,
  canManage: boolean,
  isOwner: boolean,
  hasSelectedGarden: boolean,
  navigate: (path: string) => void,
  routeContext?: AdminCommunityRouteContext
): ViewAction[] {
  const gardenAddress = routeContext?.gardenAddress;
  return [
    {
      id: "view-public",
      label: "View public",
      labelId: "cockpit.community.action.viewPublic",
      icon: RiExternalLinkLine,
      onClick: () => {
        if (!gardenAddress) return;
        const url = `/gardens/${encodeURIComponent(gardenAddress)}`;
        window.open(url, "_blank", "noopener,noreferrer");
      },
      variant: "ghost",
      visible: hasSelectedGarden && Boolean(gardenAddress),
    },
    {
      id: "manage-members",
      label: "Manage members",
      labelId: "cockpit.community.action.manageMembers",
      icon: RiUserLine,
      onClick: () => navigate(adminRoutes.gardenMembers({ gardenAddress })),
      variant: "secondary",
      visible: hasSelectedGarden && canManage,
      primary: false,
    },
    {
      id: "deposit-withdraw",
      label: "Deposit / withdraw",
      labelId: "cockpit.community.action.depositWithdraw",
      icon: RiMoneyDollarCircleLine,
      onClick: () => navigate(adminRoutes.communityTreasuryVault(routeContext)),
      variant: "secondary",
      visible: hasSelectedGarden && isOwner,
      primary: false,
    },
    {
      id: "new-proposal",
      label: "New proposal",
      labelId: "cockpit.community.action.newProposal",
      icon: RiUserVoiceLine,
      onClick: () => navigate(adminRoutes.communityGovernanceSignalPool("hypercert", routeContext)),
      variant: "primary",
      visible: hasSelectedGarden && canManage,
      primary: true,
    },
  ];
}
