import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "urql";
import { graphql } from "gql.tada";
import {
  RiFileList3Line,
  RiExternalLinkLine,
  RiUserLine,
  RiDeleteBinLine,
  RiUserAddLine,
} from "@remixicon/react";
import { useGardenPermissions } from "@/hooks/useGardenPermissions";
import { useGardenOperations } from "@/hooks/useGardenOperations";
import { useGardenAssessments } from "@/hooks/useGardenAssessments";

import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { resolveIPFSUrl } from "@/utils/pinata";
import { CreateAssessmentModal } from "@/components/Garden/CreateAssessmentModal";
import { PageHeader } from "@/components/Layout/PageHeader";

const EAS_EXPLORER_URL = "https://explorer.easscan.org";
const GET_GARDEN_DETAIL = graphql(`
  query GetGardenDetail($id: String!) {
    Garden(where: { id: { _eq: $id } }) {
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
  const gardenPermissions = useGardenPermissions();
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [addAssessmentModalOpen, setAddAssessmentModalOpen] = useState(false);
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

  const {
    data: assessmentList = [],
    isLoading: fetchingAssessments,
    error: assessmentsError,
  } = useGardenAssessments(id, 5);

  const assessments = assessmentList;

  const { addGardener, removeGardener, addOperator, removeOperator, isLoading } =
    useGardenOperations(id!);

  const garden = data?.Garden?.[0];
  const canManage = garden ? gardenPermissions.canManageGarden(garden) : false;

  const baseHeaderProps = {
    backLink: { to: "/gardens", label: "Back to gardens" },
    sticky: true,
  } as const;

  if (fetching) {
    return (
      <div className="pb-6">
        <PageHeader
          title="Loading garden…"
          description="Fetching garden details."
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6">
          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="h-8 w-1/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title="Garden"
          description="Unable to load garden details."
          {...baseHeaderProps}
        />
        <div className="mt-6 px-6">
          <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-400/40 dark:bg-red-500/10">
            <p className="text-sm text-red-800 dark:text-red-200">
              {error?.message ?? "Garden not found"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      {canManage && (
        <button
          type="button"
          onClick={() => setAddAssessmentModalOpen(true)}
          className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          <RiFileList3Line className="mr-2 h-4 w-4" />
          New Assessment
        </button>
      )}
      <Link
        to={`/gardens/${id}/assessments`}
        className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        <RiFileList3Line className="mr-2 h-4 w-4" />
        View Assessments
      </Link>
    </div>
  );

  return (
    <div className="pb-6">
      <PageHeader
        title={garden.name}
        description="Manage membership and view garden details."
        actions={headerActions}
        {...baseHeaderProps}
      />

      <div className="mt-6 space-y-8 px-6">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="relative h-64">
            {garden.bannerImage ? (
              <img
                src={resolveIPFSUrl(garden.bannerImage)}
                alt={garden.name}
                className="h-full w-full object-cover"
                onError={(event) => {
                  const placeholder = event.currentTarget.nextElementSibling as HTMLElement | null;
                  if (placeholder) {
                    placeholder.style.display = "flex";
                  }
                  event.currentTarget.style.display = "none";
                }}
                loading="lazy"
              />
            ) : null}
            <div
              className={`absolute inset-0 items-center justify-center bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 text-white ${garden.bannerImage ? "hidden" : "flex"}`}
              style={{ display: garden.bannerImage ? "none" : "flex" }}
            >
              <div className="text-center">
                <div className="text-4xl font-bold opacity-80">{garden.name.charAt(0)}</div>
                <div className="mt-2 text-lg opacity-60">{garden.name}</div>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Description</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{garden.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Token Address
                </p>
                <p className="mt-2 break-words text-sm text-gray-900 dark:text-gray-100">
                  {garden.tokenAddress}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Chain
                </p>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {garden.chainId}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Token ID
                </p>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {garden.tokenID.toString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Operators</h3>
              {canManage && (
                <button
                  onClick={() => openAddMemberModal("operator")}
                  className="inline-flex items-center rounded-md bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-200"
                >
                  <RiUserAddLine className="mr-1 h-4 w-4" />
                  Add
                </button>
              )}
            </div>
            <div className="p-6">
              {garden.operators.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No operators assigned
                </p>
              ) : (
                <div className="space-y-3">
                  {garden.operators.map((operator: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-900/40"
                    >
                      <div className="flex min-w-0 flex-1 items-center space-x-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                          <RiUserLine className="h-4 w-4 text-blue-600" />
                        </div>
                        <AddressDisplay address={operator} className="min-w-0 flex-1" />
                      </div>
                      {canManage && (
                        <button
                          onClick={async () => {
                            await removeOperator(operator);
                            await refetch({ requestPolicy: "network-only" });
                          }}
                          disabled={isLoading}
                          className="text-red-600 transition hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
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

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
            <div className="border-b border-gray-200 p-6 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Gardeners</h3>
                {canManage && (
                  <button
                    onClick={() => openAddMemberModal("gardener")}
                    className="inline-flex items-center rounded-md bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-200"
                  >
                    <RiUserAddLine className="mr-1 h-4 w-4" />
                    Add
                  </button>
                )}
              </div>
            </div>
            <div className="p-6">
              {garden.gardeners.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No gardeners assigned
                </p>
              ) : (
                <div className="space-y-3">
                  {garden.gardeners.map((gardener: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-900/40"
                    >
                      <div className="flex min-w-0 flex-1 items-center space-x-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                          <RiUserLine className="h-4 w-4 text-green-600" />
                        </div>
                        <AddressDisplay address={gardener} className="min-w-0 flex-1" />
                      </div>
                      {canManage && (
                        <button
                          onClick={async () => {
                            await removeGardener(gardener);
                            await refetch({ requestPolicy: "network-only" });
                          }}
                          disabled={isLoading}
                          className="text-red-600 transition hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
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

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Recent Assessments
            </h3>
            <Link
              to={`/gardens/${id}/assessments`}
              className="inline-flex items-center rounded-md bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-200"
            >
              View All
            </Link>
          </div>
          <div className="p-6">
            {fetchingAssessments ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading assessments...
              </p>
            ) : assessmentsError ? (
              <p className="py-4 text-center text-sm text-red-600 dark:text-red-400">
                Failed to load assessments:{" "}
                {assessmentsError instanceof Error ? assessmentsError.message : "Unknown error"}
              </p>
            ) : assessments.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No assessments found
              </p>
            ) : (
              <div className="space-y-3">
                {assessments.map((attestation) => {
                  const assessmentData = attestation.decodedDataJson
                    ? JSON.parse(attestation.decodedDataJson)
                    : {};
                  return (
                    <div
                      key={attestation.id}
                      className="flex items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-900/40"
                    >
                      <div className="flex min-w-0 flex-1 items-center space-x-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                          <RiFileList3Line className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            CO2 Stock: {assessmentData.carbonTonStock ?? "-"} T
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(attestation.time * 1000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`${EAS_EXPLORER_URL}/attestation/view/${attestation.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-green-600 transition hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
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
      </div>

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
          await refetch({ requestPolicy: "network-only" });
        }}
        isLoading={isLoading}
      />

      <CreateAssessmentModal
        isOpen={addAssessmentModalOpen}
        onClose={() => setAddAssessmentModalOpen(false)}
        gardenId={garden.id}
      />
    </div>
  );
}
