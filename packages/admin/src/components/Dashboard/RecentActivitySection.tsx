import { formatRelativeTime, type EASGardenAssessment, type EASWork, type Garden } from "@green-goods/shared";
import { RiAwardLine, RiCheckDoubleLine, RiFileListLine, RiPlantLine } from "@remixicon/react";
import { type ComponentType, useMemo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type ActivityType = "garden_created" | "work_submitted" | "work_approved" | "assessment_created";

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
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  garden_created: "bg-success-lighter text-success-dark",
  work_submitted: "bg-information-lighter text-information-dark",
  work_approved: "bg-success-lighter text-success-dark",
  assessment_created: "bg-warning-lighter text-warning-dark",
};

interface RecentActivitySectionProps {
  gardens: Garden[];
  works?: EASWork[];
  assessments?: EASGardenAssessment[];
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

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export function RecentActivitySection({
  gardens,
  works,
  assessments,
  maxItems = 8,
  className,
}: RecentActivitySectionProps) {
  const intl = useIntl();

  const activityItems = useMemo(
    () => buildActivityItems(gardens, works, assessments, intl).slice(0, maxItems),
    // intl is stable from react-intl's context; only data deps matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gardens, works, assessments, maxItems]
  );

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
      <Card.Body className="p-0">
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
                defaultMessage: "Activity will appear here as gardens are created and managed.",
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
      </Card.Body>
    </Card>
  );
}
