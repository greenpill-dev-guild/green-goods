import { type UserRole, useRole } from "@green-goods/shared/hooks";
import { Outlet } from "react-router-dom";
import { DashboardLayoutSkeleton } from "@/components/Layout/DashboardLayoutSkeleton";

interface RequireRoleProps {
  allowedRoles: UserRole[];
}

export function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { role, loading } = useRole();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unauthorized</h1>
          <p className="text-gray-600">You don&apos;t have permission to access this area.</p>
          {role === "user" && (
            <div className="text-sm text-gray-500 mt-4 space-y-2">
              <p>To access this area, you need to be:</p>
              <ul className="list-disc list-inside text-left max-w-md mx-auto">
                {allowedRoles.includes("deployer") && (
                  <li>Added to the deployment registry allowlist for contract management</li>
                )}
                {allowedRoles.includes("operator") && (
                  <li>An operator of at least one garden for garden management</li>
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
