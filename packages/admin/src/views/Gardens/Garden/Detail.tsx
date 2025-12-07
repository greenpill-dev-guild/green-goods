import { DEFAULT_CHAIN_ID, STALE_TIMES } from "@green-goods/shared";
import {
  queryKeys,
  useGardenAssessments,
  useGardenOperations,
  useGardenPermissions,
  useGardens,
} from "@green-goods/shared/hooks";
import { getWorks, resolveIPFSUrl } from "@green-goods/shared/modules";
import {
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiShieldCheckLine,
  RiUserAddLine,
  RiUserLine,
} from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AddressDisplay } from "@/components/AddressDisplay";
import { AddMemberModal } from "@/components/Garden/AddMemberModal";
import { GardenMetadata } from "@/components/Garden/GardenMetadata";
import { MembersModal } from "@/components/Garden/MembersModal";
import { PageHeader } from "@/components/Layout/PageHeader";
import { StatCard } from "@/components/StatCard";
import { WorkSubmissionsView } from "@/components/Work/WorkSubmissionsView";
import "./GardenDetailLayout.css";

const EAS_EXPLORER_URL = "https://explorer.easscan.org";

export default function GardenDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const gardenPermissions = useGardenPermissions();
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [memberType, setMemberType] = useState<"gardener" | "operator">("gardener");
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersModalType, setMembersModalType] = useState<"gardener" | "operator">("gardener");

  const openAddMemberModal = (type: "gardener" | "operator") => {
    setMemberType(type);
    setAddMemberModalOpen(true);
  };

  const openMembersModal = (type: "gardener" | "operator") => {
    setMembersModalType(type);
    setMembersModalOpen(true);
  };

  // Use shared useGardens hook and find the specific garden
  const { data: gardens = [], isLoading: fetching, error } = useGardens();
  const garden = gardens.find((g) => g.id === id);

  // Background refetch to sync with indexer after transaction confirms
  // This is a fallback - optimistic updates handle immediate UI updates
  const scheduleBackgroundRefetch = useCallback(() => {
    // Delay refetch to allow indexer to process the transaction
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gardens.byChain(DEFAULT_CHAIN_ID) });
    }, 5000);
  }, [queryClient]);

  const {
    data: assessmentList = [],
    isLoading: fetchingAssessments,
    error: assessmentsError,
  } = useGardenAssessments(id, 5);

  const assessments = assessmentList;

  const { addGardener, removeGardener, addOperator, removeOperator, isLoading } =
    useGardenOperations(id!);

  const canManage = garden ? gardenPermissions.canManageGarden(garden) : false;

  // Fetch work submissions for this garden
  const { data: works = [] } = useQuery({
    queryKey: queryKeys.works.online(id!, DEFAULT_CHAIN_ID),
    queryFn: () => getWorks(id),
    enabled: !!id,
    staleTime: STALE_TIMES.works,
  });

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
          <div className="space-y-4 rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
            <div className="h-8 w-1/4 animate-pulse rounded bg-bg-soft" />
            <div className="h-64 animate-pulse rounded bg-bg-soft" />
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
          <div className="rounded-md border border-error-light bg-error-lighter p-4">
            <p className="text-sm text-error-dark">{error?.message ?? "Garden not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="garden-detail-container pb-6">
      <PageHeader title={garden.name} {...baseHeaderProps} />

      <div className="garden-detail-grid mt-6 px-4 sm:px-6">
        {/* Hero: Garden Banner & Description */}
        <section className="grid-area-hero overflow-hidden rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
          <div className="relative h-64 sm:h-72">
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

            {/* Garden Name Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 text-white sm:p-6">
              <h2 className="text-xl font-bold drop-shadow-lg sm:text-2xl">{garden.name}</h2>
              <p className="mt-1 text-sm opacity-90 sm:text-base">{garden.location}</p>
            </div>

            {/* Floating Action Buttons */}
            <div className="absolute top-3 right-3 flex flex-col gap-2 sm:top-4 sm:right-4 sm:flex-row">
              <Link
                to={`/gardens/${id}/assessments`}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-bg-white/95 text-text-sub shadow-lg backdrop-blur transition hover:bg-bg-white active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
                title="View Assessments"
                aria-label="View Assessments"
              >
                <RiFileList3Line className="h-5 w-5" />
                <span className="hidden text-sm font-medium sm:inline">View Assessments</span>
              </Link>
              {canManage && (
                <Link
                  to={`/gardens/${id}/assessments/create`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition hover:bg-green-700 active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
                  title="New Assessment"
                  aria-label="New Assessment"
                >
                  <RiFileList3Line className="h-5 w-5" />
                  <span className="hidden text-sm font-medium sm:inline">New Assessment</span>
                </Link>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <p className="text-sm text-text-sub">{garden.description}</p>
          </div>
        </section>

        {/* Metadata: Quick Actions & Links */}
        <section className="grid-area-metadata">
          <GardenMetadata
            gardenId={garden.id}
            tokenAddress={garden.tokenAddress}
            tokenId={garden.tokenID}
            chainId={garden.chainId}
          />
        </section>

        {/* Stats: 4 Stat Cards */}
        <section className="grid-area-stats grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 md:grid-cols-4">
          <StatCard
            icon={<RiUserLine className="h-5 w-5" />}
            label="Gardeners"
            value={garden.gardeners.length}
          />
          <StatCard
            icon={<RiShieldCheckLine className="h-5 w-5" />}
            label="Operators"
            value={garden.operators.length}
          />
          <StatCard
            icon={<RiCheckboxCircleLine className="h-5 w-5" />}
            label="Work"
            value={works.length}
          />
          <StatCard
            icon={<RiFileList3Line className="h-5 w-5" />}
            label="Assessments"
            value={assessments.length}
          />
        </section>

        {/* Work: Primary Content */}
        <section className="grid-area-work">
          <WorkSubmissionsView gardenId={garden.id} canManage={canManage} />
        </section>

        {/* Operators: Sidebar */}
        <aside className="grid-area-operators rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-stroke-soft p-4 sm:p-6">
            <h3 className="min-w-0 truncate text-base font-medium text-text-strong sm:text-lg">
              Operators
            </h3>
            {canManage && (
              <button
                onClick={() => openAddMemberModal("operator")}
                className="inline-flex min-h-[44px] flex-shrink-0 items-center whitespace-nowrap rounded-md bg-bg-weak border border-stroke-sub px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft active:scale-95 sm:min-h-0 sm:py-1.5"
                aria-label="Add operator"
                type="button"
              >
                <RiUserAddLine className="mr-1 h-4 w-4" />
                Add
              </button>
            )}
          </div>
          <div className="p-4 sm:p-6">
            {garden.operators.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-soft">No operators assigned</p>
            ) : (
              <>
                <div className="space-y-2 sm:space-y-3">
                  {garden.operators.slice(0, 3).map((operator: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 rounded-md bg-bg-weak p-2.5 sm:p-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-information-lighter sm:h-9 sm:w-9">
                          <RiUserLine className="h-4 w-4 text-information-base" />
                        </div>
                        <AddressDisplay address={operator} className="min-w-0 flex-1" />
                      </div>
                      {canManage && (
                        <button
                          onClick={async () => {
                            const result = await removeOperator(operator);
                            if (result.success) {
                              // Schedule background refetch to sync with indexer
                              scheduleBackgroundRefetch();
                            }
                          }}
                          disabled={isLoading}
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-error-base transition hover:bg-error-lighter active:scale-95 disabled:opacity-50/20"
                          aria-label="Remove operator"
                          type="button"
                        >
                          <RiDeleteBinLine className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {garden.operators.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openMembersModal("operator")}
                    className="mt-3 w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak active:scale-95"
                  >
                    View All ({garden.operators.length})
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Gardeners: Sidebar */}
        <aside className="grid-area-gardeners rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
          <div className="border-b border-stroke-soft p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="min-w-0 truncate text-base font-medium text-text-strong sm:text-lg">
                Gardeners
              </h3>
              {canManage && (
                <button
                  onClick={() => openAddMemberModal("gardener")}
                  className="inline-flex min-h-[44px] flex-shrink-0 items-center whitespace-nowrap rounded-md bg-bg-weak border border-stroke-sub px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft active:scale-95 sm:min-h-0 sm:py-1.5"
                  aria-label="Add gardener"
                  type="button"
                >
                  <RiUserAddLine className="mr-1 h-4 w-4" />
                  Add
                </button>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {garden.gardeners.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-soft">No gardeners assigned</p>
            ) : (
              <>
                <div className="space-y-2 sm:space-y-3">
                  {garden.gardeners.slice(0, 3).map((gardener: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 rounded-md bg-bg-weak p-2.5 sm:p-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-success-lighter sm:h-9 sm:w-9">
                          <RiUserLine className="h-4 w-4 text-success-base" />
                        </div>
                        <AddressDisplay address={gardener} className="min-w-0 flex-1" />
                      </div>
                      {canManage && (
                        <button
                          onClick={async () => {
                            const result = await removeGardener(gardener);
                            if (result.success) {
                              // Schedule background refetch to sync with indexer
                              scheduleBackgroundRefetch();
                            }
                          }}
                          disabled={isLoading}
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-error-base transition hover:bg-error-lighter active:scale-95 disabled:opacity-50/20"
                          aria-label="Remove gardener"
                          type="button"
                        >
                          <RiDeleteBinLine className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {garden.gardeners.length > 3 && (
                  <button
                    type="button"
                    onClick={() => openMembersModal("gardener")}
                    className="mt-3 w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak active:scale-95"
                  >
                    View All ({garden.gardeners.length})
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Assessments: Sidebar */}
        <aside className="grid-area-assessments rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-stroke-soft p-4 sm:p-6">
            <h3 className="min-w-0 truncate text-base font-medium text-text-strong sm:text-lg">
              Recent Assessments
            </h3>
            <Link
              to={`/gardens/${id}/assessments`}
              className="inline-flex min-h-[44px] flex-shrink-0 items-center whitespace-nowrap rounded-md bg-bg-weak border border-stroke-sub px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft active:scale-95 sm:min-h-0 sm:py-1.5"
              aria-label="View all assessments"
            >
              View All
            </Link>
          </div>
          <div className="p-4 sm:p-6">
            {fetchingAssessments ? (
              <p className="py-4 text-center text-sm text-text-soft">Loading assessments...</p>
            ) : assessmentsError ? (
              <p className="py-4 text-center text-sm text-error-base">
                Failed to load assessments:{" "}
                {assessmentsError instanceof Error ? assessmentsError.message : "Unknown error"}
              </p>
            ) : assessments.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-soft">No assessments found</p>
            ) : (
              <div className="space-y-3">
                {assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between rounded-md bg-bg-weak p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center space-x-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                        <RiFileList3Line className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-strong">
                          {assessment.title || assessment.assessmentType || "Assessment"}
                        </p>
                        <p className="text-xs text-text-soft">
                          {new Date(assessment.createdAt * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`${EAS_EXPLORER_URL}/attestation/view/${assessment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-green-600 transition hover:text-green-900"
                    >
                      View <RiExternalLinkLine className="ml-1 h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <AddMemberModal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        memberType={memberType}
        onAdd={async (address: string) => {
          const result =
            memberType === "gardener" ? await addGardener(address) : await addOperator(address);

          if (result.success) {
            // Schedule background refetch to sync with indexer
            scheduleBackgroundRefetch();
          }
        }}
        isLoading={isLoading}
      />

      <MembersModal
        isOpen={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        title={membersModalType === "operator" ? "All Operators" : "All Gardeners"}
        members={membersModalType === "operator" ? garden.operators : garden.gardeners}
        canManage={canManage}
        onRemove={async (member: string) => {
          const result =
            membersModalType === "operator"
              ? await removeOperator(member)
              : await removeGardener(member);

          if (result.success) {
            // Schedule background refetch to sync with indexer
            scheduleBackgroundRefetch();
          }
        }}
        isLoading={isLoading}
        icon={<RiUserLine className="h-5 w-5" />}
        colorScheme={membersModalType === "operator" ? "blue" : "green"}
      />
    </div>
  );
}
