import { useQuery } from "urql";
import { graphql } from "gql.tada";
import { useRole } from "@/hooks/useRole";
import type { Garden } from "@/types/garden";
import { RiPlantLine, RiUserLine } from "@remixicon/react";

const GET_DASHBOARD_STATS = graphql(`
  query GetDashboardStats {
    gardens {
      id
      name
      operators
      gardeners
    }
  }
`);

export default function Dashboard() {
  const { role, isAdmin, operatorGardens } = useRole();
  const [{ data, fetching, error }] = useQuery({ query: GET_DASHBOARD_STATS });

  const gardens = data?.gardens || [];
  const totalGardens = isAdmin ? gardens.length : operatorGardens.length;
  const totalOperators = isAdmin ? new Set((gardens as Garden[]).flatMap(g => g.operators)).size : 0;
  const totalGardeners = isAdmin ? new Set((gardens as Garden[]).flatMap(g => g.gardeners)).size : 0;

  if (fetching) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">Failed to load dashboard data: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {role === "admin" ? "Admin" : "Operator"}
        </h1>
        <p className="text-gray-600 mt-1">
          {role === "admin" 
            ? "Manage gardens, operators, and platform contracts"
            : `Manage your ${operatorGardens.length} garden${operatorGardens.length !== 1 ? 's' : ''}`
          }
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <RiPlantLine className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                {isAdmin ? "Total Gardens" : "Your Gardens"}
              </p>
              <p className="text-2xl font-bold text-gray-900">{totalGardens}</p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <RiUserLine className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Operators</p>
                  <p className="text-2xl font-bold text-gray-900">{totalOperators}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <RiUserLine className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Gardeners</p>
                  <p className="text-2xl font-bold text-gray-900">{totalGardeners}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Gardens</h2>
        </div>
        <div className="p-6">
          {(isAdmin ? gardens as Garden[] : operatorGardens).slice(0, 5).map((garden: Garden) => (
            <div key={garden.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div>
                <h3 className="text-sm font-medium text-gray-900">{garden.name}</h3>
                <p className="text-sm text-gray-500">{garden.location || "No location"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {garden.operators?.length || 0} operators, {garden.gardeners?.length || 0} gardeners
                </p>
              </div>
            </div>
          ))}
          {(isAdmin ? gardens : operatorGardens).length === 0 && (
            <p className="text-gray-500 text-center py-8">No gardens found</p>
          )}
        </div>
      </div>
    </div>
  );
}