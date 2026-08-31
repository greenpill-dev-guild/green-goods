import type {
  AssessmentAttachment,
  CynefinPhase,
  GardenAssessment,
} from "@green-goods/shared/types/domain";
import { DOMAIN_LABEL_IDS } from "@green-goods/shared/utils/garden-detail";
import { formatDateRange } from "@green-goods/shared/utils/time";
import { resolveIPFSUrl } from "@green-goods/shared/modules/data/ipfs/resolve";
import {
  RiCalendarLine,
  RiErrorWarningLine,
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
import { Badge, EmptyState } from "@/components/Communication";
import { Carousel, CarouselContent, CarouselItem } from "@/components/Display";

interface GardenAssessmentsProps {
  assessments: GardenAssessment[];
  assessmentFetchStatus: "pending" | "success" | "error";
  description?: string | null;
}

interface AssessmentListProps {
  assessments: GardenAssessment[];
  assessmentFetchStatus: "pending" | "success" | "error";
}

const CYNEFIN_LABEL_IDS: Record<CynefinPhase, string> = {
  0: "app.garden.assessments.cynefin.clear",
  1: "app.garden.assessments.cynefin.complicated",
  2: "app.garden.assessments.cynefin.complex",
  3: "app.garden.assessments.cynefin.chaotic",
};

const AssessmentCard = memo(function AssessmentCard({
  assessment,
}: {
  assessment: GardenAssessment;
}) {
  const intl = useIntl();
  const reportingPeriod = formatDateRange(
    assessment.reportingPeriod.start,
    assessment.reportingPeriod.end,
    intl.formatMessage({ id: "app.garden.assessments.dateNotSet" })
  );
  const domainLabel = intl.formatMessage({ id: DOMAIN_LABEL_IDS[assessment.domain] });
  const cynefinLabel = intl.formatMessage({ id: CYNEFIN_LABEL_IDS[assessment.cynefinPhase] });
  const outcomesPreview = assessment.smartOutcomes.slice(0, 3);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="truncate text-base font-semibold text-text-strong-950"
            title={assessment.title}
          >
            {assessment.title}
          </h3>
          <p className="text-xs uppercase tracking-wide text-text-sub-600">{domainLabel}</p>
          <p className="mt-2 line-clamp-3 text-sm text-text-sub-600" title={assessment.description}>
            {assessment.description}
          </p>
        </div>
        <Link
          to={`assessments/${assessment.id}`}
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
        <div className="flex flex-col gap-1">
          <Badge leadingIcon={<RiStackLine className="h-4 w-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.cynefinPhase" })}
          </Badge>
          <span className="px-2 text-xs text-text-sub-600">{cynefinLabel}</span>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Badge leadingIcon={<RiPriceTag3Line className="h-4 w-4 text-primary" />} variant="pill">
            {intl.formatMessage({ id: "app.garden.assessments.sdgAlignment" })}
          </Badge>
          <ul className="flex flex-wrap gap-1 px-2">
            {assessment.sdgTargets.map((sdg) => (
              <li key={`${assessment.id}-sdg-${sdg}`}>
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
            {assessment.sdgTargets.length === 0 ? (
              <li className="text-xs text-text-sub-600">
                {intl.formatMessage({ id: "app.garden.assessments.noSdgTargets" })}
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {outcomesPreview.length ? (
        <div className="rounded-md bg-bg-weak-50 p-3 text-xs text-text-sub-600">
          <p className="mb-1 font-medium text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.smartOutcomesPreview" })}
          </p>
          <ul className="space-y-2">
            {outcomesPreview.map((outcome, index) => (
              <li key={`${assessment.id}-outcome-${index}`}>
                <p className="font-medium text-text-strong-950">{outcome.description}</p>
                <p>
                  {intl.formatMessage(
                    { id: "app.garden.assessments.outcomeTarget" },
                    { target: outcome.target, metric: outcome.metric }
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
});

const AssessmentList = ({ assessments, assessmentFetchStatus }: AssessmentListProps) => {
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
      return assessments.length ? (
        <Carousel opts={{ align: "start", loop: false }}>
          <CarouselContent>
            {assessments.map((assessment) => (
              <CarouselItem key={assessment.id}>
                <AssessmentCard assessment={assessment} />
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
          title={intl.formatMessage({ id: "app.garden.assessments.errorLoadingWorks" })}
        />
      );
  }
};

const AttachmentCard = memo(function AttachmentCard({
  attachment,
}: {
  attachment: AssessmentAttachment;
}) {
  const intl = useIntl();

  return (
    <Card className="flex min-h-[160px] flex-col gap-3">
      <div className="flex items-center gap-2 text-primary">
        <RiFileTextLine className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
        <h3 className="truncate text-base font-semibold text-text-strong-950">{attachment.name}</h3>
      </div>
      <p className="text-sm text-text-sub-600">{attachment.mimeType}</p>
      <a
        href={resolveIPFSUrl(attachment.cid)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <RiExternalLinkLine className="h-4 w-4" aria-hidden="true" />
        {intl.formatMessage({ id: "app.actions.viewDocument" })}
      </a>
    </Card>
  );
});

export const GardenAssessments = forwardRef<HTMLDivElement, GardenAssessmentsProps>(
  ({ assessments, assessmentFetchStatus, description }, ref) => {
    const intl = useIntl();
    const hasDescription = Boolean(description && description.trim().length > 0);
    const allAttachments = assessments.flatMap((assessment) =>
      assessment.attachments.map((attachment) => ({ assessmentId: assessment.id, attachment }))
    );

    return (
      <div className="flex flex-col gap-6" ref={ref}>
        {hasDescription && (
          <section>
            <Card className="p-0">
              <div className="flex w-full flex-col gap-2">
                <div className="flex w-full flex-row border-b border-stroke-soft-200 p-3">
                  <RiInformationLine size={24} className="text-primary" aria-hidden="true" />
                  <h2 className="px-2 font-medium text-text-strong-950">
                    {intl.formatMessage({ id: "app.garden.description.label" })}
                  </h2>
                </div>
                <div className="items-start justify-start pb-3 pl-4 pt-1 text-left text-label-sm">
                  <p className="whitespace-pre-line leading-relaxed text-text-sub-600">
                    {description}
                  </p>
                </div>
              </div>
            </Card>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({ id: "app.garden.assessments.listTitle" })}
          </h2>
          <AssessmentList assessments={assessments} assessmentFetchStatus={assessmentFetchStatus} />
        </section>

        {allAttachments.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-text-strong-950">
              {intl.formatMessage({ id: "app.garden.assessments.attachments" })}
            </h2>
            <Carousel opts={{ align: "start", loop: false }}>
              <CarouselContent>
                {allAttachments.map(({ assessmentId, attachment }) => (
                  <CarouselItem key={`${assessmentId}-${attachment.cid}`}>
                    <AttachmentCard attachment={attachment} />
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
