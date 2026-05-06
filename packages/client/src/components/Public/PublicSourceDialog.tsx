import { RiCloseLine } from "@remixicon/react";
import { type ReactNode, useEffect } from "react";
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
 * Centered/floating modal on desktop, bottom-sheet on mobile (rounded-top).
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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-static-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-source-dialog-title"
    >
      <button
        type="button"
        aria-label={formatMessage({ id: "public.source.close", defaultMessage: "Close" })}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] overflow-y-auto bg-bg-white-0 p-6 shadow-[var(--shadow-editorial-panel)] sm:max-w-2xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="public-source-dialog-title"
              className="font-serif text-xl text-text-strong-950 md:text-2xl"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-xs uppercase tracking-wide text-text-soft-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            ref={(node) => node?.focus()}
            type="button"
            aria-label={formatMessage({ id: "public.source.close", defaultMessage: "Close" })}
            onClick={onClose}
            className="rounded-full p-1 text-text-sub-600 transition-colors hover:bg-bg-weak-50"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
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
                  defaultMessage: "View source",
                })}
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
