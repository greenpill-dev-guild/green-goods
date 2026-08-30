import { Alert } from "@green-goods/shared/components/Alert";
import { EmptyStateShell } from "@green-goods/shared/components/Canvas/EmptyStateShell";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type {
  ConfirmQueueEligibility,
  ConfirmQueueRow,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useHubConfirmQueueController } from "@green-goods/shared/hooks/admin-ui/pool/useHubConfirmQueueController";
import type { Address } from "@green-goods/shared/types/domain";
import type { CommitmentsToConfirm } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentsToConfirm";
import { RiShakeHandsLine } from "@remixicon/react";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { CommitmentDialogPanel } from "@/views/Garden/Pool/CommitmentDialog";
import { confirmEligibilityChip, shortAddress } from "@/views/Garden/Pool/poolPresentation";
import { HubWorkbenchSkeletonRows } from "./HubWorkbenchSkeletonRows";

export interface HubConfirmQueueProps {
  toConfirm: CommitmentsToConfirm;
  chainId: number;
  viewer?: Address;
  normalizedSearch: string;
  selectedCommitmentId: string | undefined;
  onOpenCommitment: (commitmentId: string) => void;
  onCloseCommitment?: () => void;
}

/**
 * W13, the Hub's Confirm stage (uiux-spec §6.9, C.48): commitments waiting on
 * the steward, each with who committed, the title, the garden, N-of-group
 * progress, a visible eligibility badge and the decision row. Confirm on an
 * ordinary row enqueues the confirmation; on a fallback row it opens the
 * commitment dialog, where the reasoned fallback lives; Not yet opens the
 * reasoned dispute dialog, and appears only where the pool's own steward
 * authority makes it legal; a disputed row carries Resolve instead. Loading
 * and read-error casts never render as an empty queue, and the error cast
 * retries the confirmation reads rather than sending the steward elsewhere.
 */
export function HubConfirmQueue({
  toConfirm,
  chainId,
  normalizedSearch,
  selectedCommitmentId,
  onOpenCommitment,
  onCloseCommitment,
}: HubConfirmQueueProps) {
  const { formatMessage } = useIntl();
  const queue = useHubConfirmQueueController({ chainId, toConfirm, search: normalizedSearch });
  const [notYet, setNotYet] = useState<ConfirmQueueRow | null>(null);
  const selected = selectedCommitmentId
    ? queue.rows.find((row) => row.commitment.commitmentId.toString() === selectedCommitmentId)
    : undefined;
  const actDisabled = !queue.isOnline || queue.isDisputing;

  const titleOf = (row: ConfirmQueueRow) =>
    row.title ??
    formatMessage(
      { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Commitment {id}" },
      { id: row.commitment.commitmentId.toString() }
    );

  const badge = (eligibility: ConfirmQueueEligibility) =>
    confirmEligibilityChip(eligibility, formatMessage);

  let body: ReactNode;
  if (queue.isError) {
    body = (
      <EmptyStateShell>
        <Alert variant="error">
          {formatMessage({
            id: "cockpit.hub.confirm.readError",
            defaultMessage:
              "The confirmation queue could not be read. Nothing was confirmed or disputed while it was unreachable; refresh and try again.",
          })}
        </Alert>
        <AdminButton type="button" variant="filled" onClick={() => void toConfirm.refetch()}>
          {formatMessage({
            id: "cockpit.garden.pool.readError.retry",
            defaultMessage: "Try Again",
          })}
        </AdminButton>
      </EmptyStateShell>
    );
  } else if (queue.isLoading) {
    body = <HubWorkbenchSkeletonRows count={3} variant="card" />;
  } else if (queue.rows.length === 0) {
    body = (
      <EmptyStateShell>
        <EmptyState
          icon={<RiShakeHandsLine className="h-6 w-6" />}
          title={formatMessage({
            id: "cockpit.hub.confirm.empty.title",
            defaultMessage: "Nothing to confirm",
          })}
          description={
            normalizedSearch.trim()
              ? formatMessage({
                  id: "cockpit.hub.confirm.empty.search",
                  defaultMessage: "Nothing waiting on you matches that search.",
                })
              : formatMessage({
                  id: "cockpit.hub.confirm.empty.description",
                  defaultMessage:
                    "Commitments kept and sent for this garden's confirmation will wait here.",
                })
          }
        />
      </EmptyStateShell>
    );
  } else {
    body = (
      <ul className="space-y-2" data-testid="hub-confirm-queue">
        {queue.rows.map((row) => {
          const { commitment } = row;
          const title = titleOf(row);
          const threshold = Math.max(commitment.confirmationThreshold ?? 1, 1);
          const count = commitment.confirmationCount ?? 0;
          const disputed = commitment.onchainState === "DISPUTED";
          const eligibility = disputed ? null : badge(row.eligibility);
          const id = commitment.commitmentId.toString();
          const selectedRow = selectedCommitmentId === id;
          const progressLabel = formatMessage(
            {
              id: "cockpit.hub.confirm.progress",
              defaultMessage: "{count} of {threshold} confirmed",
            },
            { count, threshold }
          );
          return (
            <li
              key={`${row.garden}-${commitment.id}`}
              className={`rounded-[var(--m3-shape-md)] bg-[rgb(var(--admin-surface-0))] p-3 shadow-[var(--m3-elevation-1)] ${selectedRow ? "ring-2 ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]" : ""}`}
              data-testid={`hub-confirm-${id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  className="m3-state-layer min-w-0 flex-1 rounded-[var(--m3-shape-sm)] text-left [--state-layer-color:var(--m3-on-surface)]"
                  onClick={() => onOpenCommitment(id)}
                >
                  <span
                    className="block truncate text-body-md font-medium text-text-strong"
                    title={title}
                  >
                    {title}
                  </span>
                  <span
                    className="block text-xs text-text-soft"
                    title={commitment.leadProvider ?? undefined}
                  >
                    {[
                      shortAddress(commitment.leadProvider ?? commitment.creator),
                      row.gardenName,
                      `${commitment.targetUnits.toString()} ${commitment.unitLabel ?? ""}`.trim(),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
                <StatusBadge variant={eligibility?.variant ?? "error"} size="sm">
                  {eligibility?.label ??
                    formatMessage({
                      id: "cockpit.hub.confirm.disputed",
                      defaultMessage: "under review",
                    })}
                </StatusBadge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <AdminLinearProgress
                  value={Math.min(100, Math.round((count / threshold) * 100))}
                  ariaLabel={progressLabel}
                  className="flex-1"
                />
                <span className="text-xs text-text-soft">{progressLabel}</span>
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {disputed ? (
                  <AdminButton
                    type="button"
                    variant="filled"
                    size="sm"
                    onClick={() => onOpenCommitment(id)}
                  >
                    {formatMessage({
                      id: "cockpit.hub.confirm.act.resolve",
                      defaultMessage: "Resolve…",
                    })}
                  </AdminButton>
                ) : (
                  <>
                    {/* Only the pool garden's own steward may raise a dispute
                        (TerminalLib.raiseDispute), so a protocol steward
                        reaching into another garden's pool is not offered one. */}
                    {row.canDispute === false ? null : (
                      <AdminButton
                        type="button"
                        variant="outlined"
                        size="sm"
                        onClick={() => setNotYet(row)}
                        disabled={actDisabled}
                      >
                        {formatMessage({
                          id: "cockpit.hub.confirm.act.notYet",
                          defaultMessage: "Not yet…",
                        })}
                      </AdminButton>
                    )}
                    {row.eligibility === "ORDINARY" ? (
                      <AdminButton
                        type="button"
                        variant="filled"
                        size="sm"
                        onClick={() => void queue.acts.confirm(row)}
                        disabled={queue.isConfirming}
                      >
                        {formatMessage({
                          id: "cockpit.hub.confirm.act.confirm",
                          defaultMessage: "Confirm Kept",
                        })}
                      </AdminButton>
                    ) : (
                      <AdminButton
                        type="button"
                        variant="filled"
                        size="sm"
                        onClick={() => onOpenCommitment(id)}
                      >
                        {formatMessage({
                          id: "cockpit.hub.confirm.act.confirmFallback",
                          defaultMessage: "Confirm kept…",
                        })}
                      </AdminButton>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div data-component="HubConfirmQueue" data-region="hub-confirm">
      {!queue.isOnline && queue.rows.length > 0 ? (
        <p className="mb-2 text-xs text-warning-dark" role="status">
          {formatMessage({
            id: "cockpit.hub.confirm.offline",
            defaultMessage:
              "Confirmations queue on this device; disputes and fallbacks need a connection.",
          })}
        </p>
      ) : null}
      {body}

      <AdminReasonDialog
        isOpen={notYet !== null}
        onClose={() => setNotYet(null)}
        tone="hub"
        title={formatMessage({
          id: "cockpit.hub.confirm.notYet.title",
          defaultMessage: "Not yet: raise a dispute",
        })}
        description={formatMessage({
          id: "cockpit.hub.confirm.notYet.description",
          defaultMessage:
            "Freezes the commitment for review instead of confirming it. Members see “under review by stewards”, never dispute language.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.commitment.dispute.confirm",
          defaultMessage: "Raise Dispute",
        })}
        suggestions={[
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.contested",
            defaultMessage: "Delivery contested",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.details",
            defaultMessage: "Details look wrong",
          }),
          formatMessage({
            id: "cockpit.garden.pool.commitment.dispute.suggestion.secondLook",
            defaultMessage: "Needs a second look",
          }),
        ]}
        blockedReason={
          queue.isOnline
            ? undefined
            : formatMessage({
                id: "cockpit.garden.pool.offline",
                defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
              })
        }
        onConfirm={async (reason) => {
          if (!notYet) return;
          await queue.acts.notYet(notYet, reason);
          setNotYet(null);
        }}
      />

      <AdminDialog
        open={Boolean(selectedCommitmentId)}
        onOpenChange={(next) => {
          if (!next) onCloseCommitment?.();
        }}
        size="lg"
        tone="hub"
        title={formatMessage({
          id: "cockpit.garden.pool.commitment.title",
          defaultMessage: "Commitment",
        })}
        bodyClassName="p-0"
      >
        {selectedCommitmentId ? (
          selected ? (
            <CommitmentDialogPanel
              chainId={chainId}
              // The pool's garden, not the one whose authority confirms: the
              // inspector reads that pool's state and seats the reader there.
              garden={selected.poolGarden ?? selected.garden}
              commitmentId={selectedCommitmentId}
              tone="hub"
            />
          ) : (
            <p className="p-4 text-sm text-text-soft">
              {formatMessage({
                id: "cockpit.hub.confirm.notInQueue",
                defaultMessage: "This commitment is not in your confirmation queue any more.",
              })}
            </p>
          )
        ) : null}
      </AdminDialog>
    </div>
  );
}
