// Command Surface: one card of Home's Highlights carousel (DL-127).
import type { ItemRowTone } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiImageLine } from "@remixicon/react";
import type { ReactNode } from "react";

/** Every card's frame, so no card changes height: 280×112 on the shared card surface. */
const CARD_FRAME = "gg-card flex h-28 w-70 shrink-0 snap-start items-stretch overflow-hidden";

export interface HighlightCardProps {
  /** What the card shows, for the design checks and the stories. */
  kind: "cycle" | "work" | "ask";
  /** What the card is, above its title. */
  eyebrow?: ReactNode;
  title: string;
  /** A season's or campaign's name reads at the card's largest size. */
  prominent?: boolean;
  /** One line under the title. */
  detail?: ReactNode;
  /** The item's one status pill, in the detail line's place. */
  status?: { label: string; tone: ItemRowTone };
  /** The item's own photo, 96px wide and the card's full height. */
  media?: ReactNode;
  onOpen: () => void;
}

/**
 * One Highlights card: an eyebrow that says what it is, a one-line title, and one line or one
 * pill for where it stands, beside the item's own photo when it has one. The whole card opens
 * what it shows, and every kind shares one frame (DL-127).
 */
export function HighlightCard({
  kind,
  eyebrow,
  title,
  prominent = false,
  detail,
  status,
  media,
  onOpen,
}: HighlightCardProps) {
  return (
    <li className="flex">
      <button
        type="button"
        data-pressable="card"
        data-highlight={kind}
        onClick={onOpen}
        className={cn(CARD_FRAME, "gg-media-card text-start")}
      >
        {media ? (
          <span className="relative flex w-24 shrink-0 items-center justify-center bg-bg-soft-200">
            {media}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3.5 py-3">
          {eyebrow ? <span className="flex min-w-0">{eyebrow}</span> : null}
          <span
            className={cn(
              "block truncate text-text-strong-950",
              prominent ? "type-title-md" : "type-card-title"
            )}
            title={title}
          >
            {title}
          </span>
          {status ? (
            <StatusBadge
              size="xs"
              variant={status.tone}
              showIcon={false}
              className="max-w-full self-start"
              title={status.label}
            >
              <span className="min-w-0 truncate">{status.label}</span>
            </StatusBadge>
          ) : detail ? (
            <span className="block truncate type-meta text-text-sub-600">{detail}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/** A work's own photo in a card's media slot, the fallback mark when it cannot load. */
export function HighlightPhoto({ src }: { src: string }) {
  return (
    <ImageWithFallback
      src={src}
      alt=""
      fallbackIcon={RiImageLine}
      className="absolute inset-0 h-full w-full object-cover"
      fallbackClassName="absolute inset-0 h-full w-full"
    />
  );
}
