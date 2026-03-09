import {
  formatRelativeTime,
  type EASGardenAssessment,
  type EASWork,
  type EASWorkApproval,
  type Garden,
} from "@green-goods/shared";
import {
  RiAwardLine,
  RiCheckDoubleLine,
  RiFileListLine,
  RiPlantLine,
  RiUserAddLine,
} from "@remixicon/react";
import { type ComponentType, useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type ActivityType =
  | "garden_created"
  | "work_submitted"
  | "work_approved"
  | "assessment_created"
  | "gardener_added";

interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  gardenId?: string;
  timestamp: number;
}

const ACTIVITY_ICONS: Record<ActivityType, ComponentType<{ className?: string }>> = {
  garden_created: RiPlantLine,
  work_submitted: RiFileListLine,
  work_approved: RiCheckDoubleLine,
  assessment_created: RiAwardLine,
  gardener_added: RiUserAddLine,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  garden_created: "bg-success-lighter text-success-dark",
  work_submitted: "bg-information-lighter text-information-dark",
  work_approved: "bg-success-lighter text-success-dark",
  assessment_created: "bg-warning-lighter text-warning-dark",
  gardener_added: "bg-information-lighter text-information-dark",
};

interface RecentActivitySectionProps {
  gardens: Garden[];
  works?: EASWork[];
  assessments?: EASGardenAssessment[];
  workApprovals?: EASWorkApproval[];
  maxItems?: number;
  className?: string;
}

/**
 * Builds a real activity timeline from gardens, works, and assessments.
 * Falls back to garden-only activity when works/assessments aren't loaded yet.
 */
function buildActivityItems(
  gardens: Garden[],
  works: EASWork[] | undefined,
  assessments: EASGardenAssessment[] | undefined,
  workApprovals: EASWorkApproval[] | undefined,
  intl: ReturnType<typeof useIntl>
): ActivityItem[] {
  // Build garden address → name lookup
  const gardenNameMap = new Map<string, { name: string; id: string }>();
  for (const g of gardens) {
    gardenNameMap.set(g.id.toLowerCase(), { name: g.name, id: g.id });
  }

  const items: ActivityItem[] = [];

  // Garden creation events
  for (const garden of gardens) {
    if (garden.createdAt > 0) {
      items.push({
        id: `created-${garden.id}`,
        type: "garden_created",
        description: intl.formatMessage(
          { id: "admin.dashboard.activity.gardenCreated", defaultMessage: "{name} was created" },
          { name: garden.name }
        ),
        gardenId: garden.id,
        timestamp: garden.createdAt,
      });
    }
  }

  // Work submission events
  if (works) {
    for (const work of works) {
      const garden = gardenNameMap.get(work.gardenAddress.toLowerCase());
      const gardenName = garden?.name ?? work.gardenAddress.slice(0, 8) + "…";
      items.push({
        id: `work-${work.id}`,
        type: "work_submitted",
        description: intl.formatMessage(
          {
            id: "admin.dashboard.activity.workSubmitted",
            defaultMessage: "{title} submitted to {garden}",
          },
          { title: work.title, garden: gardenName }
        ),
        gardenId: garden?.id,
        timestamp: work.createdAt,
      });
    }
  }

  // Assessment events
  if (assessments) {
    for (const assessment of assessments) {
      const garden = gardenNameMap.get(assessment.gardenAddress.toLowerCase());
      const gardenName = garden?.name ?? assessment.gardenAddress.slice(0, 8) + "…";
      items.push({
        id: `assessment-${assessment.id}`,
        type: "assessment_created",
        description: intl.formatMessage(
          {
            id: "admin.dashboard.activity.assessmentCreated",
            defaultMessage: "Assessment created for {garden}",
          },
          { garden: gardenName }
        ),
        gardenId: garden?.id,
        timestamp: assessment.createdAt,
      });
    }
  }

  // Work approval events
  if (workApprovals) {
    for (const approval of workApprovals) {
      const status = approval.approved
        ? intl.formatMessage({
            id: "admin.dashboard.activity.approved",
            defaultMessage: "approved",
          })
        : intl.formatMessage({
            id: "admin.dashboard.activity.rejected",
            defaultMessage: "rejected",
          });
      items.push({
        id: `approval-${approval.id}`,
        type: "work_approved",
        description: intl.formatMessage(
          {
            id: "admin.dashboard.activity.workApproved",
            defaultMessage: "Work {status} by {operator}",
          },
          {
            status,
            operator:
              approval.operatorAddress.slice(0, 6) + "…" + approval.operatorAddress.slice(-4),
          }
        ),
        timestamp: approval.createdAt,
      });
    }
  }

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export function RecentActivitySection({
  gardens,
  works,
  assessments,
  workApprovals,
  maxItems = 10,
  className,
}: RecentActivitySectionProps) {
  const intl = useIntl();

  const activityItems = useMemo(
    () => buildActivityItems(gardens, works, assessments, workApprovals, intl).slice(0, maxItems),
    // intl is stable from react-intl's context; only data deps matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gardens, works, assessments, workApprovals, maxItems]
  );

  // Detect when gardens exist but no EAS data has been created yet
  const hasGardens = gardens.length > 0;
  const hasEASData = (works?.length ?? 0) > 0 || (assessments?.length ?? 0) > 0 || (workApprovals?.length ?? 0) > 0;
  const gardenOnlyActivity = hasGardens && !hasEASData && activityItems.length > 0;

  return (
    <Card className={className}>
      <Card.Header>
        <h2 className="text-base font-semibold text-text-strong">
          {intl.formatMessage({
            id: "admin.dashboard.recentActivity",
            defaultMessage: "Recent Activity",
          })}
        </h2>
      </Card.Header>
      <Card.Body className="p-0 max-h-[480px] overflow-y-auto">
        {activityItems.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState
              icon={<RiPlantLine className="h-6 w-6" />}
              title={intl.formatMessage({
                id: "admin.dashboard.noActivity",
                defaultMessage: "No recent activity",
              })}
              description={intl.formatMessage({
                id: "admin.dashboard.noActivity.description",
                defaultMessage:
                  "This feed tracks garden creation, work submissions, approvals, and assessments. Activity will appear as gardeners begin documenting their work on-chain.",
              })}
            />
          </div>
        ) : (
          <div className="divide-y divide-stroke-soft">
            {activityItems.map((item) => {
              const Icon = ACTIVITY_ICONS[item.type];
              const content = (
                <div className="flex items-start gap-3 px-4 py-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${ACTIVITY_COLORS[item.type]}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-strong">{item.description}</p>
                    <p className="text-xs text-text-soft">{formatRelativeTime(item.timestamp)}</p>
                  </div>
                </div>
              );

              // Link activity items to their garden detail page when possible
              if (item.gardenId) {
                return (
                  <Link
                    key={item.id}
                    to={`/gardens/${item.gardenId}`}
                    className="block hover:bg-bg-weak transition-colors"
                  >
                    {content}
                  </Link>
                );
              }

              return <div key={item.id}>{content}</div>;
            })}
          </div>
        )}
        {gardenOnlyActivity && (
          <div className="px-4 py-3 border-t border-stroke-soft">
            <p className="text-xs text-text-soft text-center">
              {intl.formatMessage({
                id: "admin.dashboard.activity.gardenOnlyHint",
                defaultMessage:
                  "Only garden creation events so far. Work submissions, approvals, and assessments will appear as gardeners document their work.",
              })}
            </p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
