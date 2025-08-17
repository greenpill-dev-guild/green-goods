import { RiDownloadLine, RiExternalLinkLine } from "@remixicon/react";
import React from "react";
import { GardenCardSkeleton } from "@/components/UI/Card/GardenCardSkeleton";
import { useIntl } from "react-intl";
import { GardenCard } from "@/components/UI/Card/GardenCard";
import { Carousel, CarouselContent, CarouselItem } from "@/components/UI/Carousel/Carousel";
import { FormCard } from "@/components/UI/Form/Card";
import { FormInfo } from "@/components/UI/Form/Info";
import { Button } from "@/components/UI/Button";

export type WorkViewAction = {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  visible?: boolean;
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
              {media.map((item) => (
                <CarouselItem key={item} className="max-w-40 aspect-3/4 rounded-2xl">
                  <img
                    src={item}
                    alt={item}
                    className="w-full h-full aspect-3/4 object-cover rounded-2xl"
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

      {visibleActions.length > 0 && (
        <div className="flex flex-row gap-3">
          {visibleActions.map((a) => (
            <Button
              key={a.id}
              onClick={a.onClick}
              label={a.label}
              className="flex-1"
              variant="neutral"
              type="button"
              shape="pilled"
              mode="stroke"
              leadingIcon={(a.icon as any) ?? <RiDownloadLine className="w-5 h-5" />}
              disabled={a.disabled}
            />
          ))}
        </div>
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
