import type { Address, GardenDetailTab } from "@green-goods/shared";
import { RiArrowRightSLine, RiFileList3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { GardenAssessmentsPanel } from "@/components/Garden/GardenAssessmentsPanel";
import { GardenHypercertsPanel } from "@/components/Garden/GardenHypercertsPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionStateCard } from "./GardenDetailHelpers";
import { SECTION_CARD_MIN_HEIGHT } from "./gardenDetail.constants";

export interface ImpactTabProps {
  garden: { id: string; chainId: number };
  gardenId: string;
  canManage: boolean;
  canReview: boolean;
  section: string | undefined;
  selectedItem: string | undefined;
  clearSection: () => void;
  openSection: (tab: GardenDetailTab, section: string, itemId?: string) => void;
  assessments: Array<{ id: string; title?: string; assessmentType?: string; createdAt: number }>;
  fetchingAssessments: boolean;
  assessmentsError: Error | null;
  hypercerts: Array<{ id: string; title?: string; mintedAt?: number }>;
  hypercertsLoading: boolean;
  domainLabels: string[];
  approvedInLastThirtyDays: number;
}

export function ImpactTab({
  garden,
  gardenId,
  canManage,
  canReview,
  section,
  selectedItem,
  clearSection,
  openSection,
  assessments,
  fetchingAssessments,
  assessmentsError,
  hypercerts,
  hypercertsLoading,
  domainLabels,
  approvedInLastThirtyDays,
}: ImpactTabProps) {
  const { formatMessage, formatDate } = useIntl();

  const recentAssessments = assessments.slice(0, 5);
  const recentHypercerts = hypercerts.slice(0, 4);

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
            <Card className={SECTION_CARD_MIN_HEIGHT}>
              <Card.Header className="flex-wrap gap-3">
                <div>
                  <h3 className="label-md text-text-strong sm:text-lg">
                    {formatMessage({ id: "app.garden.detail.impact.hypercertHighlights" })}
                  </h3>
                  <p className="mt-1 text-sm text-text-sub">
                    {formatMessage({
                      id: "app.garden.detail.impact.hypercertHighlightsDescription",
                    })}
                  </p>
                </div>
                <Button size="sm" variant="secondary" asChild>
                  <Link to={`/gardens/${gardenId}/hypercerts`}>
                    {formatMessage({ id: "app.garden.admin.viewAll" })}
                  </Link>
                </Button>
              </Card.Header>
              <Card.Body>
                {hypercertsLoading ? (
                  <div className="space-y-2" role="status" aria-live="polite">
                    <span className="sr-only">
                      {formatMessage({ id: "app.hypercerts.list.title" })}
                    </span>
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className="h-14 rounded-lg skeleton-shimmer"
                        style={{ animationDelay: `${index * 0.08}s` }}
                      />
                    ))}
                  </div>
                ) : recentHypercerts.length === 0 ? (
                  <EmptyState
                    icon={<RiFileList3Line className="h-6 w-6" />}
                    title={formatMessage({ id: "app.hypercerts.list.empty.title" })}
                  />
                ) : (
                  <div className="space-y-2">
                    {recentHypercerts.map((record) => (
                      <div
                        key={record.id}
                        className={`flex items-center justify-between rounded-lg border border-stroke-soft bg-bg-weak px-3 py-2.5 ${
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
                          <p className="mt-0.5 text-xs text-text-soft">
                            {record.mintedAt
                              ? formatDate(record.mintedAt * 1000, { dateStyle: "medium" })
                              : formatMessage({ id: "app.hypercerts.list.dateUnknown" })}
                          </p>
                        </div>
                        <Link
                          to={`/gardens/${gardenId}/hypercerts/${record.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-base hover:text-primary-darker"
                        >
                          {formatMessage({ id: "app.actions.view" })}
                          <RiArrowRightSLine className="h-4 w-4" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
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
            <Card>
              <Card.Header className="flex-wrap gap-3">
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.admin.recentAssessments" })}
                </h3>
                <Button size="sm" variant="secondary" asChild>
                  <Link to={`/gardens/${gardenId}/assessments`}>
                    {formatMessage({ id: "app.garden.admin.viewAll" })}
                  </Link>
                </Button>
              </Card.Header>
              <Card.Body>
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
                ) : recentAssessments.length === 0 ? (
                  <p className="text-sm text-text-soft">
                    {formatMessage({ id: "app.garden.admin.noAssessments" })}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentAssessments.map((assessment) => (
                      <button
                        key={assessment.id}
                        type="button"
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
                            <p className="mt-0.5 text-xs text-text-soft">
                              {formatDate(assessment.createdAt, { dateStyle: "medium" })}
                            </p>
                          </div>
                          <RiArrowRightSLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-disabled transition-colors group-hover:text-text-sub" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="label-md text-text-strong">
                  {formatMessage({ id: "app.garden.detail.impactSummary" })}
                </h3>
              </Card.Header>
              <Card.Body className="space-y-3">
                <div className="space-y-2">
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.impactSummary.totalAssessments" })}
                    </span>
                    <span className="garden-stat-row-value">{assessments.length}</span>
                  </div>
                  <div className="garden-stat-row">
                    <span className="garden-stat-row-label">
                      {formatMessage({ id: "app.garden.detail.impactSummary.totalHypercerts" })}
                    </span>
                    <span className="garden-stat-row-value">{hypercerts.length}</span>
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
              </Card.Body>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
