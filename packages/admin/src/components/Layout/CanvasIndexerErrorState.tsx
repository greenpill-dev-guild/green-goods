import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { SeedlingIllustration } from "./SeedlingIllustration";

interface CanvasIndexerErrorStateProps {
  onRetry: () => void;
}

/**
 * Terminal state shown on `/` when `useEligibleAdminGardens.isError` is true
 * AND the role-confirmed cross-check produced no fallback gardens.
 *
 * Distinct from `CanvasGardenAccessState` — that copy implies "you don't have
 * access yet"; this copy says "we can't tell yet, the indexer is unreachable".
 * Mixing the two during an outage was the deceptive UX flagged in the audit.
 */
export function CanvasIndexerErrorState({ onRetry }: CanvasIndexerErrorStateProps) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="flex min-h-full flex-col items-center justify-center px-6 py-16 text-center"
      data-testid="canvas-indexer-error"
    >
      <SeedlingIllustration className="h-28 w-28" />
      <h1 className="mt-5 text-xl font-semibold text-text-strong">
        {formatMessage({
          id: "cockpit.access.indexerErrorTitle",
          defaultMessage: "Can't load garden access",
        })}
      </h1>
      <p className="mt-2 max-w-md text-sm text-text-sub">
        {formatMessage({
          id: "cockpit.access.indexerErrorDescription",
          defaultMessage:
            "We couldn't load gardens from the indexer. This is usually temporary — try again in a moment.",
        })}
      </p>
      <AdminButton className="mt-6" onClick={onRetry}>
        {formatMessage({ id: "cockpit.access.indexerErrorRetry", defaultMessage: "Try again" })}
      </AdminButton>
    </section>
  );
}
