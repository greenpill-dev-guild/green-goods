import {
  type AdminCommunityRouteContext,
  adminRoutes,
  formatTokenAmount,
  type MetaStripItem,
  type ViewAction,
} from "@green-goods/shared";
import { RiHandCoinLine, RiMoneyDollarCircleLine, RiUserAddLine } from "@remixicon/react";

/**
 * Inputs for the Community header stats slot.
 */
export interface CommunityHeaderStatsInput {
  hasSelectedGarden: boolean;
  vaultNetDeposited: bigint;
  distributedAmounts: readonly bigint[] | null;
  formatMessage: (
    descriptor: { id: string; defaultMessage?: string },
    values?: Record<string, string | number | boolean | Date | null | undefined>
  ) => string;
}

/**
 * Build the inline MetaStrip items rendered in the Community header. The tab
 * rail already carries the workspace counts, so the header complements them
 * with the endowment and payout magnitudes the tabs do not show.
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
        defaultMessage: "endowment",
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

export type CommunityWorkspaceMode = "members" | "coordination" | "endowment" | "payouts" | "pools";

export function resolveCommunityMode(pathname: string): CommunityWorkspaceMode {
  if (pathname.startsWith("/community/members")) return "members";
  if (
    pathname.startsWith("/community/coordination") ||
    pathname.startsWith("/community/governance")
  ) {
    return "coordination";
  }
  if (pathname.startsWith("/community/payouts")) return "payouts";
  if (pathname.startsWith("/community/pools")) return "pools";
  return "endowment";
}

export function communitySectionForMode(mode: CommunityWorkspaceMode) {
  if (mode === "members") return "members";
  if (mode === "coordination") return "coordination";
  if (mode === "payouts") return "payouts";
  if (mode === "pools") return "pools";
  return "endowment";
}

/**
 * Community view-level actions. The set is stable across Community tabs so
 * desktop button positions and the mobile FAB speed dial do not shift while
 * operators move between Members, Coordination, Endowment, and Payouts.
 */
export function buildCommunityViewActions(
  _mode: CommunityWorkspaceMode,
  canManage: boolean,
  isOwner: boolean,
  hasSelectedGarden: boolean,
  navigate: (path: string) => void,
  routeContext?: AdminCommunityRouteContext
): ViewAction[] {
  const gardenAddress = routeContext?.gardenAddress;
  // "View public" lives once, on the Garden workspace — not duplicated here.
  const actions: ViewAction[] = [
    {
      id: "add-member",
      label: "Add member",
      labelId: "cockpit.community.action.addMember",
      icon: RiUserAddLine,
      onClick: () =>
        navigate(adminRoutes.communityMembers({ gardenId: gardenAddress, item: "add-member" })),
      variant: "primary",
      visible: hasSelectedGarden && canManage,
      primary: true,
    },
    {
      id: "deposit-withdraw",
      label: "Deposit / withdraw",
      labelId: "cockpit.community.action.depositWithdraw",
      icon: RiMoneyDollarCircleLine,
      onClick: () => navigate(adminRoutes.communityEndowmentVault(routeContext)),
      variant: "secondary",
      visible: hasSelectedGarden && isOwner,
    },
    {
      id: "fund-payout-jar",
      label: "Fund Cookie Jar",
      labelId: "cockpit.community.action.fundPayoutJar",
      icon: RiHandCoinLine,
      onClick: () =>
        navigate(adminRoutes.communityPayouts({ gardenId: gardenAddress, item: "fund-jar" })),
      variant: "secondary",
      visible: hasSelectedGarden && canManage,
    },
  ];

  return actions;
}
