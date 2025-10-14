import { useQuery } from "urql";
import { graphql } from "gql.tada";
import { useRole } from "@/hooks/useRole";
import { useChainId } from "wagmi";
import type { Garden } from "@/types/garden";
import { RiPlantLine, RiUserLine } from "@remixicon/react";

const GET_DASHBOARD_STATS = graphql(`
  query GetDashboardStats($chainId: Int!) {
    Garden(where: {chainId: {_eq: $chainId}}) {
      id
      name
      operators
      gardeners
    }
  }
`);

export default function Dashboard() {
  const { role, operatorGardens } = useRole();
  const chainId = useChainId();
  const [{ data, fetching, error }] = useQuery({
    query: GET_DASHBOARD_STATS,
    variables: { chainId },
  });

  const gardens = data?.Garden || [];
  const totalGardens = gardens.length;
  const userOperatorGardens = operatorGardens.length;
  const totalOperators = new Set((gardens as Garden[]).flatMap((g) => g.operators)).size;
  const totalGardeners = new Set((gardens as Garden[]).flatMap((g) => g.gardeners)).size;

  if (fetching) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Indexer Connection Issue</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Unable to connect to the indexer: {error.message}</p>
                <p className="mt-1">
                  The dashboard will work with limited functionality. Garden operations are still
                  available.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Fallback dashboard without stats */}
        <div className="mt-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back,{" "}
              {role === "deployer" ? "Deployer" : role === "operator" ? "Operator" : "User"}
            </h1>
            <p className="text-gray-600 mt-1">
              {role === "deployer"
                ? "Manage gardens, deploy contracts, and oversee platform operations"
                : role === "operator"
                  ? `Manage your ${operatorGardens.length} garden${operatorGardens.length !== 1 ? "s" : ""}`
                  : "View gardens and explore the Green Goods ecosystem"}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a
                href="/gardens"
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <h3 className="font-medium text-gray-900">View Gardens</h3>
                <p className="text-sm text-gray-600 mt-1">Browse and manage gardens</p>
              </a>
              {role === "deployer" && (
                <a
                  href="/contracts"
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-medium text-gray-900">Contract Management</h3>
                  <p className="text-sm text-gray-600 mt-1">Deploy and manage contracts</p>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back,{" "}
          {role === "deployer" ? "Deployer" : role === "operator" ? "Operator" : "User"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {role === "deployer"
            ? "Manage gardens, deploy contracts, and oversee platform operations"
            : role === "operator"
              ? `Manage your ${operatorGardens.length} garden${operatorGardens.length !== 1 ? "s" : ""}`
              : "View gardens and explore the Green Goods ecosystem"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <RiPlantLine className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {role === "operator" ? "Your Gardens" : "Total Gardens"}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {role === "operator" ? userOperatorGardens : totalGardens}
              </p>
            </div>
          </div>
        </div>

        {(role === "deployer" || role === "operator") && (
          <>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <RiUserLine className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total Operators
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {totalOperators}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <RiUserLine className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total Gardeners
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {totalGardeners}
                  </p>
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
          {role === "operator"
            ? operatorGardens.slice(0, 5).map((garden) => (
                <div
                  key={garden.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{garden.name}</h3>
                    <p className="text-sm text-gray-500">Operator Garden</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Managed Garden</p>
                  </div>
                </div>
              ))
            : (gardens as Garden[]).slice(0, 5).map((garden: Garden) => (
                <div
                  key={garden.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
                >
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{garden.name}</h3>
                    <p className="text-sm text-gray-500">{garden.location || "No location"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {garden.operators?.length || 0} operators, {garden.gardeners?.length || 0}{" "}
                      gardeners
                    </p>
                  </div>
                </div>
              ))}
          {(role === "operator" ? operatorGardens : gardens).length === 0 && (
            <p className="text-gray-500 text-center py-8">No gardens found</p>
          )}
        </div>
      </div>
    </div>
  );
}
