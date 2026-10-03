import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { RiAttachment2, RiFileFill, RiFileTextFill } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { FormCard } from "@/components/Cards";
import { Carousel, CarouselContent, CarouselItem, ImageWithFallback } from "@/components/Display";

type Resource = NonNullable<AgentReportingCeremony["resource"]>;
type HeadingLevel = "h2" | "h3";

/** Images the session-scoped media route serves as sanitized previews. */
const PREVIEWABLE = /^image\/(jpeg|png|webp)$/;

/**
 * The exact publication as the Agent froze it, drawn as the app reviews a work submission: its
 * photos under Media, in the same carousel and full-screen preview, then its title and every line
 * under Details, one card each. A file without a preview keeps its own card, so nothing that will
 * be published is left off the page.
 */
export function PublicationSummary({
  resource,
  evidenceUrl,
  headingLevel = "h2",
}: {
  resource: Resource;
  /** Story fixtures can provide local media; production uses the session-scoped API. */
  evidenceUrl?: (assetId: string) => string;
  /** `h3` when the summary sits under its own section heading. */
  headingLevel?: HeadingLevel;
}) {
  const intl = useIntl();
  const [previewFailed, setPreviewFailed] = useState(false);
  // Only a draft's evidence has the private media route; a decision publishes none.
  const photos =
    resource.kind === "draft"
      ? resource.evidence.filter((asset) => PREVIEWABLE.test(asset.mime))
      : [];
  const files = resource.evidence.filter((asset) => !photos.includes(asset));
  const urls = photos.map(
    (asset) =>
      evidenceUrl?.(asset.assetId) ?? `/api/messaging/media/${encodeURIComponent(asset.assetId)}`
  );
  const lines = resource.lines.filter((line) => line.value.trim() !== "");
  const attachment = (index: number) =>
    intl.formatMessage(
      { id: "public.reporting.review.attachment", defaultMessage: "Attachment {number}" },
      { number: index + 1 }
    );
  const previewUnavailable = intl.formatMessage({
    id: "public.reporting.review.previewUnavailable",
    defaultMessage: "Preview unavailable. The attachment is still included.",
  });

  return (
    <>
      {photos.length > 0 ? (
        <>
          <SectionHeading as={headingLevel}>
            {intl.formatMessage({ id: "app.home.workApproval.media", defaultMessage: "Media" })}
          </SectionHeading>
          <Carousel enablePreview previewImages={urls}>
            <CarouselContent>
              {photos.map((asset, index) => (
                <CarouselItem
                  key={asset.assetId}
                  index={index}
                  className="max-w-40 aspect-3/4 rounded-2xl relative overflow-hidden"
                >
                  <ImageWithFallback
                    src={urls[index]}
                    alt={attachment(index)}
                    referrerPolicy="no-referrer"
                    className="w-full h-full aspect-3/4 object-cover rounded-2xl"
                    fallbackClassName="w-full h-full aspect-3/4 rounded-2xl"
                    onErrorCallback={() => setPreviewFailed(true)}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          {previewFailed ? (
            <p role="status" className="text-xs text-text-sub-600">
              {previewUnavailable}
            </p>
          ) : null}
        </>
      ) : null}

      <SectionHeading as={headingLevel}>
        {intl.formatMessage({ id: "app.home.workApproval.details", defaultMessage: "Details" })}
      </SectionHeading>
      {resource.title ? (
        <FormCard
          label={intl.formatMessage({
            id: "public.reporting.review.titleLabel",
            defaultMessage: "Title",
          })}
          value={<LineValue>{resource.title}</LineValue>}
          Icon={RiFileTextFill}
        />
      ) : null}
      {lines.map((line) => (
        <FormCard
          key={line.label}
          label={line.label}
          value={<LineValue>{line.value}</LineValue>}
          Icon={RiFileFill}
        />
      ))}
      {files.map((asset) => (
        <FormCard
          key={asset.assetId}
          label={attachment(resource.evidence.indexOf(asset))}
          value={<LineValue>{previewUnavailable}</LineValue>}
          Icon={RiAttachment2}
        />
      ))}
    </>
  );
}

/** Details still being prepared, as the app's work view shows them while they load. */
export function PublicationSkeleton({ headingLevel = "h2" }: { headingLevel?: HeadingLevel }) {
  const intl = useIntl();
  return (
    <>
      <SectionHeading as={headingLevel}>
        {intl.formatMessage({ id: "app.home.workApproval.details", defaultMessage: "Details" })}
      </SectionHeading>
      <div className="space-y-2" aria-hidden="true">
        <div className="h-12 bg-bg-weak-50 rounded-lg animate-pulse" />
        <div className="h-12 bg-bg-weak-50 rounded-lg animate-pulse" />
      </div>
    </>
  );
}

function SectionHeading({ as: Heading, children }: { as: HeadingLevel; children: string }) {
  return <Heading className="text-base font-semibold text-text-strong-950">{children}</Heading>;
}

/**
 * A detail card's value as written: its line breaks kept, a long address or hash wrapped, and
 * held off the card's end edge, which the card itself leaves unpadded.
 */
export function LineValue({ children }: { children: string }) {
  return (
    <span className="block pe-4 whitespace-pre-wrap [overflow-wrap:anywhere]">{children}</span>
  );
}
