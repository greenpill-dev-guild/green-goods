import { type UserRole, useRole } from "@green-goods/shared";
import { Outlet } from "react-router-dom";
import { useIntl } from "react-intl";
import { DashboardLayoutSkeleton } from "@/components/Layout/DashboardLayoutSkeleton";

interface RequireRoleProps {
  allowedRoles: UserRole[];
}

export default function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { role, loading } = useRole();
  const { formatMessage } = useIntl();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="unauthorized">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-strong mb-4">
            {formatMessage({ id: "app.admin.auth.unauthorized" })}
          </h1>
          <p className="text-text-sub">{formatMessage({ id: "app.admin.auth.noPermission" })}</p>
          {role === "user" && (
            <div className="text-sm text-text-soft mt-4 space-y-2">
              <p>{formatMessage({ id: "app.admin.auth.requireRole" })}</p>
              <ul className="list-disc list-inside text-left max-w-md mx-auto">
                {allowedRoles.includes("deployer") && (
                  <li>{formatMessage({ id: "app.admin.auth.requireDeployer" })}</li>
                )}
                {allowedRoles.includes("operator") && (
                  <li>{formatMessage({ id: "app.admin.auth.requireOperator" })}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <Outlet />;
}
