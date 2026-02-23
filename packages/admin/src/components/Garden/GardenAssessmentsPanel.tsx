import { formatDate } from "@green-goods/shared";
import { RiExternalLinkLine, RiFileList3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const EAS_EXPLORER_URL = "https://explorer.easscan.org";

interface Assessment {
  id: string;
  title?: string;
  assessmentType?: string;
  createdAt: number;
}

interface GardenAssessmentsPanelProps {
  assessments: Assessment[];
  isLoading: boolean;
  error: Error | null | undefined;
  gardenId: string;
}

export const GardenAssessmentsPanel: React.FC<GardenAssessmentsPanelProps> = ({
  assessments,
  isLoading,
  error,
  gardenId,
}) => {
  const { formatMessage } = useIntl();

  return (
    <Card>
      <Card.Header className="gap-2">
        <h3 className="min-w-0 truncate text-base font-medium text-text-strong sm:text-lg">
          {formatMessage({ id: "app.garden.admin.recentAssessments" })}
        </h3>
        <Button variant="secondary" size="sm" asChild>
          <Link
            to={`/gardens/${gardenId}/assessments`}
            aria-label={formatMessage({ id: "app.garden.admin.viewAssessments" })}
          >
            {formatMessage({ id: "app.garden.admin.viewAll" })}
          </Link>
        </Button>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-text-soft">
            {formatMessage({ id: "app.garden.admin.loadingAssessments" })}
          </p>
        ) : error ? (
          <p className="py-4 text-center text-sm text-error-base" role="alert">
            {formatMessage({ id: "app.garden.admin.assessmentsFailed" })}:{" "}
            {error instanceof Error ? error.message : ""}
          </p>
        ) : assessments.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-soft">
            {formatMessage({ id: "app.garden.admin.noAssessments" })}
          </p>
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
                      {assessment.title ||
                        assessment.assessmentType ||
                        formatMessage({ id: "app.garden.admin.assessmentFallback" })}
                    </p>
                    <p className="text-xs text-text-soft">{formatDate(assessment.createdAt)}</p>
                  </div>
                </div>
                <a
                  href={`${EAS_EXPLORER_URL}/attestation/view/${assessment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded text-sm text-primary-dark transition hover:text-primary-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base/40"
                >
                  {formatMessage({ id: "app.actions.view" })}{" "}
                  <RiExternalLinkLine className="ml-1 h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};
