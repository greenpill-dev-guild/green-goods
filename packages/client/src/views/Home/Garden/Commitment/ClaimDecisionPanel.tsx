import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { Address } from "@green-goods/shared/types/domain";
import {
  type CommitmentClaimRequestRecord,
  MAX_REASON,
} from "@green-goods/shared/commitment-pooling";
import { useState } from "react";
import { useIntl } from "react-intl";

export interface ClaimDecisionPanelProps {
  /** Every request still waiting on a steward, newest first. */
  requests: CommitmentClaimRequestRecord[];
  isPending: boolean;
  onAccept: (claimant: Address) => void;
  onDecline: (claimant: Address, reason: string) => void;
}

/**
 * The steward's side of an approval-gated claim.
 *
 * A request that asks to take something up waits on acceptClaim or
 * declineClaim from a steward of the pool's garden; without this panel those
 * calls existed only in the mutation type and every such request waited
 * forever. Declining takes words, pinned and kept with the decision, so the
 * person who asked reads why.
 */
export function ClaimDecisionPanel({
  requests,
  isPending,
  onAccept,
  onDecline,
}: ClaimDecisionPanelProps) {
  const { formatMessage } = useIntl();
  const [declining, setDeclining] = useState<Address | null>(null);
  const [reason, setReason] = useState("");
  if (requests.length === 0) return null;

  return (
    <section
      className="space-y-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-3"
      data-component="ClaimDecisionPanel"
      aria-label={formatMessage({ id: "app.claim.decide.title" })}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
        {formatMessage({ id: "app.claim.decide.title" })}
      </p>
      <ul className="space-y-3">
        {requests.map((request) => (
          <li key={request.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <AddressDisplay address={request.claimant} showCopyButton={false} />
              {request.claimant.toLowerCase() !== request.requestedBy.toLowerCase() ? (
                <span className="text-xs text-text-sub-600">
                  {formatMessage({ id: "app.claim.decide.askedBy" })}{" "}
                  <AddressDisplay address={request.requestedBy} showCopyButton={false} />
                </span>
              ) : null}
            </div>
            {declining?.toLowerCase() === request.claimant.toLowerCase() ? (
              <div className="space-y-2">
                <label
                  className="block text-sm font-medium text-text-strong-950"
                  htmlFor={`decline-${request.id}`}
                >
                  {formatMessage({ id: "app.claim.decide.reasonLabel" })}
                </label>
                <textarea
                  id={`decline-${request.id}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  maxLength={MAX_REASON}
                  className="w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setDeclining(null)}
                    className="rounded-[var(--radius-lg)] border border-stroke-soft-200 px-3 py-2 text-xs font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
                  >
                    {formatMessage({ id: "app.claim.context.cancel" })}
                  </button>
                  <button
                    type="button"
                    disabled={isPending || reason.trim().length === 0}
                    aria-busy={isPending}
                    onClick={() => onDecline(request.claimant, reason.trim())}
                    className="rounded-[var(--radius-lg)] border border-error-base px-3 py-2 text-xs font-medium text-error-base tap-target-lg disabled:opacity-60"
                  >
                    {formatMessage({ id: "app.claim.decide.decline" })}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setReason("");
                    setDeclining(request.claimant);
                  }}
                  className="rounded-[var(--radius-lg)] border border-stroke-soft-200 px-3 py-2 text-xs font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
                >
                  {formatMessage({ id: "app.claim.decide.decline" })}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  aria-busy={isPending}
                  onClick={() => onAccept(request.claimant)}
                  className="rounded-[var(--radius-lg)] bg-primary-action px-3 py-2 text-xs font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
                >
                  {formatMessage({ id: "app.claim.decide.accept" })}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
