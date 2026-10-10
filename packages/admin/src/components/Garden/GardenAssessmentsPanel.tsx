import { DomainBadge } from "@green-goods/shared/components/DomainBadge";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { getEASExplorerUrl } from "@green-goods/shared/utils/eas/explorers";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { formatDate } from "@green-goods/shared/utils/time";
import { RiExternalLinkLine, RiFileList3Line } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { AdminCardTitle } from "@/components/AdminCard";
import { AdminCard, AdminCardBody, AdminCardHeader } from "../AdminCard";

interface Assessment {
  id: string;
  title?: string;
  assessmentType?: string;
  domain?: number;
  createdAt: number;
}

interface GardenAssessmentsPanelProps {
  assessments: Assessment[];
  isLoading: boolean;
  error: Error | null | undefined;
  gardenId: string;
  chainId: number;
  /** The assessment the steward opened; its row is ringed and announced as current. */
  selectedItem?: string;
}

export const GardenAssessmentsPanel: React.FC<GardenAssessmentsPanelProps> = ({
  assessments,
  isLoading,
  error,
  gardenId,
  chainId,
  selectedItem,
}) => {
  const { formatMessage } = useIntl();

  return (
    <AdminCard density="none">
      <AdminCardHeader className="gap-2">
        <AdminCardTitle className="min-w-0 truncate">
          {formatMessage({ id: "app.garden.admin.recentAssessments" })}
        </AdminCardTitle>
        <AdminButton variant="outlined" size="sm" asChild>
          <Link
            to={adminRoutes.gardenImpact({ gardenId, section: "assessments" })}
            aria-label={formatMessage({ id: "app.garden.admin.viewAssessments" })}
          >
            {formatMessage({ id: "app.garden.admin.viewAll" })}
          </Link>
        </AdminButton>
      </AdminCardHeader>
      <AdminCardBody>
        {isLoading ? (
          <p className="py-4 text-center body-sm text-text-soft">
            {formatMessage({ id: "app.garden.admin.loadingAssessments" })}
          </p>
        ) : error ? (
          <p className="py-4 text-center body-sm text-error-dark" role="alert">
            {formatMessage({ id: "app.garden.admin.assessmentsFailed" })}:{" "}
            {error instanceof Error ? error.message : ""}
          </p>
        ) : assessments.length === 0 ? (
          <EmptyState
            icon={<RiFileList3Line className="h-6 w-6" />}
            title={formatMessage({ id: "app.garden.admin.noAssessments" })}
          />
        ) : (
          <div className="space-y-3">
            {assessments.map((assessment) => (
              <div
                key={assessment.id}
                aria-current={assessment.id === selectedItem ? "true" : undefined}
                className={`flex items-center justify-between gap-3 rounded-lg bg-bg-weak p-3 ${
                  assessment.id === selectedItem ? "ring-1 ring-primary-base" : ""
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center space-x-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="line-clamp-2 break-words body-sm font-medium text-text-strong"
                      title={assessment.title || assessment.assessmentType || undefined}
                    >
                      {assessment.title ||
                        assessment.assessmentType ||
                        formatMessage({ id: "app.garden.admin.assessmentFallback" })}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {assessment.domain !== undefined ? (
                        <DomainBadge domain={assessment.domain} variant="inline" />
                      ) : null}
                      <span className="body-xs text-text-soft">
                        {formatDate(assessment.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <a
                  href={getEASExplorerUrl(chainId, assessment.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 shrink-0 items-center rounded body-sm text-primary-dark transition hover:text-primary-darker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--primary-base)))]"
                  aria-label={formatMessage({
                    id: "app.admin.assessments.viewOnEas",
                    defaultMessage: "View Assessment on EAS Explorer",
                  })}
                >
                  {formatMessage({ id: "app.actions.view" })}{" "}
                  <RiExternalLinkLine className="ml-1 h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </AdminCardBody>
    </AdminCard>
  );
};
