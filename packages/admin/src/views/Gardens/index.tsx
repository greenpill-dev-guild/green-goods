import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "urql";
import { graphql } from "gql.tada";
import { RiAddLine, RiPlantLine, RiUserLine, RiEyeLine, RiShieldCheckLine } from "@remixicon/react";
import { useRole } from "@/hooks/useRole";
import { useGardenPermissions } from "@/hooks/useGardenPermissions";
import { CreateGardenModal } from "@/components/Garden/CreateGardenModal";
import { useChainId } from "wagmi";
import { resolveIPFSUrl } from "@/utils/pinata";
import type { Garden } from "@/types/garden";

const GET_GARDENS = graphql(`
  query GetGardens($chainId: Int!) {
    Garden(where: {chainId: {_eq: $chainId}}) {
      id
      chainId
      tokenAddress
      tokenID
      name
      description
      location
      bannerImage
      createdAt
      gardeners
      operators
    }
  }
`);

export default function Gardens() {
  const { isDeployer } = useRole();
  const gardenPermissions = useGardenPermissions();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const chainId = useChainId();
  const [{ data, fetching, error }] = useQuery({ 
    query: GET_GARDENS,
    variables: { chainId }
  });

  // Load all gardens - permissions are checked at garden level
  const gardens = data?.Garden || [];

  if (fetching) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gardens</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your gardens and view garden details</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse min-w-[320px]">
              <div className="h-48 bg-gray-200 dark:bg-gray-700"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                
                <div className="flex items-center justify-between text-sm mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          ))}
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
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Indexer Connection Issue</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Unable to load gardens from indexer: {error.message}</p>
                <p className="mt-1">Garden management features are still available if you have direct garden addresses.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Fallback content */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gardens</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Indexer offline - Limited functionality available
              </p>
            </div>
            {isDeployer && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <RiAddLine className="mr-2 h-4 w-4" />
                Create Garden
              </button>
            )}
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center py-8">
              <RiPlantLine className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Gardens Unavailable</h3>
              <p className="mt-1 text-sm text-gray-500">
                Cannot load gardens due to indexer connection issues. Please check back later.
              </p>
            </div>
          </div>
        </div>
        
        {isDeployer && (
          <CreateGardenModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gardens</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View all gardens. Manage gardens where you are an operator.
          </p>
        </div>
        {isDeployer && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <RiAddLine className="mr-2 h-4 w-4" />
            Create Garden
          </button>
        )}
      </div>

      {gardens.length === 0 ? (
        <div className="text-center py-12">
          <RiPlantLine className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No gardens</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isDeployer 
              ? "Get started by creating your first garden."
              : "No gardens created yet."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {(gardens as Garden[]).map((garden: Garden) => {
          const canManage = gardenPermissions.canManageGarden(garden);
          const resolvedBannerImage = garden.bannerImage ? resolveIPFSUrl(garden.bannerImage) : null;
          
          return (
            <div key={garden.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow min-w-[320px]">
              <div className="h-48 relative">
                {resolvedBannerImage ? (
                  <img
                    src={resolvedBannerImage}
                    alt={garden.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                      if (placeholder) {
                        placeholder.style.display = 'flex';
                      }
                      e.currentTarget.style.display = 'none';
                    }}
                    loading="lazy"
                  />
                ) : null}
                {/* Gradient placeholder */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 ${resolvedBannerImage ? 'hidden' : 'flex'} items-center justify-center`}
                  style={{ display: resolvedBannerImage ? 'none' : 'flex' }}
                >
                  <div className="text-white text-center">
                    <div className="text-2xl font-bold opacity-80">{garden.name.charAt(0)}</div>
                  </div>
                </div>
                {canManage && (
                  <div className="absolute top-2 right-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                    <RiShieldCheckLine className="h-3 w-3 mr-1" />
                    Operator
                  </div>
                )}
              </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">{garden.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{garden.location}</p>
                    </div>
                    {!resolvedBannerImage && canManage && (
                      <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium flex items-center ml-2">
                        <RiShieldCheckLine className="h-3 w-3 mr-1" />
                        Operator
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{garden.description}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <RiUserLine className="h-4 w-4 mr-1" />
                        <span>{garden.operators?.length || 0} operators</span>
                      </div>
                      <div className="flex items-center">
                        <RiUserLine className="h-4 w-4 mr-1" />
                        <span>{garden.gardeners?.length || 0} gardeners</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      to={`/gardens/${garden.id}`}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <RiEyeLine className="mr-1 h-4 w-4" />
                      {canManage ? "Manage" : "View"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isDeployer && (
        <CreateGardenModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
      )}
    </div>
  );
}