import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "urql";
import { graphql } from "gql.tada";
import { RiAddLine, RiPlantLine, RiUserLine, RiEyeLine } from "@remixicon/react";
import { useRole } from "@/hooks/useRole";
import { CreateGardenModal } from "@/components/Garden/CreateGardenModal";
import type { Garden } from "@/types/garden";

const GET_GARDENS = graphql(`
  query GetGardens {
    gardens {
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
  const { isAdmin, operatorGardens } = useRole();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [{ data, fetching, error }] = useQuery({ query: GET_GARDENS });

  const gardens = isAdmin ? (data?.gardens || []) : operatorGardens;

  if (fetching) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
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
          <p className="text-red-800">Failed to load gardens: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gardens</h1>
          <p className="text-gray-600 mt-1">
            {isAdmin 
              ? "Manage all gardens on the platform"
              : "View and manage your assigned gardens"
            }
          </p>
        </div>
        {isAdmin && (
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
            {isAdmin 
              ? "Get started by creating your first garden."
              : "No gardens assigned to you yet."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(gardens as Garden[]).map((garden: Garden) => (
            <div key={garden.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {garden.bannerImage && (
                <div className="h-48 bg-gray-200">
                  <img
                    src={garden.bannerImage}
                    alt={garden.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">{garden.name}</h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{garden.description}</p>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
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

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{garden.location}</span>
                  <Link
                    to={`/gardens/${garden.id}`}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <RiEyeLine className="mr-1 h-4 w-4" />
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <CreateGardenModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
      )}
    </div>
  );
}