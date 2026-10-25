import { Button } from "@green-goods/shared/components/Button";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import type { Domain } from "@green-goods/shared/types/domain";
import { getEASExplorerUrl } from "@green-goods/shared/utils/eas/explorers";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { formatDate } from "@green-goods/shared/utils/time";
import {
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiLoader4Line,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
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

/** An assessment's domain label, or none for a domain the cockpit does not know. */
function domainOf(domain: number | undefined): string | undefined {
  return domain === undefined ? undefined : DOMAIN_CONFIG[domain as Domain]?.labelId;
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
        <Button emphasis="secondary" size="compact" asChild>
          <Link
            to={adminRoutes.gardenImpact({ gardenId, section: "assessments" })}
            aria-label={formatMessage({ id: "app.garden.admin.viewAssessments" })}
          >
            {formatMessage({ id: "app.garden.admin.viewAll" })}
          </Link>
        </Button>
      </AdminCardHeader>
      <AdminCardBody>
        {isLoading ? (
          <EmptyState
            busy
            icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
            title={formatMessage({ id: "app.garden.admin.loadingAssessments" })}
          />
        ) : error ? (
          <EmptyState
            tone="error"
            icon={<RiErrorWarningLine />}
            title={formatMessage({ id: "app.garden.admin.assessmentsFailed" })}
            description={error instanceof Error ? error.message : undefined}
          />
        ) : assessments.length === 0 ? (
          <EmptyState
            icon={<RiFileList3Line className="h-6 w-6" />}
            title={formatMessage({ id: "app.garden.admin.noAssessments" })}
          />
        ) : (
          <ul className="flex flex-col gap-(--gg-list-gap)">
            {assessments.map((assessment) => {
              const open = assessment.id === selectedItem;
              const date = formatDate(assessment.createdAt);
              const domainLabelId = domainOf(assessment.domain);
              return (
                <li key={assessment.id}>
                  <ItemRow
                    lead={{ kind: "icon", icon: <RiFileList3Line /> }}
                    title={
                      assessment.title ||
                      assessment.assessmentType ||
                      formatMessage({ id: "app.garden.admin.assessmentFallback" })
                    }
                    details={domainLabelId ? [date, formatMessage({ id: domainLabelId })] : [date]}
                    selected={open}
                    aria-current={open ? "true" : undefined}
                    action={
                      <Button emphasis="tertiary" size="compact" asChild>
                        <a
                          href={getEASExplorerUrl(chainId, assessment.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={formatMessage({
                            id: "app.admin.assessments.viewOnEas",
                            defaultMessage: "View Assessment on EAS Explorer",
                          })}
                        >
                          {formatMessage({ id: "app.actions.view" })}
                          <RiExternalLinkLine className="h-4 w-4" aria-hidden="true" />
                        </a>
                      </Button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </AdminCardBody>
    </AdminCard>
  );
};
