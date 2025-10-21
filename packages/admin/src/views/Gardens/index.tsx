import { useGardenPermissions } from "@green-goods/shared/hooks/garden";
// Garden type is now global - no import needed
import { resolveIPFSUrl } from "@green-goods/shared/utils/pinata";
import { RiAddLine, RiEyeLine, RiPlantLine, RiShieldCheckLine, RiUserLine } from "@remixicon/react";
import { graphql } from "gql.tada";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "urql";
import { useChainId } from "wagmi";
import { CreateGardenModal } from "@/components/Garden/CreateGardenModal";
import { PageHeader } from "@/components/Layout/PageHeader";

const GET_GARDENS = graphql(`
  query GetGardens($chainId: Int!) {
    Garden(where: { chainId: { _eq: $chainId } }) {
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
  const gardenPermissions = useGardenPermissions();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const chainId = useChainId();
  const [{ data, fetching, error }] = useQuery({
    query: GET_GARDENS,
    variables: { chainId },
  });

  const gardens = (data?.Garden ?? []) as Garden[];
  const errorMessage = error?.message;

  const headerDescription = errorMessage
    ? "Indexer offline — limited functionality available."
    : "View all gardens. Manage gardens where you are an operator.";

  const headerActions = (
    <button
      type="button"
      onClick={() => setCreateModalOpen(true)}
      disabled={fetching}
      className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RiAddLine className="mr-2 h-4 w-4" />
      Create Garden
    </button>
  );

  let content: ReactNode;

  if (fetching) {
    content = (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="min-w-[320px] animate-pulse overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="h-48 bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <div className="h-6 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  } else if (errorMessage) {
    content = (
      <div className="space-y-8">
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-400/20 dark:bg-yellow-500/10">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-yellow-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Indexer Connection Issue
              </h3>
              <div className="mt-2 space-y-1 text-sm text-yellow-700 dark:text-yellow-100/80">
                <p>Unable to load gardens from indexer: {errorMessage}</p>
                <p>
                  Garden management features are still available if you have direct garden
                  addresses.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <RiPlantLine className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            Gardens Unavailable
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Cannot load gardens due to indexer connection issues. Please check back later.
          </p>
        </div>
      </div>
    );
  } else if (gardens.length === 0) {
    content = (
      <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
        <RiPlantLine className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          No gardens yet
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Get started by creating your first garden.
        </p>
      </div>
    );
  } else {
    content = (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {gardens.map((garden) => {
          const canManage = gardenPermissions.canManageGarden(garden as any);
          const resolvedBannerImage = garden.bannerImage
            ? resolveIPFSUrl(garden.bannerImage)
            : null;

          return (
            <div
              key={garden.id}
              className="min-w-[320px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="relative h-48">
                {resolvedBannerImage ? (
                  <img
                    src={resolvedBannerImage}
                    alt={garden.name}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      const placeholder = event.currentTarget
                        .nextElementSibling as HTMLElement | null;
                      if (placeholder) {
                        placeholder.style.display = "flex";
                      }
                      event.currentTarget.style.display = "none";
                    }}
                    loading="lazy"
                  />
                ) : null}
                <div
                  className={`absolute inset-0 items-center justify-center bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 text-white ${resolvedBannerImage ? "hidden" : "flex"}`}
                  style={{ display: resolvedBannerImage ? "none" : "flex" }}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold opacity-80">{garden.name.charAt(0)}</div>
                  </div>
                </div>
                {canManage && (
                  <div className="absolute top-2 right-2 flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                    <RiShieldCheckLine className="mr-1 h-3 w-3" />
                    Operator
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="mb-1 text-lg font-medium text-gray-900 dark:text-gray-100">
                      {garden.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{garden.location}</p>
                  </div>
                  {!resolvedBannerImage && canManage && (
                    <div className="ml-2 flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                      <RiShieldCheckLine className="mr-1 h-3 w-3" />
                      Operator
                    </div>
                  )}
                </div>
                <p className="mb-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                  {garden.description}
                </p>

                <div className="mb-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <RiUserLine className="mr-1 h-4 w-4" />
                      <span>{garden.operators?.length ?? 0} operators</span>
                    </div>
                    <div className="flex items-center">
                      <RiUserLine className="mr-1 h-4 w-4" />
                      <span>{garden.gardeners?.length ?? 0} gardeners</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Link
                    to={`/gardens/${garden.id}`}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
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
    );
  }

  return (
    <div className="pb-6">
      <PageHeader title="Gardens" description={headerDescription} actions={headerActions} />
      <div className="mt-6 px-6">{content}</div>
      <CreateGardenModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  );
}
