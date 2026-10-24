import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import type { Address, Domain } from "@green-goods/shared/types/domain";
import type { GardenDetailTab } from "@green-goods/shared/types/garden-detail";
import type { HypercertRecord } from "@green-goods/shared/types/hypercerts";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { normalizeTimestamp } from "@green-goods/shared/utils/time";
import { RiErrorWarningLine, RiFileList3Line, RiMedalLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link, useNavigate } from "react-router-dom";
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
  assessments: Array<{
    id: string;
    title?: string;
    assessmentType?: string;
    domain?: number;
    createdAt: number;
  }>;
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
  const navigate = useNavigate();

  // An assessment row gives its date, then its domain; an unknown domain stays unlabelled.
  const assessmentDetails = (
    date: string,
    domain: number | undefined
  ): [string] | [string, string] => {
    const config = domain === undefined ? undefined : DOMAIN_CONFIG[domain as Domain];
    return config ? [date, formatMessage({ id: config.labelId })] : [date];
  };
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
            <AdminCard density="none" className="flex flex-col">
              <AdminCardHeader className="flex-wrap gap-3">
                <div>
                  <AdminCardTitle>
                    {formatMessage({ id: "app.garden.detail.impact.hypercertHighlights" })}
                  </AdminCardTitle>
                  <p className="mt-1 type-body text-text-sub">
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
                    className="grid flex-1 content-start gap-(--gg-list-gap) xl:grid-cols-2"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="sr-only">
                      {formatMessage({ id: "app.hypercerts.list.title" })}
                    </span>
                    {[0, 1, 2, 3].map((index) => (
                      <ItemRowSkeleton key={`hypercert-skeleton-${index}`} />
                    ))}
                  </div>
                ) : hypercertsUnread ? (
                  <EmptyState
                    tone="error"
                    icon={<RiErrorWarningLine />}
                    title={formatMessage({ id: "app.garden.admin.hypercertsFailed" })}
                  />
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
                  <ul className="grid flex-1 content-start gap-(--gg-list-gap) xl:grid-cols-2">
                    {recentHypercerts.map((record) => (
                      <li key={record.id} className="min-w-0">
                        <ItemRow
                          lead={{ kind: "icon", icon: <RiMedalLine /> }}
                          title={
                            record.title?.trim() ||
                            formatMessage({ id: "app.hypercerts.list.fallbackTitle" })
                          }
                          details={[
                            record.mintedAt
                              ? formatDate(record.mintedAt * 1000, { dateStyle: "medium" })
                              : formatMessage({ id: "app.hypercerts.list.dateUnknown" }),
                          ]}
                          selected={Boolean(selectedItem) && record.id === selectedItem}
                          onOpen={() =>
                            navigate(
                              adminRoutes.gardenHypercertDetail(record.id, gardenRouteContext)
                            )
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </AdminCardBody>
            </AdminCard>
          )}

          {section === undefined ? (
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
                  <div
                    className="flex flex-col gap-(--gg-list-gap)"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="sr-only">
                      {formatMessage({ id: "app.garden.admin.loadingAssessments" })}
                    </span>
                    {[0, 1, 2].map((index) => (
                      <ItemRowSkeleton key={`assessment-skeleton-${index}`} />
                    ))}
                  </div>
                ) : assessmentsUnread ? (
                  <EmptyState
                    tone="error"
                    icon={<RiErrorWarningLine />}
                    title={formatMessage({ id: "app.garden.admin.assessmentsFailed" })}
                  />
                ) : recentAssessments.length === 0 ? (
                  <EmptyState
                    icon={<RiFileList3Line />}
                    title={formatMessage({ id: "app.garden.admin.noAssessments" })}
                    action={
                      canReview ? (
                        <AdminButton size="sm" variant="tonal" asChild>
                          <Link to={adminRoutes.hubAssessCreate(gardenRouteContext)}>
                            {formatMessage({ id: "cockpit.hub.action.createAssessment" })}
                          </Link>
                        </AdminButton>
                      ) : undefined
                    }
                  />
                ) : (
                  <ul className="flex flex-col gap-(--gg-list-gap)">
                    {recentAssessments.map((assessment) => (
                      <li key={assessment.id}>
                        <ItemRow
                          lead={{ kind: "icon", icon: <RiFileList3Line /> }}
                          title={
                            assessment.title ||
                            assessment.assessmentType ||
                            formatMessage({ id: "app.garden.admin.assessmentFallback" })
                          }
                          details={assessmentDetails(
                            formatDate(normalizeTimestamp(assessment.createdAt), {
                              dateStyle: "medium",
                            }),
                            assessment.domain
                          )}
                          selected={section === "assessments" && assessment.id === selectedItem}
                          onOpen={() => openSection("impact", "assessments", assessment.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </AdminCardBody>
            </AdminCard>
          ) : null}

          {section === "assessments" ? (
            <GardenAssessmentsPanel
              assessments={assessments}
              isLoading={fetchingAssessments}
              error={assessmentsError}
              gardenId={gardenId}
              chainId={garden.chainId}
              selectedItem={selectedItem}
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
                    <p className="mb-2 type-label-sm text-text-soft">
                      {formatMessage({ id: "app.garden.detail.domains" })}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {domainLabels.map((domainLabel) => (
                        <span
                          key={domainLabel}
                          className="inline-flex items-center rounded-full bg-primary-lighter px-2 py-0.5 type-label-sm text-primary-dark"
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
