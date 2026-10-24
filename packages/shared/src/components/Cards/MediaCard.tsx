import * as React from "react";
import type { ReactNode } from "react";
import { tv } from "tailwind-variants";
import { cn } from "../../utils/styles/cn";

/**
 * Where a media card puts its picture: above the text (`stacked`, a phone or a
 * narrow column), or in a 144px column on the left with the text centered beside
 * it (`wide`, a desktop list). The consumer chooses, so the card holds no
 * viewport breakpoint of its own.
 */
export type MediaCardLayout = "stacked" | "wide";

/**
 * The frame a stacked card gives its picture: a `photo` fills a 16:9 frame; a
 * `banner`, the header picture an action or a garden carries, fills a 104px strip
 * so a list or a picker of them stays short. A wide card keeps its 144px column.
 */
export type MediaCardShape = "photo" | "banner";

export interface MediaCardProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title" | "children" | "onClick"> {
  /**
   * The card's own picture: a photo, a banner, or the object's photo grid. It
   * fills the frame (16:9 when stacked, a 104px strip for a banner, and 144px wide
   * by at least 120px tall when wide), so it should fill its box (`h-full w-full`).
   */
  media: ReactNode;
  mediaShape?: MediaCardShape;
  /** A mark on the picture's lower left, such as the domain. */
  mediaLabel?: string;
  /**
   * A mark on the picture, such as the photo count: lower right when stacked,
   * upper right when wide, where the narrow picture leaves the lower edge to
   * the label.
   */
  mediaCount?: string;
  /** One line; a long title ends in an ellipsis and shows in full on hover. */
  title: string;
  /** The card's one pill, its status, under the title. */
  status?: ReactNode;
  /**
   * A line under the status, such as the action a work answers. When stacked,
   * an empty string keeps the line, so every card in a list keeps one height.
   */
  subtitle?: string;
  /** The detail line's lead, such as who did the work. It shortens with an ellipsis. */
  details?: ReactNode;
  /** The detail line's end in a softer ink, such as the age. It never shortens. */
  detailsEnd?: ReactNode;
  /** Hover text for the detail line, such as context the page's chrome already names. */
  detailsTitle?: string;
  layout?: MediaCardLayout;
  selected?: boolean;
  /** Opens the card's object, or chooses it in a picker. With it, the whole card is one button. */
  onClick?: () => void;
  /** Turns the card's button off while what it would do cannot happen. */
  disabled?: boolean;
}

const mediaCardVariants = tv({
  slots: {
    root: "gg-card gg-media-card flex h-full w-full min-w-0 text-left",
    frame: "relative shrink-0 overflow-hidden bg-bg-weak",
    body: "flex min-w-0 flex-1 flex-col gap-1.5 px-3.5 pt-3 pb-3.5",
    count:
      "absolute right-2 inline-flex items-center rounded-full bg-static-black/60 px-2 py-0.75 type-meta-sm font-medium text-static-white",
  },
  variants: {
    layout: {
      stacked: {
        root: "flex-col",
        frame: "w-full",
        count: "bottom-2",
      },
      wide: {
        root: "flex-row",
        frame: "min-h-30 w-36 self-stretch",
        body: "justify-center",
        count: "top-2",
      },
    },
    mediaShape: {
      photo: {},
      banner: {},
    },
  },
  compoundVariants: [
    { layout: "stacked", mediaShape: "photo", class: { frame: "aspect-video" } },
    { layout: "stacked", mediaShape: "banner", class: { frame: "h-26" } },
  ],
  defaultVariants: {
    layout: "stacked",
    mediaShape: "photo",
  },
});

/**
 * MediaCard: the card for an object with a picture of its own (work, gardens
 * and actions), one of the four shared card shapes. It draws
 * the shared card surface (`gg-card`), its picture with up to two marks on it,
 * a one-line title, the status pill under the title, an optional line under the
 * status, and one detail line. Other attributes (a picker's radio role, its tab
 * stop) reach the card's root.
 */
export const MediaCard = React.forwardRef<HTMLElement, MediaCardProps>(function MediaCard(
  {
    media,
    mediaShape = "photo",
    mediaLabel,
    mediaCount,
    title,
    status,
    subtitle,
    details,
    detailsEnd,
    detailsTitle,
    layout = "stacked",
    selected = false,
    onClick,
    disabled,
    className,
    ...rest
  },
  ref
) {
  const slots = mediaCardVariants({ layout, mediaShape });
  // A stacked card keeps an empty line in place; a wide card is as tall as its
  // picture, so its centered text needs no placeholder.
  const showSubtitle = subtitle !== undefined && (subtitle !== "" || layout === "stacked");

  const content = (
    <>
      <div className={slots.frame()}>
        <div className="absolute inset-0">{media}</div>
        {mediaLabel ? (
          <span
            className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-[rgb(var(--gg-card-surface,var(--bg-white-0))/0.9)] px-2.5 py-0.75 type-meta-sm font-semibold text-text-sub"
            title={mediaLabel}
          >
            {mediaLabel}
          </span>
        ) : null}
        {mediaCount ? <span className={slots.count()}>{mediaCount}</span> : null}
      </div>

      <div className={slots.body()}>
        <h3 className="truncate type-card-title text-text-strong" title={title}>
          {title}
        </h3>
        {status ? <div className="flex min-w-0">{status}</div> : null}
        {showSubtitle ? (
          <p
            className="min-h-[1lh] truncate type-meta text-text-sub"
            title={subtitle || undefined}
            aria-hidden={subtitle ? undefined : true}
          >
            {subtitle}
          </p>
        ) : null}
        {details || detailsEnd ? (
          <div
            className="flex min-w-0 items-center justify-between gap-3 type-meta-sm"
            title={detailsTitle}
          >
            <span className="min-w-0 truncate font-medium text-text-sub">{details}</span>
            {detailsEnd ? <span className="shrink-0 text-text-soft">{detailsEnd}</span> : null}
          </div>
        ) : null}
      </div>
    </>
  );

  const shared = {
    ...rest,
    "data-layout": layout,
    "data-selected": selected ? "true" : "false",
    className: cn(slots.root(), className),
  };

  if (onClick) {
    return (
      <button
        type="button"
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={onClick}
        disabled={disabled}
        {...shared}
      >
        {content}
      </button>
    );
  }

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} {...shared}>
      {content}
    </div>
  );
});

MediaCard.displayName = "MediaCard";

/**
 * The card's frame with nothing in it, for a list or a picker that is still loading: the
 * picture's frame, the title line and the detail line, so the cards that arrive land where
 * these stood (DL-056).
 */
export function MediaCardSkeleton({
  mediaShape = "photo",
  layout = "stacked",
  className,
}: {
  mediaShape?: MediaCardShape;
  layout?: MediaCardLayout;
  className?: string;
}) {
  const slots = mediaCardVariants({ layout, mediaShape });
  return (
    <div
      aria-hidden="true"
      data-skeleton="media-card"
      className={cn(slots.root(), "pointer-events-none", className)}
    >
      <div className={slots.frame()} />
      <div className={slots.body()}>
        <span className="flex h-5 w-full items-center">
          <span className="h-3.5 w-2/3 rounded bg-bg-soft-200" />
        </span>
        <span className="flex h-4 w-full items-center">
          <span className="h-2.5 w-1/2 rounded bg-bg-soft-200" />
        </span>
      </div>
    </div>
  );
}
