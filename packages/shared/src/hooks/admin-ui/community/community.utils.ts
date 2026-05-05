import {
  adminRoutes,
  type AdminCommunityRouteContext,
  type FabConfig,
  formatTokenAmount,
  type MetaStripItem,
} from "@green-goods/shared";
import { RiAddLine, RiMoneyDollarCircleLine, RiUserLine, RiUserVoiceLine } from "@remixicon/react";

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
