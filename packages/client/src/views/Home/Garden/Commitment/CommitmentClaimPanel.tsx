import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { Button } from "@green-goods/shared/components/Button";
import type { Address } from "@green-goods/shared/types/domain";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
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
 * What the reader is told about their request. The index closes a request still pending when its
 * promise ends as superseded, with the ending as the resolution code, so a promise withdrawn or
 * lapsed before anyone took it up never reads as taken up by someone else.
 */
function requestOutcome({ state, resolutionCode }: CommitmentClaimRequestRecord) {
  if (state !== "SUPERSEDED") return state;
  if (resolutionCode === "COMMITMENT_CANCELLED") return "WITHDRAWN";
  if (resolutionCode === "COMMITMENT_EXPIRED") return "EXPIRED";
  return state;
}

/**
 * The reader's own claim request, in its exact lifecycle.
 *
 * Pending keeps the commitment available to everyone else eligible. Declined
 * shows the steward's reason and offers a fresh request, never a retry of the
 * old record. Superseded says someone else took it up, or that the promise was
 * withdrawn or lapsed before anyone did, and offers the way out; a withdrawal
 * shows the reason it was withdrawn with.
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
  const outcome = requestOutcome(request);
  // A declined request carries the steward's own reason; a withdrawn promise carries the one
  // given when it was withdrawn, which closed the request with it.
  const reasonCID =
    outcome === "DECLINED"
      ? request.reasonCID
      : outcome === "WITHDRAWN"
        ? commitment.cancelReasonCID
        : null;
  const { reason, isUnavailable } = useCommitmentReason(reasonCID);
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
          {formatMessage({ id: `app.claim.${outcome}.title` })}
        </h3>
        <StatusBadge size="sm" variant={tone}>
          {formatMessage({ id: `app.claim.${outcome}.chip` })}
        </StatusBadge>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-text-sub-600">
        {formatMessage({
          id: isGardenClaim ? `app.claim.${outcome}.bodyGarden` : `app.claim.${outcome}.body`,
        })}
      </p>

      <FactList frame="inset" className="mt-3 border-t border-stroke-soft-200">
        {isGardenClaim ? (
          <>
            <FactRow
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
            <FactRow
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
        <FactRow
          label={formatMessage({ id: "app.claim.row.asked" })}
          value={formatDate(new Date(request.requestedAt * 1000), {
            month: "short",
            day: "numeric",
          })}
        />
        {outcome === "DECLINED" || outcome === "WITHDRAWN" ? (
          <FactRow
            label={formatMessage({ id: "app.claim.row.reason" })}
            value={
              reason?.reason ??
              (isUnavailable || !reasonCID
                ? "—"
                : formatMessage({ id: "app.claim.row.reasonLoading" }))
            }
          />
        ) : null}
        {state !== "PENDING" && request.resolvedAt ? (
          <FactRow
            label={formatMessage({ id: "app.claim.row.resolved" })}
            value={formatDate(new Date(request.resolvedAt * 1000), {
              month: "short",
              day: "numeric",
            })}
          />
        ) : null}
      </FactList>

      {state === "DECLINED" && canAskAgain ? (
        <Button
          type="button"
          onClick={onAskAgain}
          loading={isPending}
          className="mt-3 w-full"
          leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
        >
          {formatMessage({
            id:
              commitment.claimMode === "APPROVAL_GATED"
                ? "app.claim.askAgain"
                : "app.claim.takeUpAgain",
          })}
        </Button>
      ) : null}
      {state === "SUPERSEDED" ? (
        <Button
          type="button"
          emphasis="secondary"
          onClick={onBackToBrowse}
          className="mt-3 w-full"
          leadingIcon={<RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />}
        >
          {formatMessage({ id: "app.claim.backToBrowse" })}
        </Button>
      ) : null}
    </section>
  );
}
