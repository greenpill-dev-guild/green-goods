import { ItemRow, ItemRowSkeleton } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import type { GardenAssessmentRecord } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";
import type { Domain } from "@green-goods/shared/types/domain";
import { formatReportingPeriod } from "@green-goods/shared/utils/time";
import { RiErrorWarningLine, RiFileList3Line, RiFileTextLine } from "@remixicon/react";
import { forwardRef, memo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

interface GardenAssessmentsProps {
  /**
   * The garden's id as its route names it. A row opens the assessment's page under the garden's
   * own path, so it lands there from the garden's page and from the Insights sheet over Home,
   * which is not a garden route (DL-128).
   */
  gardenId: string;
  records: GardenAssessmentRecord[];
  assessmentFetchStatus: "pending" | "success" | "error";
  description?: string | null;
}

interface AssessmentListProps {
  gardenId: string;
  records: GardenAssessmentRecord[];
  assessmentFetchStatus: "pending" | "success" | "error";
}

/**
 * One assessment, the shared item row (step 16): the record's icon, its title, its
 * reporting period, then its domain (an unknown one stays unlabelled). The row opens the
 * assessment's page, which holds the outcomes and the rest.
 */
const AssessmentRow = memo(function AssessmentRow({
  gardenId,
  record,
}: {
  gardenId: string;
  record: GardenAssessmentRecord;
}) {
  const intl = useIntl();
  const navigate = useNavigate();
  const { summary } = record;
  const reportingPeriod =
    formatReportingPeriod(intl, summary.startDate, summary.endDate) ??
    intl.formatMessage({ id: "app.garden.assessments.dateNotSet" });
  const domain = DOMAIN_CONFIG[summary.domain as Domain];

  return (
    <ItemRow
      lead={{ kind: "icon", icon: <RiFileList3Line /> }}
      title={summary.title}
      details={
        domain ? [reportingPeriod, intl.formatMessage({ id: domain.labelId })] : [reportingPeriod]
      }
      onOpen={() =>
        navigate(`/home/${gardenId}/assessments/${summary.id}`, { viewTransition: true })
      }
    />
  );
});

const AssessmentList = ({ gardenId, records, assessmentFetchStatus }: AssessmentListProps) => {
  const intl = useIntl();
  switch (assessmentFetchStatus) {
    case "pending":
      return (
        <div className="flex flex-col gap-(--gg-list-gap)" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <ItemRowSkeleton key={`assessment-skeleton-${index}`} lead="icon" />
          ))}
        </div>
      );
    case "success":
      return records.length ? (
        <ul className="flex flex-col gap-(--gg-list-gap)">
          {records.map((record) => (
            <li key={record.summary.id}>
              <AssessmentRow gardenId={gardenId} record={record} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<RiFileTextLine />}
          title={intl.formatMessage({ id: "app.garden.assessments.noAssesment" })}
        />
      );
    case "error":
      return (
        <EmptyState
          tone="error"
          icon={<RiErrorWarningLine />}
          title={intl.formatMessage({ id: "app.garden.assessments.loadError.title" })}
          description={intl.formatMessage({ id: "app.garden.assessments.loadError.description" })}
        />
      );
  }
};

export const GardenAssessments = forwardRef<HTMLDivElement, GardenAssessmentsProps>(
  ({ gardenId, records, assessmentFetchStatus, description }, ref) => {
    const intl = useIntl();
    const hasDescription = Boolean(description && description.trim().length > 0);

    return (
      <div className="flex flex-col gap-6" ref={ref}>
        {hasDescription && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-text-strong-950">
              {intl.formatMessage({ id: "app.garden.description.label" })}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-sub-600">
              {description}
            </p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.listTitle" })}
          </h2>
          <AssessmentList
            gardenId={gardenId}
            records={records}
            assessmentFetchStatus={assessmentFetchStatus}
          />
        </section>
      </div>
    );
  }
);
