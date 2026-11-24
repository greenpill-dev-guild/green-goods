// Command Surface: one card of Home's What's Open carousel (DL-127, DL-133).
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";

/** The card's frame on the shared card surface: 112px tall, 280px wide in the row. */
const CARD_FRAME = "gg-card flex h-28 items-stretch overflow-hidden";

export interface HighlightCardProps {
  /** What the card shows, for the design checks and the stories. */
  kind: "cycle";
  /** What the card is, above its title. */
  eyebrow?: ReactNode;
  title: string;
  /** A season's or campaign's name reads at the card's largest size. */
  prominent?: boolean;
  /** One line under the title. */
  detail?: ReactNode;
  /** The one card of a single open cycle takes the row's full width (DL-133). */
  wide?: boolean;
  onOpen: () => void;
}

/**
 * One What's Open card: an eyebrow that says what it is, a one-line title, and one line for
 * where it stands. The whole card opens what it shows. In the row every card keeps the one
 * 280×112 frame; alone, the card spans the row (DL-133).
 */
export function HighlightCard({
  kind,
  eyebrow,
  title,
  prominent = false,
  detail,
  wide = false,
  onOpen,
}: HighlightCardProps) {
  return (
    <li className="flex">
      <button
        type="button"
        data-pressable="card"
        data-highlight={kind}
        onClick={(event) => {
          // Safari does not focus a pressed button; a sheet this opens hands focus back to it.
          event.currentTarget.focus({ preventScroll: true });
          onOpen();
        }}
        className={cn(
          CARD_FRAME,
          "gg-media-card text-start",
          wide ? "w-full" : "w-70 shrink-0 snap-start"
        )}
      >
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
          {detail ? (
            <span className="block truncate type-meta text-text-sub-600">{detail}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
