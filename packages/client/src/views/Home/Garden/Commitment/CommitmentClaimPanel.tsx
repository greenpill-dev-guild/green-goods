import { type Address, AddressDisplay, StatusBadge } from "@green-goods/shared";
import {
  type CommitmentClaimRequestRecord,
  type CommitmentReadModel,
  useCommitmentReason,
} from "@green-goods/shared/commitment-pooling";
import { RiArrowLeftLine, RiRefreshLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface CommitmentClaimPanelProps {
  commitment: CommitmentReadModel;
  /** The reader's own request on this commitment, the most recent one. */
  request: CommitmentClaimRequestRecord;
  viewer: Address;
  /** Whether a fresh request may be made now: the commitment is still open. */
  canAskAgain: boolean;
  isPending: boolean;
  onAskAgain: () => void;
  onBackToBrowse: () => void;
}

/**
 * The reader's own claim request, in its exact lifecycle.
 *
 * Pending keeps the commitment available to everyone else eligible. Declined
 * shows the steward's reason and offers a fresh request, never a retry of the
 * old record. Superseded says someone else took it up and offers the way out.
 * Accepted names the provider, which for a garden claim is the garden, with
 * the steward who asked shown beside it: the two identities are different
 * things and are never collapsed.
 */
export function CommitmentClaimPanel({
  commitment,
  request,
  viewer,
  canAskAgain,
  isPending,
  onAskAgain,
  onBackToBrowse,
}: CommitmentClaimPanelProps) {
  const { formatMessage, formatDate } = useIntl();
  const { reason, isUnavailable } = useCommitmentReason(
    request.state === "DECLINED" ? request.reasonCID : null
  );
  const isGardenClaim = request.claimType === "GARDEN";
  const requestedByYou = request.requestedBy.toLowerCase() === viewer.toLowerCase();
  const state = request.state;
  const tone =
    state === "PENDING"
      ? "warning"
      : state === "ACCEPTED"
        ? "success"
        : state === "DECLINED"
          ? "error"
          : "neutral";

  return (
    <section
      className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      data-component="CommitmentClaimPanel"
      data-state={state}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: `app.claim.${state}.title` })}
        </h3>
        <StatusBadge size="sm" variant={tone}>
          {formatMessage({ id: `app.claim.${state}.chip` })}
        </StatusBadge>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-text-sub-600">
        {formatMessage({
          id: isGardenClaim ? `app.claim.${state}.bodyGarden` : `app.claim.${state}.body`,
        })}
      </p>

      <dl className="mt-3 space-y-2 border-t border-stroke-soft-200 pt-3 text-sm">
        {isGardenClaim ? (
          <>
            <Row
              label={formatMessage({
                id: state === "ACCEPTED" ? "app.claim.row.provider" : "app.claim.row.claimant",
              })}
              value={
                <span className="flex items-center gap-2">
                  <AddressDisplay address={request.claimant} showCopyButton={false} />
                  <span className="text-xs text-text-soft-400">
                    {formatMessage({ id: "app.claim.row.gardenTag" })}
                  </span>
                </span>
              }
            />
            <Row
              label={formatMessage({ id: "app.claim.row.askedBy" })}
              value={
                requestedByYou ? (
                  formatMessage({ id: "app.claim.row.you" })
                ) : (
                  <AddressDisplay address={request.requestedBy} showCopyButton={false} />
                )
              }
            />
          </>
        ) : null}
        <Row
          label={formatMessage({ id: "app.claim.row.asked" })}
          value={formatDate(new Date(request.requestedAt * 1000), {
            month: "short",
            day: "numeric",
          })}
        />
        {state === "DECLINED" ? (
          <Row
            label={formatMessage({ id: "app.claim.row.reason" })}
            value={
              reason?.reason ??
              (isUnavailable || !request.reasonCID
                ? "—"
                : formatMessage({ id: "app.claim.row.reasonLoading" }))
            }
          />
        ) : null}
        {state !== "PENDING" && request.resolvedAt ? (
          <Row
            label={formatMessage({ id: "app.claim.row.resolved" })}
            value={formatDate(new Date(request.resolvedAt * 1000), {
              month: "short",
              day: "numeric",
            })}
          />
        ) : null}
      </dl>

      {state === "DECLINED" && canAskAgain ? (
        <button
          type="button"
          onClick={onAskAgain}
          disabled={isPending}
          aria-busy={isPending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
        >
          <RiRefreshLine className="h-4 w-4" aria-hidden="true" />
          {formatMessage({
            id:
              commitment.claimMode === "APPROVAL_GATED"
                ? "app.claim.askAgain"
                : "app.claim.takeUpAgain",
          })}
        </button>
      ) : null}
      {state === "SUPERSEDED" ? (
        <button
          type="button"
          onClick={onBackToBrowse}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-4 py-3 text-sm font-medium text-text-strong-950 tap-target-lg"
        >
          <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
          {formatMessage({ id: "app.claim.backToBrowse" })}
        </button>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-text-soft-400">{label}</dt>
      <dd className="min-w-0 text-right text-text-strong-950">{value}</dd>
    </div>
  );
}
