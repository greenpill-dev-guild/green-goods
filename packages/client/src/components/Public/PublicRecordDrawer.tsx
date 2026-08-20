import { RiCloseLine } from "@remixicon/react";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";

export interface PublicRecordDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Mono uppercase label in the header bar, e.g. `Evidence record · № 4f2a`. */
  eyebrow: ReactNode;
  /** id of the `<h2>` the body renders, for `aria-labelledby`. */
  titleId: string;
  /**
   * Set false while a nested dialog (e.g. an image viewer) is open, so Escape
   * dismisses that one rather than closing the drawer out from under it.
   */
  dismissOnEscape?: boolean;
  children: ReactNode;
}

/**
 * The public record drawer — bottom sheet on mobile, right-side drawer on
 * desktop, used for reading one published record.
 *
 * Fixed height with a persistent header and a scrolling body, rather than a
 * panel that grows with its content. A field note with two portrait photos ran
 * past 2,000px in the old growing shell, which pushed its own title and source
 * link off screen.
 *
 * Portalled to the body on purpose. `.editorial-section-reveal` applies a
 * transform, and a transformed ancestor becomes the containing block for
 * `position: fixed` — a drawer rendered inside a revealed section sizes and
 * scrolls against that section instead of the viewport. Portalling here makes
 * every consumer safe wherever it is rendered, instead of depending on each
 * call site sitting outside a transform.
 */
export function PublicRecordDrawer({
  open,
  onClose,
  eyebrow,
  titleId,
  dismissOnEscape = true,
  children,
}: PublicRecordDrawerProps) {
  const { formatMessage } = useIntl();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Focus the close control when the drawer opens, and only then. An inline
  // `ref={(node) => node?.focus()}` is a new callback every render, so React
  // re-runs it on each one — closing the nested image viewer re-rendered this
  // drawer and stole focus back here instead of returning it to the photo.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissOnEscape) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handler);
    };
  }, [open, onClose, dismissOnEscape]);

  if (!open) return null;

  const closeLabel = formatMessage({ id: "public.source.close", defaultMessage: "Close" });

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-end justify-center sm:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 bg-static-black/40 backdrop-blur-[2px]"
      />
      <div className="relative flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[var(--radius-lg)] bg-bg-weak-50 shadow-[var(--shadow-editorial-drawer)] sm:h-screen sm:max-w-[42rem] sm:rounded-none">
        <header className="flex items-center justify-between border-b border-stroke-soft-200 px-6 pt-5 pb-4 sm:px-10">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
            {eyebrow}
          </p>
          <button
            ref={closeRef}
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-full border border-stroke-soft-200 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-strong-950 transition-colors hover:bg-bg-weak-50"
          >
            <span aria-hidden="true">
              <RiCloseLine className="h-3.5 w-3.5" />
            </span>
            {closeLabel}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">{children}</div>
      </div>
    </div>,
    document.body
  );
}
