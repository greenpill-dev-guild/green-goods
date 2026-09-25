import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenDetailTab } from "@green-goods/shared/types/garden-detail";
import type { HypercertRecord } from "@green-goods/shared/types/hypercerts";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiArrowRightSLine, RiFileList3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCard, AdminCardBody, AdminCardHeader, AdminCardTitle } from "@/components/AdminCard";
import { GardenAssessmentsPanel } from "@/components/Garden/GardenAssessmentsPanel";
import { GardenHypercertsPanel } from "@/components/Garden/GardenHypercertsPanel";
import { SectionStateCard } from "./GardenDetailHelpers";

export interface ImpactTabProps {
  garden: { id: string; chainId: number; tokenAddress?: string | null };
  gardenId: string;
  canManage: boolean;
  canReview: boolean;
  /** Whether the viewer may create a hypercert in the Hub, where the empty state points. */
  canCertify?: boolean;
  section: string | undefined;
  selectedItem: string | undefined;
  clearSection: () => void;
  openSection: (tab: GardenDetailTab, section: string, itemId?: string) => void;
  assessments: Array<{ id: string; title?: string; assessmentType?: string; createdAt: number }>;
  fetchingAssessments: boolean;
  assessmentsError: Error | null;
  hypercerts: HypercertRecord[];
  hypercertsLoading: boolean;
  hypercertsError: Error | null;
  domainLabels: string[];
  approvedInLastThirtyDays: number;
}

export function ImpactTab({
  garden,
  gardenId,
  canManage,
  canReview,
  canCertify = false,
  section,
  selectedItem,
  clearSection,
  openSection,
  assessments,
  fetchingAssessments,
  assessmentsError,
  hypercerts,
  hypercertsLoading,
  hypercertsError,
  domainLabels,
  approvedInLastThirtyDays,
}: ImpactTabProps) {
  const { formatMessage, formatDate } = useIntl();

  const recentAssessments = assessments.slice(0, 5);
  const recentHypercerts = hypercerts.slice(0, 8);
  const gardenRouteContext = { gardenId: garden.id };
  // An empty list offers no View All and points to where its items are made (D19).
  const hasHypercerts = hypercerts.length > 0;
  const hasAssessments = assessments.length > 0;
  // A failed read is not an empty list: it says so and counts nothing.
  const assessmentsUnread = Boolean(assessmentsError) && !hasAssessments;
  const hypercertsUnread = Boolean(hypercertsError) && !hasHypercerts;

  return (
    <div className="garden-tab-shell">
      <div className="garden-tab-layout">
        <div className="garden-tab-main">
          {section ? (
            <SectionStateCard
              title={formatMessage({ id: `app.garden.detail.section.${section}.title` })}
              description={formatMessage({
                id: `app.garden.detail.section.${section}.description`,
              })}
              closeLabel={formatMessage({ id: "app.common.close" })}
              onClose={clearSection}
            />
          ) : null}

          {(section === undefined || section === "hypercerts") && (
            <AdminCard density="none" className="flex flex-1 flex-col">
              <AdminCardHeader className="flex-wrap gap-3">
                <div>
                  <AdminCardTitle>
                    {formatMessage({ id: "app.garden.detail.impact.hypercertHighlights" })}
                  </AdminCardTitle>
                  <p className="mt-1 body-sm text-text-sub">
                    {formatMessage({
                      id: "app.garden.detail.impact.hypercertHighlightsDescription",
                    })}
                  </p>
                </div>
                {hasHypercerts ? (
                  <AdminButton size="sm" variant="tonal" asChild>
                    <Link
                      to={adminRoutes.gardenImpact({
                        ...gardenRouteContext,
                        section: "hypercerts",
                      })}
                    >
                      {formatMessage({ id: "app.garden.admin.viewAll" })}
                    </Link>
                  </AdminButton>
                ) : null}
              </AdminCardHeader>
              <AdminCardBody className="flex flex-1 flex-col">
                {hypercertsLoading ? (
                  <div
                    className="grid flex-1 content-start gap-2 xl:grid-cols-2"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="sr-only">
                      {formatMessage({ id: "app.hypercerts.list.title" })}
                    </span>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <div
                        key={index}
                        className="h-14 rounded-lg skeleton-shimmer"
                        style={{ animationDelay: `${index * 0.08}s` }}
                      />
                    ))}
                  </div>
                ) : hypercertsUnread ? (
                  <p className="body-sm text-error-dark" role="alert">
                    {formatMessage({ id: "app.garden.admin.hypercertsFailed" })}
                  </p>
                ) : recentHypercerts.length === 0 ? (
                  <EmptyState
                    icon={<RiFileList3Line className="h-6 w-6" />}
                    title={formatMessage({ id: "app.hypercerts.list.empty.title" })}
                    description={formatMessage({
                      id: "app.garden.detail.impact.noHypercertsHint",
                      defaultMessage: "Hypercerts are created in the Hub from approved work.",
                    })}
                    action={
                      canCertify ? (
                        <AdminButton size="sm" variant="tonal" asChild>
                          <Link to={adminRoutes.hubCertifyCreate(gardenRouteContext)}>
                            {formatMessage({ id: "cockpit.hub.action.createHypercert" })}
                          </Link>
                        </AdminButton>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="grid flex-1 content-start gap-2 xl:grid-cols-2">
                    {recentHypercerts.map((record) => (
                      <AdminCard
                        variant="outlined"
                        key={record.id}
                        className={`flex items-center justify-between px-3 py-2.5 ${
                          selectedItem && record.id === selectedItem
                            ? "ring-1 ring-primary-base"
                            : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p
                            className="truncate text-sm font-medium text-text-strong"
                            title={record.title?.trim() || undefined}
                          >
                            {record.title?.trim() ||
                              formatMessage({ id: "app.hypercerts.list.fallbackTitle" })}
                          </p>
                          <p className="mt-0.5 body-xs text-text-soft">
                            {record.mintedAt
                              ? formatDate(record.mintedAt * 1000, { dateStyle: "medium" })
                              : formatMessage({ id: "app.hypercerts.list.dateUnknown" })}
                          </p>
                        </div>
                        <Link
                          to={adminRoutes.gardenHypercertDetail(record.id, gardenRouteContext)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
                        >
                          {formatMessage({ id: "app.actions.view" })}
                          <RiArrowRightSLine className="h-4 w-4" />
                        </Link>
                      </AdminCard>
                    ))}
                  </div>
                )}
              </AdminCardBody>
            </AdminCard>
          )}

          {section === "assessments" ? (
            <GardenAssessmentsPanel
              assessments={assessments}
              isLoading={fetchingAssessments}
              error={assessmentsError}
              gardenId={gardenId}
              chainId={garden.chainId}
            />
          ) : null}

          {section === "hypercerts" ? (
            <GardenHypercertsPanel
              gardenId={gardenId}
              gardenAddress={garden.id as Address}
              hypercerts={hypercerts}
              isLoading={hypercertsLoading}
              canManage={canManage}
            />
          ) : null}
        </div>

        <aside className="garden-tab-rail">
          <div className="garden-tab-rail-sticky">
            <AdminCard density="none">
              <AdminCardHeader className="flex-wrap gap-3">
                <AdminCardTitle>
                  {formatMessage({ id: "app.garden.admin.recentAssessments" })}
                </AdminCardTitle>
                {hasAssessments ? (
                  <AdminButton size="sm" variant="tonal" asChild>
                    <Link
                      to={adminRoutes.gardenImpact({
                        ...gardenRouteContext,
                        section: "assessments",
                      })}
                    >
                      {formatMessage({ id: "app.garden.admin.viewAll" })}
                    </Link>
                  </AdminButton>
                ) : null}
              </AdminCardHeader>
              <AdminCardBody>
                {fetchingAssessments ? (
                  <div className="space-y-2" role="status" aria-live="polite">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className="h-12 rounded-lg skeleton-shimmer"
                        style={{ animationDelay: `${index * 0.08}s` }}
                      />
                    ))}
                  </div>
                ) : assessmentsUnread ? (
                  <p className="body-sm text-error-dark" role="alert">
                    {formatMessage({ id: "app.garden.admin.assessmentsFailed" })}
                  </p>
                ) : recentAssessments.length === 0 ? (
                  <div className="space-y-2">
                    <p className="body-sm text-text-soft">
                      {formatMessage({ id: "app.garden.admin.noAssessments" })}
                    </p>
                    {canReview ? (
                      <AdminButton size="sm" variant="tonal" asChild>
                        <Link to={adminRoutes.hubAssessCreate(gardenRouteContext)}>
                          {formatMessage({ id: "cockpit.hub.action.createAssessment" })}
                        </Link>
                      </AdminButton>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentAssessments.map((assessment) => (
                      <AdminButton
                        key={assessment.id}
                        type="button"
                        variant="text"
                        size="sm"
                        onClick={() => openSection("impact", "assessments", assessment.id)}
                        className={`group w-full rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2 text-left hover:bg-bg-soft ${
                          selectedItem && assessment.id === selectedItem
                            ? "ring-1 ring-primary-base"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-sm font-medium text-text-strong"
                              title={assessment.title || assessment.assessmentType || undefined}
                            >
                              {assessment.title ||
                                assessment.assessmentType ||
                                formatMessage({ id: "app.garden.admin.assessmentFallback" })}
                            </p>
                            <p className="mt-0.5 body-xs text-text-soft">
                              {formatDate(assessment.createdAt, { dateStyle: "medium" })}
                            </p>
                          </div>
                          <RiArrowRightSLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-disabled transition-colors group-hover:text-text-sub" />
                        </div>
                      </AdminButton>
                    ))}
                  </div>
                )}
              </AdminCardBody>
            </AdminCard>

            <AdminCard density="none">
              <AdminCardHeader>
                <AdminCardTitle>
                  {formatMessage({ id: "app.garden.detail.impactSummary" })}
                </AdminCardTitle>
              </AdminCardHeader>
              <AdminCardBody className="space-y-3">
                <div className="space-y-2">
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.impactSummary.totalAssessments" })}
                    </span>
                    <span className="garden-stat-row-value">
                      {assessmentsUnread ? "—" : assessments.length}
                    </span>
                  </div>
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.impactSummary.totalHypercerts" })}
                    </span>
                    <span className="garden-stat-row-value">
                      {hypercertsUnread ? "—" : hypercerts.length}
                    </span>
                  </div>
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.metric.approvedIn30d" })}
                    </span>
                    <span className="garden-stat-row-value">{approvedInLastThirtyDays}</span>
                  </div>
                </div>
                {domainLabels.length > 0 ? (
                  <div className="border-t border-stroke-soft pt-3">
                    <p className="mb-2 text-xs font-medium text-text-soft">
                      {formatMessage({ id: "app.garden.detail.domains" })}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {domainLabels.map((domainLabel) => (
                        <span
                          key={domainLabel}
                          className="inline-flex items-center rounded-full bg-primary-lighter px-2 py-0.5 text-xs font-medium text-primary-dark"
                        >
                          {domainLabel}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </AdminCardBody>
            </AdminCard>
          </div>
        </aside>
      </div>
    </div>
  );
}
