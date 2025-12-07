import { getTag } from "@green-goods/shared/utils";
import {
  RiCalendarLine,
  RiExternalLinkLine,
  RiFileTextLine,
  RiInformationLine,
  RiPriceTag3Line,
  RiStackLine,
} from "@remixicon/react";
import { forwardRef, memo } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Card } from "@/components/Cards";
import { Badge } from "@/components/Communication";
import { Carousel, CarouselContent, CarouselItem } from "@/components/Display";

interface GardenAssessmentsProps {
  assessments: GardenAssessment[];
  asessmentFetchStatus: "pending" | "success" | "error";
  description?: string | null;
}

interface AssessmentListProps {
  assessments: GardenAssessment[];
  asessmentFetchStatus: "pending" | "success" | "error";
}

const AssessmentCard = memo(function AssessmentCard({
  assessment,
}: {
  assessment: GardenAssessment;
}) {
  const intl = useIntl();
  const startDate = assessment.startDate
    ? new Date(
        (assessment.startDate ?? 0) > 10_000_000_000
          ? (assessment.startDate ?? 0)
          : (assessment.startDate ?? 0) * 1000
      ).toLocaleDateString()
    : null;
  const endDate = assessment.endDate
    ? new Date(
        (assessment.endDate ?? 0) > 10_000_000_000
          ? (assessment.endDate ?? 0)
          : (assessment.endDate ?? 0) * 1000
      ).toLocaleDateString()
    : null;

  const metricsPreview =
    assessment.metrics && typeof assessment.metrics === "object"
      ? Object.entries(assessment.metrics).slice(0, 3)
      : [];

  return (
    <Card key={assessment.id} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h6 className="truncate text-base font-semibold text-slate-900">{assessment.title}</h6>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {assessment.assessmentType ||
              intl.formatMessage({ id: "app.garden.assessments.title" })}
          </p>
          <p className="mt-2 line-clamp-3 text-sm text-slate-600">{assessment.description}</p>
        </div>
        <Link
          to={`assessments/${assessment.id}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <RiExternalLinkLine className="h-3.5 w-3.5" />
          {intl.formatMessage({ id: "app.actions.view" })}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Badge leadingIcon={<RiCalendarLine className="h-4 w-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.dateRange" })}
          </Badge>
          <span className="px-2 text-xs text-slate-600">
            {startDate || endDate ? [startDate, endDate].filter(Boolean).join(" — ") : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Badge leadingIcon={<RiStackLine className="h-4 w-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.capitals" })}
          </Badge>
          <div className="flex flex-wrap gap-1 px-2">
            {assessment.capitals.length
              ? assessment.capitals.map((capital) => (
                  <Badge key={`${assessment.id}-${capital}`} variant="pill" tint="tertiary">
                    {capital}
                  </Badge>
                ))
              : intl.formatMessage({ id: "app.status.notAvailable" })}
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Badge leadingIcon={<RiPriceTag3Line className="h-4 w-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.tags" })}
          </Badge>
          <div className="flex flex-wrap gap-1 px-2">
            {assessment.tags.length
              ? assessment.tags.map((tag) => (
                  <Badge variant="pill" key={`${assessment.id}-${tag}`} tint="primary">
                    {getTag(intl, tag)}
                  </Badge>
                ))
              : intl.formatMessage({ id: "app.status.notAvailable" })}
          </div>
        </div>
      </div>

      {metricsPreview.length ? (
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-1 font-medium text-slate-700">
            {intl.formatMessage({ id: "app.garden.assessments.metricsPreview" })}
          </p>
          <ul className="space-y-1">
            {metricsPreview.map(([key, value]) => (
              <li key={`${assessment.id}-${key}`}>
                <span className="font-medium">{key}:</span>{" "}
                <span className="break-all">{formatMetricValue(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
});

const AssessmentList = ({ assessments, asessmentFetchStatus }: AssessmentListProps) => {
  const intl = useIntl();
  switch (asessmentFetchStatus) {
    case "pending":
      return (
        <Carousel opts={{ align: "start", loop: false }}>
          <CarouselContent>
            {[...Array(3)].map((_, i) => (
              <CarouselItem key={i}>
                <div className="p-4 border border-slate-200 rounded-xl bg-white">
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" />
                  <div className="flex flex-wrap gap-2 mb-2">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="h-6 w-16 bg-slate-200 rounded-full animate-pulse" />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {[...Array(4)].map((_, k) => (
                      <div key={k} className="flex flex-col gap-2">
                        <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
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
      return assessments.length ? (
        <Carousel opts={{ align: "start", loop: false }}>
          <CarouselContent>
            {assessments.map((a) => (
              <CarouselItem key={a.id}>
                <AssessmentCard assessment={a} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      ) : (
        <p className="grid p-8 place-items-center text-sm text-center italic text-gray-400">
          {intl.formatMessage({
            id: "app.garden.assessments.noAssesment",
            description: "No assessments yet",
          })}
        </p>
      );
    case "error":
      return (
        <p className="grid place-items-center text-sm italic">
          {intl.formatMessage({
            id: "app.garden.assessments.errorLoadingWorks",
            description: "Error loading works",
          })}
        </p>
      );
  }
};

const ReportCard = memo(function ReportCard({ report, index }: { report: string; index: number }) {
  const intl = useIntl();
  const fileName = report.split("/").pop() || `Report ${index + 1}`;

  return (
    <Card className="flex flex-col gap-3 min-h-[160px]">
      <div className="flex items-center gap-2 text-primary">
        <RiFileTextLine className="h-6 w-6 flex-shrink-0" />
        <h6 className="truncate text-base font-semibold text-slate-900">
          {intl.formatMessage(
            { id: "app.garden.reports.document", defaultMessage: "Report Document {num}" },
            { num: index + 1 }
          )}
        </h6>
      </div>
      <p className="text-sm text-slate-600 line-clamp-2 break-all">{fileName}</p>
      <a
        href={report}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <RiExternalLinkLine className="h-4 w-4" />
        {intl.formatMessage({ id: "app.actions.viewDocument", defaultMessage: "View Document" })}
      </a>
    </Card>
  );
});

export const GardenAssessments = forwardRef<HTMLDivElement, GardenAssessmentsProps>(
  ({ assessments, asessmentFetchStatus, description }, ref) => {
    const intl = useIntl();
    const hasDescription = Boolean(description && description.trim().length > 0);

    const assessmentsTitle = intl.formatMessage({
      id: "app.garden.assessments.listTitle",
      defaultMessage: "Impact Assessments",
    });
    const reportsTitle = intl.formatMessage({
      id: "app.garden.reports.title",
      defaultMessage: "Garden Reports",
    });

    // Collect all report documents from all assessments
    const allReports = assessments.flatMap((a) => a.reportDocuments);

    return (
      <div className="flex flex-col gap-6" ref={ref}>
        {hasDescription && (
          <section>
            <Card className="p-0">
              <div className="flex flex-col gap-2 w-full">
                <div className="flex flex-row p-3 border-b border-stroke-soft-200 w-full">
                  <RiInformationLine size={24} className="text-primary" />
                  <div className="px-2 font-medium text-slate-800">
                    {intl.formatMessage({
                      id: "app.garden.description.label",
                      defaultMessage: "Garden Description",
                    })}
                  </div>
                </div>
                <div className="pb-3 pl-4 pt-1 text-label-sm items-start text-left justify-start">
                  <p className="whitespace-pre-line text-slate-600 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            </Card>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{assessmentsTitle}</h2>
          <AssessmentList assessments={assessments} asessmentFetchStatus={asessmentFetchStatus} />
        </section>

        {allReports.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">{reportsTitle}</h2>
            <Carousel opts={{ align: "start", loop: false }}>
              <CarouselContent>
                {allReports.map((report, index) => (
                  <CarouselItem key={`${report}-${index}`}>
                    <ReportCard report={report} index={index} />
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </section>
        )}
      </div>
    );
  }
);

function formatMetricValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}
