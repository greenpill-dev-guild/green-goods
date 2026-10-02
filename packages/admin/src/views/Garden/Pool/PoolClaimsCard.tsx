import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useWaitingForApproval } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import type { PoolClaimRequestRow } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import { WaitingForApprovalRow } from "./WaitingForApprovalRow";

export interface PoolClaimsCardProps {
  console: PoolConsoleController;
  onDecline: (row: PoolClaimRequestRow) => void;
  /** Open the ask's promise, at its waiting list. */
  onOpen: (row: PoolClaimRequestRow) => void;
}

/**
 * Waiting for approval (PRD-1025), at the top of the Pool tab's right column:
 * everyone asking to take up a request or an offer, for the steward to approve
 * or decline. It is always there, one quiet line when nothing waits, so it
 * never moves the promises on the left (D1, D7, D8).
 *
 * Rows hold their place for the visit (`useWaitingForApproval`): a decision
 * turns a row into its outcome, which stays until the steward leaves the tab,
 * and a new ask joins the end marked New. Approve is one signature (hub
 * decision 31) and Decline… asks for a reason first; approving one closes the
 * others on the same promise. While the pool is paused the acts are absent,
 * not disabled: the contract refuses them, so the rows only wait.
 */
export function PoolClaimsCard({ console: pool, onDecline, onOpen }: PoolClaimsCardProps) {
  const { formatMessage } = useIntl();
  const { titles, model, isOnline, isActing, claimInFlight, acts, chainId } = pool;
  const approvals = useWaitingForApproval(pool);
  // One decision at a time: the wallet asks for one, from this card or the inspector.
  const disabled = !isOnline || isActing || claimInFlight;
  const titleOf = (row: PoolClaimRequestRow) =>
    (row.commitment.metadataCID && titles.get(row.commitment.metadataCID.trim())?.title) ??
    formatMessage(
      { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Commitment {id}" },
      { id: row.commitment.commitmentId.toString() }
    );

  const description = model.isPaused
    ? formatMessage({
        id: "cockpit.garden.pool.claims.paused",
        defaultMessage: "Requests wait while the pool is paused.",
      })
    : approvals.decided === 0
      ? formatMessage({
          id: "cockpit.garden.pool.approvals.description",
          defaultMessage: "Approving one closes the others on the same promise.",
        })
      : formatMessage(
          {
            id: "cockpit.garden.pool.approvals.decidedThisVisit",
            defaultMessage:
              "{waiting, plural, =0 {Nothing waiting now.} other {# waiting.}} {decided, plural, one {# decided this visit; it clears when you leave the Pool tab.} other {# decided this visit; they clear when you leave the Pool tab.}}",
          },
          { waiting: approvals.waiting, decided: approvals.decided }
        );

  return (
    <AdminCard
      variant="elevated"
      data-component="PoolClaimsCard"
      data-testid="pool-claims"
      id="pool-claims"
      className="space-y-2"
    >
      <div>
        <AdminCardTitle>
          {formatMessage({
            id: "cockpit.garden.pool.approvals.title",
            defaultMessage: "Waiting for approval",
          })}
        </AdminCardTitle>
        {approvals.rows.length === 0 ? (
          <p className="mt-1 body-sm text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.approvals.empty",
              defaultMessage: "Nothing waiting for approval.",
            })}
          </p>
        ) : (
          <p className="mt-1 body-xs text-text-soft">{description}</p>
        )}
      </div>
      {approvals.rows.length > 0 ? (
        <ul className="divide-y divide-stroke-soft">
          {approvals.rows.map((item) => (
            <WaitingForApprovalRow
              key={item.key}
              item={item}
              title={titleOf(item.row)}
              chainId={chainId}
              paused={model.isPaused}
              disabled={disabled}
              onOpen={() => onOpen(item.row)}
              onApprove={() =>
                void acts
                  .acceptClaim(item.row.claim.commitmentId, item.row.claim.claimant)
                  .catch(() => undefined)
              }
              onDecline={() => onDecline(item.row)}
            />
          ))}
        </ul>
      ) : null}
    </AdminCard>
  );
}
