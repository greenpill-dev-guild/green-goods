/**
 * Role permission helpers for garden roles.
 */

import { useMemo } from "react";
import type { GardenRole } from "../../utils/blockchain/garden-roles";

export interface RolePermissions {
  canSubmitWork: boolean;
  canApproveWork: boolean;
  canCreateAssessment: boolean;
  canManageRoles: boolean;
  canManageGarden: boolean;
}

function computePermissions(roles: GardenRole[]): RolePermissions {
  const hasRole = (role: GardenRole) => roles.includes(role);

  const canSubmitWork = hasRole("gardener") || hasRole("operator") || hasRole("owner");
  const canApproveWork = hasRole("evaluator") || hasRole("operator") || hasRole("owner");
  const canCreateAssessment = hasRole("evaluator") || hasRole("operator") || hasRole("owner");
  const canManageRoles = hasRole("operator") || hasRole("owner");
  const canManageGarden = hasRole("owner");

  return {
    canSubmitWork,
    canApproveWork,
    canCreateAssessment,
    canManageRoles,
    canManageGarden,
  };
}

export function useRolePermissions(roleOrRoles?: GardenRole | GardenRole[]): RolePermissions {
  // Serialize to a stable string so inline arrays (e.g., ["operator", "evaluator"])
  // don't break memoization due to new reference each render (Rule 7).
  const rolesKey = roleOrRoles
    ? Array.isArray(roleOrRoles)
      ? roleOrRoles.join(",")
      : roleOrRoles
    : "";

  return useMemo(() => {
    if (!roleOrRoles) {
      return computePermissions([]);
    }

    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    return computePermissions(roles);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rolesKey is the serialized stable dep
  }, [rolesKey]);
}
