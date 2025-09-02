import { Outlet } from "react-router-dom";
import { useRole, type UserRole } from "@/hooks/useRole";

interface RequireRoleProps {
  allowedRoles: UserRole[];
}

export function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { role, loading } = useRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unauthorized</h1>
          <p className="text-gray-600">
            You don&apos;t have permission to access this area.
          </p>
          {role === "unauthorized" && (
            <p className="text-sm text-gray-500 mt-2">
              Contact an admin to be added as an operator.
            </p>
          )}
        </div>
      </div>
    );
  }

  return <Outlet />;
}