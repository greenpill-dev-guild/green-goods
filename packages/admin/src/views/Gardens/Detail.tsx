import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "urql";
import { graphql } from "gql.tada";
import {
  RiFileList3Line,
  RiArrowLeftLine,
  RiExternalLinkLine,
  RiUserLine,
  RiDeleteBinLine,
  RiUserAddLine,
} from "@remixicon/react";
import { useGardenPermissions } from "@/hooks/useGardenPermissions";
import { useGardenOperations } from "@/hooks/useGardenOperations";
import { useAdminStore } from "@/stores/admin";
import { getNetworkContracts } from "@/utils/contracts";

import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { resolveIPFSUrl } from "@/utils/pinata";
import { CreateAssessmentModal } from "@/components/Garden/CreateAssessmentModal";

const EAS_EXPLORER_URL = "https://explorer.easscan.org";
const GET_GARDEN_DETAIL = graphql(`
  query GetGardenDetail($id: String!) {
    Garden(where: {id: {_eq: $id}}) {
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

const GET_GARDEN_ASSESSMENTS = graphql(`
  query GetGardenAssessments($recipient: String!, $schemaId: String!, $limit: Int!) {
    Attestation(
      where: { recipient: { _eq: $recipient }, schemaId: { _eq: $schemaId } }
      orderBy: { time: desc }
      limit: $limit
    ) {
      id
      time
      decodedDataJson
    }
  }
`);

export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const gardenPermissions = useGardenPermissions();
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [memberType, setMemberType] = useState<"gardener" | "operator">("gardener");

  const openAddMemberModal = (type: "gardener" | "operator") => {
    setMemberType(type);
    setAddMemberModalOpen(true);
  };

  const [{ data, fetching, error }, refetch] = useQuery({
    query: GET_GARDEN_DETAIL,
    variables: { id: id! },
    pause: !id,
  });

  const { selectedChainId } = useAdminStore();
  const contracts = getNetworkContracts(selectedChainId);
  const [{ data: assessmentData, fetching: fetchingAssessments }] = useQuery({
    query: GET_GARDEN_ASSESSMENTS,
    variables: {
      recipient: id!,
      schemaId: contracts.eas!,
      limit: 5, // Fetch latest 5 assessments for the detail view
    },
    pause: !id || !contracts.eas,
  });
  const assessments = assessmentData?.Attestation || [];

  const { addGardener, removeGardener, addOperator, removeOperator, isLoading } =
    useGardenOperations(id!);

  const garden = data?.Garden?.[0];

  // Check if current user can manage this specific garden
  const canManage = garden ? gardenPermissions.canManageGarden(garden) : false;

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
          <p className="text-red-800">{error?.message || "Garden not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/gardens"
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-md flex-shrink-0"
            >
              <RiArrowLeftLine className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {garden.name}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span>{garden.location}</span>
                <span>•</span>
                <span>Chain {garden.chainId}</span>
                <span>•</span>
                <span>Token #{garden.tokenID.toString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link
              to={`/gardens/${id}/assessments`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <RiFileList3Line className="mr-2 h-4 w-4" />
              View Assessments
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Garden Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="h-64 rounded-t-lg overflow-hidden relative">
            {garden.bannerImage ? (
              <img
                src={resolveIPFSUrl(garden.bannerImage)}
                alt={garden.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                  if (placeholder) {
                    placeholder.style.display = "flex";
                  }
                  e.currentTarget.style.display = "none";
                }}
                loading="lazy"
              />
            ) : null}
            {/* Gradient placeholder */}
            <div
              className={`absolute inset-0 bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 ${garden.bannerImage ? "hidden" : "flex"} items-center justify-center`}
              style={{ display: garden.bannerImage ? "none" : "flex" }}
            >
              <div className="text-white text-center">
                <div className="text-4xl font-bold opacity-80">{garden.name.charAt(0)}</div>
                <div className="text-lg opacity-60 mt-2">{garden.name}</div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Description</h2>
            <p className="text-gray-600">{garden.description}</p>
          </div>
        </div>

        {/* Members Management */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <RiUserLine className="h-4 w-4 text-blue-600" />
                        </div>
                        <AddressDisplay address={operator} className="flex-1 min-w-0" />
                      </div>
                      {canManage && (
                        <button
                          onClick={async () => {
                            await removeOperator(operator);
                            await refetch({ requestPolicy: "network-only" });
                          }}
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
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <RiUserLine className="h-4 w-4 text-green-600" />
                        </div>
                        <AddressDisplay address={gardener} className="flex-1 min-w-0" />
                      </div>
                      {canManage && (
                        <button
                          onClick={async () => {
                            await removeGardener(gardener);
                            await refetch({ requestPolicy: "network-only" });
                          }}
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
        {/* Assessments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Recent Assessments</h3>
              <Link
                to={`/gardens/${id}/assessments`}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200"
              >
                View All
              </Link>
            </div>
          </div>
          <div className="p-6">
            {fetchingAssessments ? (
              <p className="text-gray-500 text-center py-4">Loading assessments...</p>
            ) : assessments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No assessments found</p>
            ) : (
              <div className="space-y-3">
                {assessments.map((attestation) => {
                  const assessmentData = JSON.parse(attestation.decodedDataJson);
                  return (
                    <div
                      key={attestation.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <RiFileList3Line className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            CO2 Stock: {assessmentData.carbonTonStock} T
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(attestation.time * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`${EAS_EXPLORER_URL}/attestation/view/${attestation.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-900 inline-flex items-center text-sm"
                      >
                        View <RiExternalLinkLine className="ml-1 h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
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
            // Refetch the garden data to show the updated member list
            await refetch({ requestPolicy: "network-only" });
          }}
          isLoading={isLoading}
        />
      </div>

      {/* Create Assessment Modal */}
      <CreateAssessmentModal
        isOpen={addAssessmentModalOpen}
        onClose={() => setAddAssessmentModalOpen(false)}
        gardenId={garden.id}
      />
    </div>
  );
}
