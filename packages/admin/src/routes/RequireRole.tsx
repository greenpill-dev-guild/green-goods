import { useRole, type UserRole } from "@green-goods/shared/hooks/gardener/useRole";
import { useIntl } from "react-intl";
import { Outlet } from "react-router-dom";
import RouteUnauthorized from "@/routes/RouteUnauthorized";

interface RequireRoleProps {
  allowedRoles: UserRole[];
  loadingFallback?: React.ReactNode;
}

export default function RequireRole({ allowedRoles, loadingFallback }: RequireRoleProps) {
  const { role, isProtocolTeam, isProductLead, loading } = useRole();
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

  if (
    !allowedRoles.includes(role) &&
    !((isProtocolTeam || isProductLead) && allowedRoles.includes("steward"))
  ) {
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
