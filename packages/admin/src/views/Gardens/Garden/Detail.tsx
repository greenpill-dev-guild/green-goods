import { DEFAULT_CHAIN_ID, formatDate, toastService } from "@green-goods/shared";
import {
  queryInvalidation,
  useDelayedInvalidation,
  useGardenAssessments,
  useGardenOperations,
  useGardenPermissions,
  useGardens,
  useWorks,
} from "@green-goods/shared/hooks";
import type { GardenOperationResult } from "@green-goods/shared/hooks";
import { resolveIPFSUrl } from "@green-goods/shared/modules";
import type { GardenRole } from "@green-goods/shared/utils";
import {
  GARDEN_ROLE_COLORS,
  GARDEN_ROLE_I18N_KEYS,
  GARDEN_ROLE_ORDER,
  getRoleColorClasses,
  ROLE_COLOR_CLASSES,
} from "@green-goods/shared/utils";
import {
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiMedalLine,
  RiAddLine,
  RiShieldCheckLine,
  RiUserAddLine,
  RiUserLine,
} from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useIntl } from "react-intl";
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
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const gardenPermissions = useGardenPermissions();
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [memberType, setMemberType] = useState<GardenRole>("gardener");
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersModalType, setMembersModalType] = useState<GardenRole>("gardener");

  const openAddMemberModal = (type: GardenRole) => {
    setMemberType(type);
    setAddMemberModalOpen(true);
  };

  const openMembersModal = (type: GardenRole) => {
    setMembersModalType(type);
    setMembersModalOpen(true);
  };

  // Use shared useGardens hook and find the specific garden
  const { data: gardens = [], isLoading: fetching, error } = useGardens();
  const garden = gardens.find((g) => g.id === id);

  // Background refetch to sync with indexer after transaction confirms
  // Uses useDelayedInvalidation for auto-cleanup on unmount
  const { start: scheduleBackgroundRefetch } = useDelayedInvalidation(() => {
    const keysToInvalidate = queryInvalidation.invalidateGardens(DEFAULT_CHAIN_ID);
    keysToInvalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
  }, 5000);

  const {
    data: assessmentList = [],
    isLoading: fetchingAssessments,
    error: assessmentsError,
  } = useGardenAssessments(id, 5);

  const assessments = assessmentList;

  const {
    addGardener,
    removeGardener,
    addOperator,
    removeOperator,
    addEvaluator,
    removeEvaluator,
    addOwner,
    removeOwner,
    addFunder,
    removeFunder,
    addCommunity,
    removeCommunity,
    isLoading,
  } = useGardenOperations(id!);

  const canManage = garden ? gardenPermissions.canManageGarden(garden) : false;
  const canReview = garden ? gardenPermissions.canReviewGarden(garden) : false;
  const canManageRoles = garden ? gardenPermissions.canAddMembers(garden) : false;

  // Fetch work submissions for this garden using shared hook
  const { works } = useWorks(id!);

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

  // Build localized role labels from shared i18n keys
  const getRoleLabel = (role: GardenRole) => ({
    singular: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].singular }),
    plural: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].plural }),
  });

  const roleMembers: Record<GardenRole, string[]> = {
    owner: garden.owners ?? [],
    operator: garden.operators ?? [],
    evaluator: garden.evaluators ?? [],
    gardener: garden.gardeners ?? [],
    funder: garden.funders ?? [],
    community: garden.communities ?? [],
  };

  const roleActions = {
    owner: { add: addOwner, remove: removeOwner },
    operator: { add: addOperator, remove: removeOperator },
    evaluator: { add: addEvaluator, remove: removeEvaluator },
    gardener: { add: addGardener, remove: removeGardener },
    funder: { add: addFunder, remove: removeFunder },
    community: { add: addCommunity, remove: removeCommunity },
  } satisfies Record<
    GardenRole,
    {
      add: (address: string) => Promise<GardenOperationResult>;
      remove: (address: string) => Promise<GardenOperationResult>;
    }
  >;

  const roleIcons = {
    owner: RiShieldCheckLine,
    operator: RiUserLine,
    evaluator: RiCheckboxCircleLine,
    gardener: RiUserLine,
    funder: RiMedalLine,
    community: RiUserLine,
  } as const;

  // Use shared role color classes and order from @green-goods/shared
  // GARDEN_ROLE_ORDER, GARDEN_ROLE_COLORS, ROLE_COLOR_CLASSES, getRoleColorClasses

  const activeRole = membersModalType;
  const ActiveRoleIcon = roleIcons[activeRole];

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
              className={`absolute inset-0 items-center justify-center bg-gradient-to-br from-primary-dark via-primary-base to-primary-darker text-primary-foreground ${garden.bannerImage ? "hidden" : "flex"}`}
              style={{ display: garden.bannerImage ? "none" : "flex" }}
            >
              <div className="text-center">
                <div className="text-4xl font-bold opacity-80">{garden.name.charAt(0)}</div>
                <div className="mt-2 text-lg opacity-60">{garden.name}</div>
              </div>
            </div>

            {/* Garden Name Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-static-black/80 via-static-black/50 to-transparent p-4 text-static-white sm:p-6">
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
              <Link
                to={`/gardens/${id}/hypercerts`}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-bg-white/95 text-text-sub shadow-lg backdrop-blur transition hover:bg-bg-white active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
                title={formatMessage({ id: "app.hypercerts.actions.viewHypercerts" })}
                aria-label={formatMessage({ id: "app.hypercerts.actions.viewHypercerts" })}
              >
                <RiMedalLine className="h-5 w-5" />
                <span className="hidden text-sm font-medium sm:inline">
                  {formatMessage({ id: "app.hypercerts.actions.viewHypercerts" })}
                </span>
              </Link>
              {canReview && (
                <Link
                  to={`/gardens/${id}/assessments/create`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-base text-primary-foreground shadow-lg transition hover:bg-primary-darker active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
                  title="New Assessment"
                  aria-label="New Assessment"
                >
                  <RiFileList3Line className="h-5 w-5" />
                  <span className="hidden text-sm font-medium sm:inline">New Assessment</span>
                </Link>
              )}
              {canManage && (
                <Link
                  to={`/gardens/${id}/hypercerts/create`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-base text-primary-foreground shadow-lg transition hover:bg-primary-darker active:scale-95 sm:h-auto sm:w-auto sm:gap-2 sm:rounded-md sm:px-3 sm:py-2"
                  title={formatMessage({ id: "app.hypercerts.actions.newHypercert" })}
                  aria-label={formatMessage({ id: "app.hypercerts.actions.newHypercert" })}
                >
                  <RiAddLine className="h-5 w-5" />
                  <span className="hidden text-sm font-medium sm:inline">
                    {formatMessage({ id: "app.hypercerts.actions.newHypercert" })}
                  </span>
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
          <WorkSubmissionsView gardenId={garden.id} canManage={canReview} />
        </section>

        {/* Roles: Sidebar */}
        <section className="grid-area-roles">
          <div className="grid gap-4 sm:grid-cols-2">
            {GARDEN_ROLE_ORDER.map((role) => {
              const members = roleMembers[role];
              const roleLabel = getRoleLabel(role);
              const colors = getRoleColorClasses(role);
              const Icon = roleIcons[role];

              return (
                <aside
                  key={role}
                  className="rounded-lg border border-stroke-soft bg-bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-stroke-soft p-4 sm:p-6">
                    <h3 className="min-w-0 truncate text-base font-medium text-text-strong sm:text-lg">
                      {roleLabel.plural}
                    </h3>
                    {canManageRoles && (
                      <button
                        onClick={() => openAddMemberModal(role)}
                        className="inline-flex min-h-[44px] flex-shrink-0 items-center whitespace-nowrap rounded-md bg-bg-weak border border-stroke-sub px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft active:scale-95 sm:min-h-0 sm:py-1.5"
                        aria-label={formatMessage(
                          { id: "app.admin.roles.add" },
                          { role: roleLabel.singular }
                        )}
                        type="button"
                      >
                        <RiUserAddLine className="mr-1 h-4 w-4" />
                        Add
                      </button>
                    )}
                  </div>
                  <div className="p-4 sm:p-6">
                    {members.length === 0 ? (
                      <p className="py-4 text-center text-sm text-text-soft">
                        {formatMessage({ id: "app.admin.roles.empty" }, { role: roleLabel.plural })}
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2 sm:space-y-3">
                          {members.slice(0, 3).map((member: string, index: number) => (
                            <div
                              key={`${member}-${index}`}
                              className="flex items-center justify-between gap-2 rounded-md bg-bg-weak p-2.5 sm:p-3"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                <div
                                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${colors.iconBg} sm:h-9 sm:w-9`}
                                >
                                  <Icon className={`h-4 w-4 ${colors.iconText}`} />
                                </div>
                                <AddressDisplay address={member} className="min-w-0 flex-1" />
                              </div>
                              {canManageRoles && (
                                <button
                                  onClick={async () => {
                                    const result = await roleActions[role].remove(member);
                                    if (result.success) {
                                      scheduleBackgroundRefetch();
                                    } else {
                                      toastService.error({
                                        title: formatMessage(
                                          { id: "app.admin.roles.removeFailed" },
                                          { role: roleLabel.singular }
                                        ),
                                        message:
                                          result.error?.message ??
                                          formatMessage(
                                            { id: "app.admin.roles.removeFailed" },
                                            { role: roleLabel.singular }
                                          ),
                                      });
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-error-base transition hover:bg-error-lighter active:scale-95 disabled:opacity-50/20"
                                  aria-label={formatMessage(
                                    { id: "app.admin.roles.remove" },
                                    { role: roleLabel.singular }
                                  )}
                                  type="button"
                                >
                                  <RiDeleteBinLine className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {members.length > 3 && (
                          <button
                            type="button"
                            onClick={() => openMembersModal(role)}
                            className="mt-3 w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak active:scale-95"
                          >
                            View All ({members.length})
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </aside>
              );
            })}
          </div>
        </section>

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
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-feature-lighter">
                        <RiFileList3Line className="h-4 w-4 text-feature-dark" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-strong">
                          {assessment.title || assessment.assessmentType || "Assessment"}
                        </p>
                        <p className="text-xs text-text-soft">{formatDate(assessment.createdAt)}</p>
                      </div>
                    </div>
                    <a
                      href={`${EAS_EXPLORER_URL}/attestation/view/${assessment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-primary-dark transition hover:text-primary-darker"
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
          const result = await roleActions[memberType].add(address);

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
        title={formatMessage(
          { id: "app.admin.roles.all" },
          { role: getRoleLabel(activeRole).plural }
        )}
        members={roleMembers[activeRole]}
        canManage={canManageRoles}
        onRemove={async (member: string) => {
          const result = await roleActions[activeRole].remove(member);

          if (result.success) {
            // Schedule background refetch to sync with indexer
            scheduleBackgroundRefetch();
          } else {
            toastService.error({
              title: formatMessage(
                { id: "app.admin.roles.removeFailed" },
                { role: getRoleLabel(activeRole).singular }
              ),
              message:
                result.error?.message ??
                formatMessage(
                  { id: "app.admin.roles.removeFailed" },
                  { role: getRoleLabel(activeRole).singular }
                ),
            });
          }
        }}
        isLoading={isLoading}
        icon={<ActiveRoleIcon className="h-5 w-5" />}
        colorScheme={GARDEN_ROLE_COLORS[activeRole]}
      />
    </div>
  );
}
