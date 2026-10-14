import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { EditorialGhostButton } from "./atoms";

export interface PublicReadUnavailableProps {
  /** Asks the read again. Leave it out only where nothing on the surface can retry. */
  onRetry?: () => void;
  /** The surface's own sentence, where it says more than the standard one. */
  message?: ReactNode;
  className?: string;
}

/**
 * A public read that failed, as every public page says it: one sentence, then the way to try
 * again. A failed read is never drawn as an empty one (DESIGN.browser.md).
 */
export function PublicReadUnavailable({ onRetry, message, className }: PublicReadUnavailableProps) {
  const { formatMessage } = useIntl();

  return (
    <div className={cn("max-w-md", className)}>
      <p className="font-serif text-xl italic text-text-soft-400">
        {message ??
          formatMessage({
            id: "public.surface.error",
            defaultMessage: "This public record is temporarily unavailable. Please try again.",
          })}
      </p>
      {onRetry ? (
        <div className="mt-6">
          <EditorialGhostButton onClick={onRetry}>
            {formatMessage({ id: "public.surface.retry", defaultMessage: "Try Again" })}
          </EditorialGhostButton>
        </div>
      ) : null}
    </div>
  );
}
