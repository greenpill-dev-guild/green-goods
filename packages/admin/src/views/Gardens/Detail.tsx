import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "urql";
import { graphql } from "gql.tada";
import { RiArrowLeftLine, RiUserLine, RiDeleteBinLine, RiUserAddLine } from "@remixicon/react";
import { useRole } from "@/hooks/useRole";
import { useGardenOperations } from "@/hooks/useGardenOperations";
import { AddMemberModal } from "@/components/Garden/AddMemberModal";

const GET_GARDEN_DETAIL = graphql(`
  query GetGardenDetail($id: ID!) {
    garden(id: $id) {
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

export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, operatorGardens } = useRole();
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [memberType, setMemberType] = useState<"gardener" | "operator">("gardener");
  
  const [{ data, fetching, error }] = useQuery({
    query: GET_GARDEN_DETAIL,
    variables: { id: id! },
    pause: !id,
  });

  const { addGardener, removeGardener, addOperator, removeOperator, isLoading } = useGardenOperations(id!);

  const garden = data?.garden;

  // Check if current user is operator of this garden
  const isOperatorOfGarden = operatorGardens.some(g => g.id === id);
  const canManage = isAdmin || isOperatorOfGarden;

  if (fetching) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !garden) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">
            {error?.message || "Garden not found"}
          </p>
        </div>
      </div>
    );
  }

  const openAddMemberModal = (type: "gardener" | "operator") => {
    setMemberType(type);
    setAddMemberModalOpen(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link
            to="/gardens"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <RiArrowLeftLine className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{garden.name}</h1>
            <p className="text-gray-600">{garden.location}</p>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          Chain ID: {garden.chainId} | Token ID: {garden.tokenID.toString()}
        </div>
      </div>

      {/* Garden Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
        {garden.bannerImage && (
          <div className="h-64 rounded-t-lg overflow-hidden">
            <img
              src={garden.bannerImage}
              alt={garden.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Description</h2>
          <p className="text-gray-600">{garden.description}</p>
        </div>
      </div>

      {/* Members Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Operators */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Operators</h3>
              {canManage && (
                <button
                  onClick={() => openAddMemberModal("operator")}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200"
                >
                  <RiUserAddLine className="mr-1 h-4 w-4" />
                  Add
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {garden.operators.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No operators assigned</p>
            ) : (
              <div className="space-y-3">
                {garden.operators.map((operator: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <RiUserLine className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-mono">{operator}</span>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => removeOperator(operator)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <RiDeleteBinLine className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gardeners */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Gardeners</h3>
              {canManage && (
                <button
                  onClick={() => openAddMemberModal("gardener")}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200"
                >
                  <RiUserAddLine className="mr-1 h-4 w-4" />
                  Add
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {garden.gardeners.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No gardeners assigned</p>
            ) : (
              <div className="space-y-3">
                {garden.gardeners.map((gardener: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                        <RiUserLine className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-sm font-mono">{gardener}</span>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => removeGardener(gardener)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <RiDeleteBinLine className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        memberType={memberType}
        onAdd={async (address: string) => {
          if (memberType === "gardener") {
            await addGardener(address);
          } else {
            await addOperator(address);
          }
        }}
        isLoading={isLoading}
      />
    </div>
  );
}