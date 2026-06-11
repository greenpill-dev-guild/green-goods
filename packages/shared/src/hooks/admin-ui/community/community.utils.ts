import {
  adminRoutes,
  type AdminCommunityRouteContext,
  type FabConfig,
  formatTokenAmount,
  type MetaStripItem,
  type ViewAction,
} from "@green-goods/shared";
import {
  RiAddLine,
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
  peopleCount: number;
  poolCount: number;
  vaultNetDeposited: bigint;
  formatMessage: (
    descriptor: { id: string; defaultMessage?: string },
    values?: Record<string, unknown>
  ) => string;
}

/**
 * Cleanup A6: build the inline MetaStrip items rendered in the Community
 * header after Tier 4 dropped the garden-name re-declaration. Returns [] when
 * no garden is selected so the metadata slot stays clean during the workspace
 * selection gate. Per audit §5.6, the slot must NOT include the garden name.
 *
 * Stat shape (3 items): people count · signal pool count · treasury balance.
 */
export function buildCommunityHeaderStats({
  hasSelectedGarden,
  peopleCount,
  poolCount,
  vaultNetDeposited,
  formatMessage,
}: CommunityHeaderStatsInput): MetaStripItem[] {
  if (!hasSelectedGarden) return [];

  return [
    {
      id: "people",
      value: String(peopleCount),
      label: formatMessage(
        {
          id: "cockpit.community.stats.people",
          defaultMessage: "{count, plural, one {person} other {people}}",
        },
        { count: peopleCount }
      ),
    },
    {
      id: "pools",
      value: String(poolCount),
      label: formatMessage(
        {
          id: "cockpit.community.stats.pools",
          defaultMessage: "{count, plural, one {pool} other {pools}}",
        },
        { count: poolCount }
      ),
    },
    {
      id: "treasury",
      value: formatTokenAmount(vaultNetDeposited),
      label: formatMessage({
        id: "cockpit.community.stats.treasury",
        defaultMessage: "treasury",
      }),
    },
  ];
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
 * Community view-level actions — one mode-specific primary per mode, and only
 * actions with a real target:
 *
 * - `treasury`   → Deposit / withdraw (owner) opens the vault sheet.
 * - `governance` → New proposal opens the hypercert signal-pool sheet, where
 *   registering a hypercert is the existing proposal-creation write.
 * - `payouts`    → the CookieJarPayoutPanel owns Withdraw / Fund / Manage in
 *   local context; the header adds no competing primary.
 * - `members`    → People stays engagement/read-only. Manage members links
 *   clearly to the Garden → Members management surface (no role-management
 *   CTA pretending People manages roles).
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
      visible: hasSelectedGarden && canManage && mode === "members",
    },
    {
      id: "deposit-withdraw",
      label: "Deposit / withdraw",
      labelId: "cockpit.community.action.depositWithdraw",
      icon: RiMoneyDollarCircleLine,
      onClick: () => navigate(adminRoutes.communityTreasuryVault(routeContext)),
      variant: mode === "treasury" ? "primary" : "secondary",
      visible: hasSelectedGarden && isOwner,
      primary: mode === "treasury",
    },
    {
      id: "new-proposal",
      label: "New proposal",
      labelId: "cockpit.community.action.newProposal",
      icon: RiUserVoiceLine,
      onClick: () => navigate(adminRoutes.communityGovernanceSignalPool("hypercert", routeContext)),
      variant: mode === "governance" ? "primary" : "secondary",
      visible: hasSelectedGarden && canManage && mode === "governance",
      primary: mode === "governance",
    },
  ];
}

/** @deprecated Use `buildCommunityViewActions` + `useViewActions` instead. */
export function buildCommunityFabConfig(
  canManage: boolean,
  hasSelectedGarden: boolean,
  navigate: (path: string) => void,
  routeContext?: AdminCommunityRouteContext
): FabConfig | null {
  if (!hasSelectedGarden || !canManage) return null;

  return {
    icon: RiAddLine,
    label: "Community Actions",
    actions: [
      {
        id: "new-proposal",
        icon: RiUserVoiceLine,
        label: "New proposal",
        labelId: "cockpit.community.fab.newProposal",
      },
      {
        id: "add-member",
        icon: RiUserLine,
        label: "Add member",
        labelId: "cockpit.community.fab.addMember",
      },
      {
        id: "manage-vault",
        icon: RiMoneyDollarCircleLine,
        label: "Manage vault",
        labelId: "cockpit.community.fab.manageVault",
      },
    ],
    onAction: (actionId: string) => {
      if (actionId === "new-proposal") navigate(adminRoutes.communityGovernance(routeContext));
      else if (actionId === "add-member") navigate(adminRoutes.communityMembers(routeContext));
      else if (actionId === "manage-vault")
        navigate(adminRoutes.communityTreasuryVault(routeContext));
    },
  };
}
