/**
 * ItemRow — one item in a list, the same on the installed app and the cockpit (F7).
 *
 * Every row is one height in every state and language (88px at the default text size), on
 * the card surface with a 16px corner. It leads with the item's own photo or a centered
 * 56px icon tile, then a one-line title (the full title shows on hover), the item's one
 * status pill under it, and one detail line; the row's one action, when it has one, takes
 * the right slot, and otherwise an amount the item carries (a jar's balance) can. Each
 * surface sets the density through tokens (the title is 15px in the app and 13px in the
 * cockpit), so the component takes no density prop.
 *
 * The detail line follows the agreed rules: each card type passes at most two details,
 * most important first; the line never wraps, and a detail that does not fit drops whole,
 * last first. Ages take their short forms and are always a number ("2 hr. ago").
 *
 * A row with `onOpen` opens its item: the whole row is the button, or, beside an action,
 * everything but the action. A row without `onOpen` is content and takes no focus. Styles
 * live in shared `theme.css` as the `.gg-card` and `.gg-item-row` rules.
 *
 * @module components/Cards/ItemRow
 */
import { RiImageLine } from "@remixicon/react";
import * as React from "react";
import { cn } from "../../../utils/styles/cn";
import { ImageWithFallback } from "../../Display/ImageWithFallback";
import { StatusBadge } from "../../StatusBadge";

/** A status tone: the pill's color, and the 2px edge on a work row. */
export type ItemRowTone = "success" | "warning" | "error" | "info" | "neutral";

/**
 * One fact on the detail line. A plain string reads in the secondary ink; `soft` quiets a
 * detail such as an age, and `error` marks a reason the reader has to act on. A detail with
 * a `dateTime` is a moment: it renders as a `<time>`, with its full moment in `title`.
 */
export type ItemRowDetail =
  | string
  | {
      text: string;
      tone?: "soft" | "error";
      icon?: React.ReactNode;
      dateTime?: string;
      title?: string;
    };

/**
 * What leads the row: the item's own photo, square and as tall as the row, or an icon
 * tile for an item with no picture of its own. A mark sits on either: a work's photo
 * count, or a marker the rules move off the detail line.
 */
export type ItemRowLead =
  | {
      kind: "photo";
      /** A missing or failed photo shows the fallback icon in its place, so the slot stays. */
      src?: string | null;
      /** Most photos repeat the title, so they are decorative unless this names them. */
      alt?: string;
      fallbackIcon?: React.ComponentType<{ className?: string }>;
      mark?: React.ReactNode;
    }
  | {
      kind: "icon";
      icon: React.ReactNode;
      mark?: React.ReactNode;
      /** Names the icon when it says something the row's text does not (offer or request). */
      label?: string;
    };

export interface ItemRowProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title" | "children" | "onClick"> {
  lead: ItemRowLead;
  /** One line; it ends in an ellipsis when it must and shows in full on hover. */
  title: string;
  /**
   * The row's one pill. A state that replaces the status (an error, a retry,
   * "Confirming…", "Not sent") goes here too, never in a second pill.
   */
  status?: { label: string; tone: ItemRowTone };
  /** At most two details, most important first. */
  details?: readonly [ItemRowDetail] | readonly [ItemRowDetail, ItemRowDetail];
  /** The 2px status edge, for work rows. */
  edge?: ItemRowTone;
  /** The row's one action, in the right slot. Only a row that needs the reader has one. */
  action?: React.ReactNode;
  /**
   * The amount the item carries, in the right slot when the row has no action: the value
   * with its asset as the item's own screens write it ("9.98 DAI"), and under it what the
   * amount is ("Jar balance"). It is part of what opens the row, so it is read with it.
   */
  amount?: { value: string; caption?: string };
  /** Opens the item. */
  onOpen?: () => void;
  /** The open target's name, when the row's own text does not say what opens. */
  openLabel?: string;
  /**
   * The record the list has open: a 3px border in the focus role, and `aria-current` on what
   * opens it, so a screen reader hears which record is open.
   */
  selected?: boolean;
}

function normalizeDetail(detail: ItemRowDetail): Exclude<ItemRowDetail, string> {
  return typeof detail === "string" ? { text: detail } : detail;
}

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="gg-item-row-mark">{children}</span>;
}

function Lead({ lead }: { lead: ItemRowLead }) {
  if (lead.kind === "icon") {
    return (
      <span className="gg-item-row-lead">
        <span className="gg-item-row-tile">
          <span
            {...(lead.label
              ? { role: "img", "aria-label": lead.label }
              : { "aria-hidden": true as const })}
            className="gg-item-row-tile-icon"
          >
            {lead.icon}
          </span>
          {lead.mark ? <Mark>{lead.mark}</Mark> : null}
        </span>
      </span>
    );
  }
  const FallbackIcon = lead.fallbackIcon ?? RiImageLine;
  return (
    <span className="gg-item-row-photo">
      {lead.src ? (
        <ImageWithFallback
          src={lead.src}
          alt={lead.alt ?? ""}
          fallbackIcon={FallbackIcon}
          className="absolute inset-0 h-full w-full object-cover"
          fallbackClassName="absolute inset-0 h-full w-full"
        />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center text-text-soft-400"
        >
          <FallbackIcon className="h-6 w-6" />
        </span>
      )}
      {lead.mark ? <Mark>{lead.mark}</Mark> : null}
    </span>
  );
}

function DetailLine({ details }: { details: NonNullable<ItemRowProps["details"]> }) {
  const items = details.map(normalizeDetail);
  return (
    <span className="gg-item-row-details type-meta-sm" title={items.map((d) => d.text).join(" · ")}>
      <span className="gg-item-row-detail-list">
        {items.map((detail) => (
          <span key={detail.text} className="gg-item-row-detail" data-tone={detail.tone}>
            {detail.icon}
            {detail.dateTime ? (
              <time
                className="gg-item-row-detail-text"
                dateTime={detail.dateTime}
                title={detail.title}
              >
                {detail.text}
              </time>
            ) : (
              <span className="gg-item-row-detail-text">{detail.text}</span>
            )}
          </span>
        ))}
      </span>
    </span>
  );
}

function RowContent({
  lead,
  title,
  status,
  details,
  amount,
}: Pick<ItemRowProps, "lead" | "title" | "status" | "details" | "amount">) {
  return (
    <>
      <Lead lead={lead} />
      <span className="gg-item-row-body">
        <span className="gg-item-row-title type-card-title" title={title}>
          {title}
        </span>
        {status ? (
          <StatusBadge
            size="xs"
            variant={status.tone}
            showIcon={false}
            className="max-w-full"
            title={status.label}
          >
            <span className="min-w-0 truncate">{status.label}</span>
          </StatusBadge>
        ) : null}
        {details?.length ? <DetailLine details={details} /> : null}
      </span>
      {amount ? (
        <span className="gg-item-row-amount">
          <span className="gg-item-row-amount-value type-card-title">{amount.value}</span>
          {amount.caption ? (
            <span className="gg-item-row-amount-caption type-meta-sm">{amount.caption}</span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

export const ItemRow = React.forwardRef<HTMLElement, ItemRowProps>(function ItemRow(
  {
    lead,
    title,
    status,
    details,
    edge,
    action,
    amount,
    onOpen,
    openLabel,
    selected = false,
    className,
    ...rest
  },
  ref
) {
  const rowProps = {
    ...rest,
    className: cn("gg-card gg-item-row", className),
    "data-edge": edge,
    "data-selected": selected ? "true" : undefined,
  };
  // An action takes the right slot in the amount's place, so the row keeps its one height.
  const content = (
    <RowContent
      lead={lead}
      title={title}
      status={status}
      details={details}
      amount={action ? undefined : amount}
    />
  );

  // The whole row opens its item.
  if (onOpen && !action) {
    return (
      <button
        {...rowProps}
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        data-pressable="card"
        aria-label={openLabel}
        aria-current={selected ? "true" : undefined}
        onClick={onOpen}
      >
        {content}
      </button>
    );
  }

  return (
    <div {...rowProps} ref={ref as React.Ref<HTMLDivElement>}>
      {onOpen ? (
        <button
          type="button"
          className="gg-item-row-open"
          data-pressable="row"
          aria-label={openLabel}
          aria-current={selected ? "true" : undefined}
          onClick={onOpen}
        >
          {content}
        </button>
      ) : (
        content
      )}
      {action ? <span className="gg-item-row-action">{action}</span> : null}
    </div>
  );
});

ItemRow.displayName = "ItemRow";

/**
 * The row's frame with nothing in it, for a list that is still loading: the square photo,
 * the title line, the pill and the detail line, so the rows that arrive land where these
 * stood (DL-056). A list whose rows carry a status edge passes `edge`, so the frame keeps
 * the edge's width; a list whose rows lead with an icon tile passes `lead="icon"`, and one
 * whose rows carry an amount passes `amount`, so the frame draws them where they land.
 */
export function ItemRowSkeleton({
  className,
  edge,
  lead = "photo",
  amount = false,
}: {
  className?: string;
  edge?: ItemRowTone;
  lead?: ItemRowLead["kind"];
  amount?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      data-skeleton="item-row"
      data-edge={edge}
      className={cn("gg-card gg-item-row", className)}
    >
      {lead === "icon" ? (
        <span className="gg-item-row-lead">
          <span className="gg-item-row-tile" />
        </span>
      ) : (
        <span className="gg-item-row-photo" />
      )}
      <span className="gg-item-row-body">
        <span className="flex h-5 w-full items-center">
          <span className="h-3.5 w-2/3 rounded bg-bg-soft-200" />
        </span>
        <span className="block h-[22px] w-[68px] rounded-full bg-bg-soft-200" />
        <span className="flex h-4 w-full items-center">
          <span className="h-2.5 w-1/2 rounded bg-bg-soft-200" />
        </span>
      </span>
      {amount ? (
        <span className="gg-item-row-amount">
          <span className="block h-4 w-16 rounded bg-bg-soft-200" />
          <span className="block h-2.5 w-12 rounded bg-bg-soft-200" />
        </span>
      ) : null}
    </div>
  );
}
