import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { useRole, type UserRole } from "@green-goods/shared/hooks/gardener/useRole";
import { useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { Outlet } from "react-router-dom";
import { CanvasIndexerErrorState } from "@/components/Layout/CanvasIndexerErrorState";
import RouteUnauthorized from "@/routes/RouteUnauthorized";

interface RequireRoleProps {
  allowedRoles: UserRole[];
  loadingFallback?: React.ReactNode;
}

export default function RequireRole({ allowedRoles, loadingFallback }: RequireRoleProps) {
  const { role, isProtocolTeam, isProductLead, loading, deploymentPermissionsError } = useRole();
  const { formatMessage } = useIntl();

  if (loading) {
    return (
      <>
        {loadingFallback ?? (
          <div className="flex items-center justify-center py-24" role="status">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-stroke-sub border-t-primary-base" />
          </div>
        )}
      </>
    );
  }

  const allowed =
    allowedRoles.includes(role) ||
    ((isProtocolTeam || isProductLead) && allowedRoles.includes("steward"));

  // A deployer whose permission read never answered is unknown, not refused: offer a retry.
  if (!allowed && allowedRoles.includes("deployer") && deploymentPermissionsError) {
    return <DeploymentPermissionsRetry />;
  }

  if (!allowed) {
    return (
      <RouteUnauthorized>
        {role === "user" && (
          <div className="type-body text-text-soft mt-4 space-y-2">
            <p>{formatMessage({ id: "app.admin.auth.requireRole" })}</p>
            <ul className="list-disc list-inside text-left max-w-md mx-auto">
              {allowedRoles.includes("deployer") && (
                <li>{formatMessage({ id: "app.admin.auth.requireDeployer" })}</li>
              )}
              {allowedRoles.includes("steward") && (
                <li>{formatMessage({ id: "app.admin.auth.requireSteward" })}</li>
              )}
            </ul>
          </div>
        )}
      </RouteUnauthorized>
    );
  }

  return <Outlet />;
}

function DeploymentPermissionsRetry() {
  const queryClient = useQueryClient();
  return (
    <CanvasIndexerErrorState
      onRetry={() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.role.all });
      }}
    />
  );
}
