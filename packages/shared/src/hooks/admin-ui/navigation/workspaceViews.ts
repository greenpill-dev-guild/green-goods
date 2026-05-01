import { RiAppsLine, RiHammerFill, RiSeedlingLine, RiTeamLine } from "@remixicon/react";
import type { ToolbarSlot } from "../../../components/Canvas";
import type { UserRole } from "../../gardener/useRole";
import { adminRoutes } from "../../../utils/navigation/admin-routes";

export type AdminPrimaryWorkspaceId = "hub" | "garden" | "community" | "actions";
export type AdminWorkspacePermission = "showWork" | "showGarden" | "showCommunity" | "showActions";

export interface AdminWorkspaceViewDefinition {
  id: AdminPrimaryWorkspaceId;
  label: string;
  labelId: string;
  icon: ToolbarSlot["icon"];
  rootPath: string;
  href: string;
  permission: AdminWorkspacePermission;
  commandRoles?: UserRole[];
}

export const ADMIN_WORKSPACE_VIEWS: AdminWorkspaceViewDefinition[] = [
  {
    id: "hub",
    label: "Hub",
    labelId: "cockpit.nav.hub",
    icon: RiAppsLine,
    rootPath: "/hub",
    href: adminRoutes.hub(),
    permission: "showWork",
  },
  {
    id: "garden",
    label: "Garden",
    labelId: "cockpit.nav.garden",
    icon: RiSeedlingLine,
    rootPath: "/garden",
    href: adminRoutes.garden(),
    permission: "showGarden",
  },
  {
    id: "community",
    label: "Community",
    labelId: "cockpit.nav.community",
    icon: RiTeamLine,
    rootPath: "/community",
    href: adminRoutes.community(),
    permission: "showCommunity",
    commandRoles: ["deployer"],
  },
  {
    id: "actions",
    label: "Actions",
    labelId: "app.admin.nav.actions",
    icon: RiHammerFill,
    rootPath: "/actions",
    href: adminRoutes.actions(),
    permission: "showActions",
    commandRoles: ["deployer"],
  },
];

export const ADMIN_COMMAND_ROUTES = ADMIN_WORKSPACE_VIEWS.map((view) => ({
  id: `page-${view.id}`,
  labelId: view.labelId,
  defaultLabel: view.label,
  href: view.href,
  roles: view.commandRoles,
}));
