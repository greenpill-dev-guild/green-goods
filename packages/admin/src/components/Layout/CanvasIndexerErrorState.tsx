import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { RiErrorWarningLine } from "@remixicon/react";
import { useIntl } from "react-intl";

interface CanvasIndexerErrorStateProps {
  onRetry: () => void;
}

/**
 * Terminal state shown on `/` when `useEligibleAdminGardens.isError` is true
 * AND the role-confirmed cross-check produced no fallback gardens.
 *
 * Distinct from `CanvasGardenAccessState` — that copy implies "you don't have
 * access yet"; this copy says "we can't tell yet". Mixing the two during an
 * outage was the deceptive UX flagged in the audit. The copy names no source:
 * the error covers the indexer's garden reads and the chain's role read alike.
 */
export function CanvasIndexerErrorState({ onRetry }: CanvasIndexerErrorStateProps) {
  const { formatMessage } = useIntl();

  return (
    <section
      className="flex min-h-full flex-col items-center justify-center px-6 py-16"
      data-testid="canvas-indexer-error"
    >
      <EmptyState
        titleAs="h1"
        tone="error"
        icon={<RiErrorWarningLine />}
        title={formatMessage({
          id: "hub.access.indexerErrorTitle",
          defaultMessage: "Can't load garden access",
        })}
        description={formatMessage({
          id: "hub.access.indexerErrorDescription",
          defaultMessage:
            "We couldn't check your garden access. This is usually temporary. Try again in a moment.",
        })}
        action={
          <Button type="button" size="sm" onClick={onRetry}>
            {formatMessage({ id: "hub.access.indexerErrorRetry", defaultMessage: "Try Again" })}
          </Button>
        }
      />
    </section>
  );
}
