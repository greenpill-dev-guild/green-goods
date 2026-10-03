import type { GardenAssessmentRecord } from "@green-goods/shared/hooks/assessment/useGardenAssessmentRecords";
import { formatReportingPeriod } from "@green-goods/shared/utils/time";
import {
  RiCalendarLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileTextLine,
  RiPriceTag3Line,
  RiStackLine,
} from "@remixicon/react";
import { forwardRef, memo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Card } from "@/components/Cards";
import { Badge, EmptyState } from "@/components/Communication";
import { Carousel, CarouselContent, CarouselItem } from "@/components/Display";
import { CYNEFIN_LABEL_IDS, domainLabelId, outcomeMeasure } from "./assessmentDisplay";

interface GardenAssessmentsProps {
  records: GardenAssessmentRecord[];
  assessmentFetchStatus: "pending" | "success" | "error";
  description?: string | null;
}

interface AssessmentListProps {
  records: GardenAssessmentRecord[];
  assessmentFetchStatus: "pending" | "success" | "error";
}

const AssessmentCard = memo(function AssessmentCard({
  record,
}: {
  record: GardenAssessmentRecord;
}) {
  const intl = useIntl();
  const { summary, detail } = record;
  const reportingPeriod =
    formatReportingPeriod(intl, summary.startDate, summary.endDate) ??
    intl.formatMessage({ id: "app.garden.assessments.dateNotSet" });
  const domainId = domainLabelId(summary.domain);
  const kernel = detail.status === "loaded" ? detail.value : null;
  const outcomesPreview = kernel?.smartOutcomes.slice(0, 3) ?? [];

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="truncate text-base font-semibold text-text-strong-950"
            title={summary.title}
          >
            {summary.title}
          </h3>
          {domainId ? (
            <p className="text-xs uppercase tracking-wide text-text-sub-600">
              {intl.formatMessage({ id: domainId })}
            </p>
          ) : null}
          <p className="mt-2 line-clamp-3 text-sm text-text-sub-600" title={summary.description}>
            {summary.description}
          </p>
        </div>
        <Link
          to={`assessments/${summary.id}`}
          viewTransition
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-stroke-soft-200 px-2 py-1 text-xs font-medium text-text-sub-600 transition hover:bg-bg-weak-50"
        >
          <RiExternalLinkLine className="h-3.5 w-3.5" aria-hidden="true" />
          {intl.formatMessage({ id: "app.actions.view" })}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Badge leadingIcon={<RiCalendarLine className="h-4 w-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.dateRange" })}
          </Badge>
          <span className="px-2 text-xs text-text-sub-600">{reportingPeriod}</span>
        </div>
        {kernel && kernel.cynefinPhase !== null ? (
          <div className="flex flex-col gap-1">
            <Badge leadingIcon={<RiStackLine className="h-4 w-4 text-primary" />} variant="pill">
              {intl.formatMessage({ id: "app.garden.assessments.cynefinPhase" })}
            </Badge>
            <span className="px-2 text-xs text-text-sub-600">
              {intl.formatMessage({ id: CYNEFIN_LABEL_IDS[kernel.cynefinPhase] })}
            </span>
          </div>
        ) : null}
        {kernel ? (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Badge
              leadingIcon={<RiPriceTag3Line className="h-4 w-4 text-primary" />}
              variant="pill"
            >
              {intl.formatMessage({ id: "app.garden.assessments.sdgAlignment" })}
            </Badge>
            <ul className="flex flex-wrap gap-1 px-2">
              {kernel.sdgTargets.map((sdg) => (
                <li key={`${summary.id}-sdg-${sdg}`}>
                  <Badge variant="pill" tint="primary">
                    {intl.formatMessage(
                      { id: "app.garden.assessments.sdgItem" },
                      {
                        number: sdg,
                        label: intl.formatMessage({ id: `app.hypercerts.sdg.${sdg}` }),
                      }
                    )}
                  </Badge>
                </li>
              ))}
              {kernel.sdgTargets.length === 0 ? (
                <li className="text-xs text-text-sub-600">
                  {intl.formatMessage({ id: "app.garden.assessments.noSdgTargets" })}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      {detail.status === "pending" ? (
        <div className="space-y-2 rounded-md bg-bg-weak-50 p-3" aria-hidden="true">
          <div className="h-3 w-24 animate-pulse rounded bg-bg-soft-200" />
          <div className="h-3 w-full animate-pulse rounded bg-bg-soft-200" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-bg-soft-200" />
        </div>
      ) : null}

      {/* The stored files could not be read. That is not an assessment with nothing recorded. */}
      {detail.status === "unavailable" ? (
        <p className="flex items-center gap-1.5 text-xs text-text-sub-600">
          <RiErrorWarningLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {intl.formatMessage({ id: "app.garden.assessments.detailUnavailableShort" })}
        </p>
      ) : null}

      {outcomesPreview.length ? (
        <div className="rounded-md bg-bg-weak-50 p-3 text-xs text-text-sub-600">
          <p className="mb-1 font-medium text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.smartOutcomesPreview" })}
          </p>
          <ul className="space-y-2">
            {outcomesPreview.map((outcome, index) => (
              <li key={`${summary.id}-outcome-${index}`}>
                <p
                  className="line-clamp-2 font-medium text-text-strong-950"
                  title={outcome.description}
                >
                  {outcome.description}
                </p>
                <p>{outcomeMeasure(intl, summary.domain, outcome)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
});

const AssessmentList = ({ records, assessmentFetchStatus }: AssessmentListProps) => {
  const intl = useIntl();
  switch (assessmentFetchStatus) {
    case "pending":
      return (
        <Carousel opts={{ align: "start", loop: false }}>
          <CarouselContent>
            {[...Array(3)].map((_, i) => (
              <CarouselItem key={i}>
                <div className="rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4">
                  <div className="mb-3 h-4 w-24 animate-pulse rounded bg-bg-soft-200" />
                  <div className="mb-2 flex flex-wrap gap-2">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="h-6 w-16 animate-pulse rounded-full bg-bg-soft-200" />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[...Array(4)].map((_, k) => (
                      <div key={k} className="flex flex-col gap-2">
                        <div className="h-5 w-28 animate-pulse rounded bg-bg-soft-200" />
                        <div className="h-4 w-20 animate-pulse rounded bg-bg-soft-200" />
                      </div>
                    ))}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      );
    case "success":
      return records.length ? (
        <Carousel opts={{ align: "start", loop: false }}>
          <CarouselContent>
            {records.map((record) => (
              <CarouselItem key={record.summary.id}>
                <AssessmentCard record={record} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
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
          title={intl.formatMessage({ id: "app.garden.assessments.loadError" })}
        />
      );
  }
};

export const GardenAssessments = forwardRef<HTMLDivElement, GardenAssessmentsProps>(
  ({ records, assessmentFetchStatus, description }, ref) => {
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
          <AssessmentList records={records} assessmentFetchStatus={assessmentFetchStatus} />
        </section>
      </div>
    );
  }
);
