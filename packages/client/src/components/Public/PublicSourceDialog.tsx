import { IconButton } from "@green-goods/shared/components/IconButton";
import { useDocumentScrollLock } from "@green-goods/shared/hooks/ui/useDocumentScrollLock";
import { useOpenerFocus } from "@green-goods/shared/hooks/utils/useFocusTrap";
import { RiCloseLine } from "@remixicon/react";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";

export interface PublicSourceDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Optional source link or external evidence reference. */
  sourceHref?: string;
  /** Optional accessible label for the source link. */
  sourceLabel?: string;
}

/**
 * PublicSourceDialog — source-anchored dialog primitive for public surfaces.
 *
 * Centered/floating modal on desktop, full-width bottom sheet on mobile.
 * Square corners follow the public editorial surface.
 * Labelled title, focus-safe (initial focus on close button), Escape and
 * overlay close, and reduced-motion friendly (no morph; static fade in).
 */
export function PublicSourceDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  sourceHref,
  sourceLabel,
}: PublicSourceDialogProps) {
  const { formatMessage } = useIntl();
  useDocumentScrollLock(open);
  // Hands focus back to whatever opened the dialog once it closes.
  useOpenerFocus(open);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Focus the close control when the dialog opens, and only then. An inline
  // callback ref is a new function on every render, so React would run it again
  // each time and pull focus back here. It would also move focus during the
  // commit, before the opener above has been read.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-static-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-source-dialog-title"
    >
      <button
        type="button"
        data-pressable="scrim"
        aria-label={formatMessage({ id: "public.source.close", defaultMessage: "Close" })}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-none overflow-y-auto bg-bg-white-0 p-6 shadow-[var(--shadow-editorial-panel)] sm:max-w-2xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="public-source-dialog-title"
              className="font-serif text-xl font-bold text-text-strong-950 md:text-2xl"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-xs uppercase tracking-wide text-text-soft-400">{subtitle}</p>
            ) : null}
          </div>
          <IconButton
            ref={closeRef}
            aria-label={formatMessage({ id: "public.source.close", defaultMessage: "Close" })}
            onClick={onClose}
            icon={<RiCloseLine aria-hidden="true" />}
          />
        </header>
        <div className="flex flex-col gap-4 text-sm text-text-strong-950">{children}</div>
        {sourceHref ? (
          <p className="mt-6 text-xs">
            <a
              href={sourceHref}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary-base hover:underline"
            >
              {sourceLabel ??
                formatMessage({
                  id: "public.source.viewSource",
                  defaultMessage: "View Source",
                })}
            </a>
          </p>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
