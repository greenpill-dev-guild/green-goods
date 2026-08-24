import type { Address } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";

/** The panel while the commitment, its detail and its timeline are still in flight. */
export function CommitmentDialogLoading() {
  const { formatMessage } = useIntl();

  return (
    <div
      className="space-y-3 p-4"
      role="status"
      aria-label={formatMessage({
        id: "cockpit.garden.pool.commitment.loading",
        defaultMessage: "Loading the commitment",
      })}
    >
      <div className="h-8 w-2/3 rounded-[var(--m3-shape-sm)] skeleton-shimmer" aria-hidden />
      <div className="h-24 rounded-[var(--m3-shape-md)] skeleton-shimmer" aria-hidden />
      <div className="h-40 rounded-[var(--m3-shape-md)] skeleton-shimmer" aria-hidden />
    </div>
  );
}

/**
 * The panel when the commitment cannot be read: a retry for a mid-sync record
 * and a way back to the pool for a stale link.
 */
export function CommitmentDialogNotFound({
  garden,
  onRetry,
}: {
  /** The pool's garden, so the way back lands on the reader's own pool. */
  garden: Address;
  onRetry: () => void;
}) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-56 flex-col items-center justify-center gap-3 p-4 text-center"
      data-component="CommitmentDialogPanel"
      data-state="not-found"
    >
      <p className="label-md text-text-strong">
        {formatMessage({
          id: "cockpit.garden.pool.commitment.notFound.title",
          defaultMessage: "This commitment couldn’t be loaded",
        })}
      </p>
      <p className="max-w-sm text-sm text-text-soft">
        {formatMessage({
          id: "cockpit.garden.pool.commitment.notFound.body",
          defaultMessage:
            "It may be mid-sync, or the link is stale. Retry, or return to the pool to pick it again.",
        })}
      </p>
      <div className="flex gap-2">
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          leadingIcon={<RiRefreshLine className="h-4 w-4" />}
          onClick={() => onRetry()}
        >
          {formatMessage({
            id: "cockpit.garden.pool.commitment.notFound.retry",
            defaultMessage: "Retry",
          })}
        </AdminButton>
        <AdminButton
          type="button"
          variant="text"
          size="sm"
          onClick={() => navigate(adminRoutes.gardenPool({ gardenId: garden }))}
        >
          {formatMessage({
            id: "cockpit.garden.pool.commitment.notFound.back",
            defaultMessage: "Back to pool",
          })}
        </AdminButton>
      </div>
    </div>
  );
}

/**
 * The panel on a chain that does not serve pooling yet. No query ever ran, so
 * there is nothing to retry — only a way back to the pool.
 */
export function CommitmentDialogUnavailable({ garden }: { garden: Address }) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-56 flex-col items-center justify-center gap-3 p-4 text-center"
      data-component="CommitmentDialogPanel"
      data-state="unavailable"
    >
      <p className="label-md text-text-strong">
        {formatMessage({
          id: "cockpit.garden.pool.unavailable.title",
          defaultMessage: "Commitment pooling is not on this chain yet",
        })}
      </p>
      <p className="max-w-sm text-sm text-text-soft">
        {formatMessage({
          id: "cockpit.garden.pool.unavailable.body",
          defaultMessage: "The pool console switches on with the release that serves pooling here.",
        })}
      </p>
      <AdminButton
        type="button"
        variant="text"
        size="sm"
        onClick={() => navigate(adminRoutes.gardenPool({ gardenId: garden }))}
      >
        {formatMessage({
          id: "cockpit.garden.pool.commitment.notFound.back",
          defaultMessage: "Back to pool",
        })}
      </AdminButton>
    </div>
  );
}
