/**
 * SheetHeader — the one header every sheet and dialog renders (DL-028).
 *
 * Title (18px semibold on a 24px line, wraps), an optional description
 * (14px on a 20px line, wraps), and a 44px borderless close button on the
 * title's first line. No leading icon: the tone of a sheet lives in its
 * primary action and its dialog role. An optional rail (a tab strip) renders
 * directly under the header row and keeps its own bottom rule; the header
 * itself draws none.
 *
 * `PwaSheet` renders it under the drag handle and, through `dragHandlers`,
 * makes the title block part of the grip's grab area (DL-033); the centered
 * `DialogShell` and `ConfirmDialog` render it at the top of their Radix
 * surface, passing the Radix title and description primitives through
 * `titleAs` / `descriptionAs` so Radix keeps naming the dialog.
 *
 * Layout lives in shared `utilities.css` as `[data-component="SheetHeader"]`
 * attribute rules (Tailwind does not scan `packages/shared/src/` from the app
 * builds). The title and description sizes sit in `@layer components`, which
 * is why consumers must not carry unlayered element type rules.
 *
 * @module components/Dialog/SheetHeader
 */
import { RiCloseLine } from "@remixicon/react";
import type { DOMAttributes, ElementType, ReactNode } from "react";
import { IconButton } from "../IconButton";

export interface SheetHeaderProps {
  title: ReactNode;
  /** Id of the default title element, for the dialog's `aria-labelledby`. Ignored with `titleAs`. */
  titleId?: string;
  description?: ReactNode;
  /** Id of the default description element. Ignored with `descriptionAs`. */
  descriptionId?: string;
  /** Renders the title through another element, e.g. Radix `Dialog.Title`. */
  titleAs?: ElementType;
  /** Renders the description through another element, e.g. Radix `Dialog.Description`. */
  descriptionAs?: ElementType;
  /** Accessible name of the close button. */
  closeLabel: string;
  onClose: () => void;
  closeDisabled?: boolean;
  hideCloseButton?: boolean;
  /** Test id of the close button. Defaults to `pwa-sheet-close`. */
  closeTestId?: string;
  /** True when the header opens the surface itself (no drag handle above it). */
  standalone?: boolean;
  /**
   * A bottom sheet's drag handlers. With them the title block joins the
   * grip's grab area. The close button sits outside it: a gesture library's
   * tap filter must never stand between a press and the way out.
   */
  dragHandlers?: DOMAttributes<HTMLElement>;
  /** Extra classes on the header row (consumer-scanned utilities). */
  className?: string;
  /** Extra classes on the description. */
  descriptionClassName?: string;
  /** A rail under the header row, typically tabs. */
  children?: ReactNode;
}

export function SheetHeader({
  title,
  titleId,
  description,
  descriptionId,
  titleAs,
  descriptionAs,
  closeLabel,
  onClose,
  closeDisabled = false,
  hideCloseButton = false,
  closeTestId = "pwa-sheet-close",
  standalone = false,
  dragHandlers,
  className,
  descriptionClassName,
  children,
}: SheetHeaderProps) {
  const Title: ElementType = titleAs ?? "h2";
  const Description: ElementType = descriptionAs ?? "p";
  const hasDescription = description !== undefined && description !== null && description !== "";

  return (
    <>
      <header
        data-component="SheetHeader"
        data-slot="root"
        data-standalone={standalone ? "" : undefined}
        className={className}
      >
        <div
          data-component="SheetHeader"
          data-slot="text"
          data-drag-region={dragHandlers ? "" : undefined}
          {...dragHandlers}
        >
          <Title
            {...(titleAs ? {} : { id: titleId })}
            data-component="SheetHeader"
            data-slot="title"
          >
            {title}
          </Title>
          {hasDescription ? (
            <Description
              {...(descriptionAs ? {} : { id: descriptionId })}
              data-component="SheetHeader"
              data-slot="description"
              className={descriptionClassName}
            >
              {description}
            </Description>
          ) : null}
        </div>
        {!hideCloseButton && (
          <IconButton
            data-component="SheetHeader"
            data-slot="close"
            data-testid={closeTestId}
            aria-label={closeLabel}
            disabled={closeDisabled}
            onClick={onClose}
            icon={<RiCloseLine aria-hidden="true" />}
          />
        )}
      </header>
      {children ? (
        <div data-component="SheetHeader" data-slot="rail">
          {children}
        </div>
      ) : null}
    </>
  );
}
