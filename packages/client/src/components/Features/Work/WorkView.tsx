import { RiDownloadLine, RiExternalLinkLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { FormCard, FormInfo, GardenCard, GardenCardSkeleton } from "@/components/Cards";
import { Carousel, CarouselContent, CarouselItem, ImageWithFallback } from "@/components/Display";

export type WorkViewAction = {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  visible?: boolean;
  className?: string;
};

type WorkViewProps = {
  title: string;
  info: string;
  garden: Garden;
  actionTitle: string;
  media?: string[];
  details: Array<{ label: string; value: string; icon?: React.ComponentType<any> | null }>;
  headerIcon?: React.ComponentType<any> | null;
  primaryActions?: WorkViewAction[]; // shown near header or under details
  feedbackSection?: React.ReactNode; // optional feedback input section
  footer?: React.ReactNode; // e.g., fixed approval bar
  showMedia?: boolean;
};

export const WorkView: React.FC<WorkViewProps> = ({
  title,
  info,
  garden,
  actionTitle,
  media = [],
  details,
  headerIcon: HeaderIcon,
  primaryActions = [],
  feedbackSection,
  footer,
  showMedia = true,
}) => {
  const intl = useIntl();

  const hasMedia = showMedia && Array.isArray(media) && media.length > 0;
  const visibleActions = primaryActions.filter((a) => a.visible !== false);

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title={title} info={info} Icon={HeaderIcon ?? undefined} />

      <h6>
        {intl.formatMessage({ id: "app.home.workApproval.garden", defaultMessage: "Garden" })}
      </h6>
      <GardenCard
        garden={garden}
        media="small"
        height="default"
        showOperators={true}
        selected={false}
        showDescription={false}
        showBanner={false}
      />

      {hasMedia && (
        <>
          <h6>
            {intl.formatMessage({ id: "app.home.workApproval.media", defaultMessage: "Media" })}
          </h6>
          <Carousel enablePreview previewImages={media}>
            <CarouselContent>
              {media.map((item, index) => (
                <CarouselItem
                  key={item}
                  className="max-w-40 aspect-3/4 rounded-2xl relative overflow-hidden"
                >
                  <ImageWithFallback
                    src={item}
                    alt={`Work media ${index + 1}`}
                    className="w-full h-full aspect-3/4 object-cover rounded-2xl"
                    fallbackClassName="w-full h-full aspect-3/4 rounded-2xl"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </>
      )}

      <h6>
        {intl.formatMessage({ id: "app.home.workApproval.details", defaultMessage: "Details" })}
      </h6>
      <FormCard
        label={intl.formatMessage({ id: "app.home.workApproval.action", defaultMessage: "Action" })}
        value={
          actionTitle ||
          intl.formatMessage({ id: "app.action.selected", defaultMessage: "Selected Action" })
        }
        Icon={RiExternalLinkLine}
      />

      {details
        .filter((d) => d.value && d.value.trim().length > 0)
        .map((d) => (
          <FormCard
            key={d.label}
            label={d.label}
            value={d.value}
            Icon={d.icon ?? RiExternalLinkLine}
          />
        ))}

      {feedbackSection}

      {visibleActions.length > 0 && (
        <>
          <h6 className="text-text-strong-950 mt-2">
            {intl.formatMessage({ id: "app.home.work.actions", defaultMessage: "Actions" })}
          </h6>
          <div className="flex flex-col gap-3">
            {visibleActions.map((a) => {
              // Approval actions get special styling
              const isApprovalAction = a.id === "approve" || a.id === "reject";
              const isReject = a.id === "reject";

              // Use custom styling for utility actions (no variant colors)
              const hasCustomStyling = !!a.className;

              return (
                <Button
                  key={a.id}
                  onClick={a.onClick}
                  label={a.label}
                  className={
                    a.className
                      ? `w-full touch-manipulation ${a.className}`
                      : "w-full touch-manipulation"
                  }
                  variant={hasCustomStyling ? undefined : isReject ? "error" : "primary"}
                  type="button"
                  shape="pilled"
                  mode={hasCustomStyling ? undefined : isApprovalAction ? "filled" : "stroke"}
                  size="medium"
                  leadingIcon={(a.icon as any) ?? <RiDownloadLine className="w-6 h-6" />}
                  disabled={a.disabled}
                />
              );
            })}
          </div>
        </>
      )}

      {footer}
    </div>
  );
};

type WorkViewSkeletonProps = {
  showMedia?: boolean;
  showActions?: boolean;
  numDetails?: number;
};

export const WorkViewSkeleton: React.FC<WorkViewSkeletonProps> = ({
  showMedia = true,
  showActions = false,
  numDetails = 3,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Header info */}
      <div className="bg-slate-100 p-4 rounded-lg animate-pulse h-24" />

      {/* Garden section */}
      <div className="h-4 w-28 bg-slate-200 rounded" />
      <GardenCardSkeleton media="small" height="default" showBanner={false} />

      {/* Media section */}
      {showMedia && (
        <>
          <div className="h-4 w-20 bg-slate-200 rounded" />
          <div className="flex flex-row gap-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`media-skel-${idx}`}
                className="max-w-40 aspect-3/4 rounded-2xl bg-slate-200 animate-pulse w-full"
              />
            ))}
          </div>
        </>
      )}

      {/* Details section */}
      <div className="h-4 w-24 bg-slate-200 rounded" />
      <div className="space-y-2">
        <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        {Array.from({ length: numDetails }).map((_, i) => (
          <div key={`detail-skel-${i}`} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Primary actions */}
      {showActions && (
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-10 flex-1 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-10 flex-1 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      )}
    </div>
  );
};
