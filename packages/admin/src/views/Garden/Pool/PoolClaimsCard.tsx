import type {
  PoolConsoleController,
  VoucherConsoleView,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useWaitingForApproval } from "@green-goods/shared/hooks/admin-ui/pool/useWaitingForApproval";
import {
  type IssuerSafeThreshold,
  selectVoucherAskStage,
  type VoucherAsk,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { PoolClaimRequestRow } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";
import type { AdminDialogProps } from "@/components/AdminDialog";
import type { PoolWriteTarget } from "./PoolTarget";
import { VoucherAcceptDialog, VoucherApproveDialog } from "./VoucherAskDialogs";
import { WaitingForApprovalRow, type VoucherAskRowView } from "./WaitingForApprovalRow";
import { voucherAskAct, voucherAskDetail, voucherAskTag } from "./voucherPresentation";

export interface PoolClaimsCardProps {
  console: PoolConsoleController;
  /** The voucher bookings asked in the pool, which accept through their own path. */
  vouchers: VoucherConsoleView;
  /** The pool an acceptance writes to, named in its dialog. */
  target: PoolWriteTarget;
  /** The issuer Safe's signature rule, read from the Safe, for its approval's dialog. */
  safe?: IssuerSafeThreshold;
  tone?: AdminDialogProps["tone"];
  onDecline: (row: PoolClaimRequestRow) => void;
  /** Open the ask's promise, at its waiting list. */
  onOpen: (row: PoolClaimRequestRow) => void;
}

/**
 * Review Promises (PRD-1025, named by DL-077), at the top of the Promises tab's
 * right column: everyone asking to take up a request or an offer, for the
 * steward to approve or decline. It is always there, one quiet line when
 * nothing waits, so it never moves the promises on the left (D1, D8).
 *
 * Rows hold their place for the visit (`useWaitingForApproval`): a decision
 * turns a row into its outcome, which stays until the steward leaves the tab,
 * and a new ask joins the end marked New. Approve is one signature (hub
 * decision 31) and Decline… asks for a reason first; approving one closes the
 * others on the same promise. While the pool is paused the acts are absent,
 * not disabled: the contract refuses them, so the rows only wait.
 *
 * A voucher booking (PRD-1297 surface 6) is an ask the contract refuses to
 * approve in one tap: its issuer's Safe approves it first (Approve…), the
 * member deposits, and only then the pool's steward accepts it through
 * `acceptServiceClaim` (Accept…), each in a dialog with its facts or checks.
 */
export function PoolClaimsCard({
  console: pool,
  vouchers,
  target,
  safe,
  tone,
  onDecline,
  onOpen,
}: PoolClaimsCardProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { titles, model, isOnline, isActing, claimInFlight, acts, chainId } = pool;
  const approvals = useWaitingForApproval(pool);
  const [approving, setApproving] = useState<VoucherAsk | null>(null);
  const [accepting, setAccepting] = useState<VoucherAsk | null>(null);
  // One decision at a time: the wallet asks for one, from this card or the inspector.
  const disabled = !isOnline || isActing || claimInFlight;
  const nowMs = vouchers.now * 1000;
  const titleOf = (commitment: PoolClaimRequestRow["commitment"]) =>
    (commitment.metadataCID && titles.get(commitment.metadataCID.trim())?.title) ??
    formatMessage(
      { id: "cockpit.garden.pool.row.untitled", defaultMessage: "Promise {id}" },
      { id: commitment.commitmentId.toString() }
    );
  const titleFor = (ask: VoucherAsk | null) => {
    const row = ask && pool.claims.find((entry) => entry.claim.commitmentId === ask.commitmentId);
    return row ? titleOf(row.commitment) : "";
  };
  const voucherView = (row: PoolClaimRequestRow): VoucherAskRowView | undefined => {
    const ask = vouchers.askFor(row.claim.commitmentId, row.claim.claimant);
    if (!ask) return undefined;
    const stage = selectVoucherAskStage(ask, vouchers.now);
    const act = voucherAskAct(stage);
    return {
      tag: voucherAskTag(stage, formatMessage),
      detail: voucherAskDetail(ask, stage, intl, nowMs),
      act:
        act === "approve"
          ? {
              label: formatMessage({
                id: "cockpit.garden.pool.voucher.act.approve",
                defaultMessage: "Approve…",
              }),
              onAct: () => setApproving(ask),
            }
          : act === "accept"
            ? {
                label: formatMessage({
                  id: "cockpit.garden.pool.voucher.act.accept",
                  defaultMessage: "Accept…",
                }),
                onAct: () => setAccepting(ask),
              }
            : null,
    };
  };

  const description = model.isPaused
    ? formatMessage({
        id: "cockpit.garden.pool.claims.paused",
        defaultMessage: "Requests wait while the pool is paused.",
      })
    : approvals.decided === 0
      ? formatMessage({
          id: "cockpit.garden.pool.approvals.description",
          defaultMessage:
            "Neighbors asking to take a promise up. Approving one closes the others on that promise.",
        })
      : formatMessage(
          {
            id: "cockpit.garden.pool.approvals.decidedThisVisit",
            defaultMessage:
              "{waiting, plural, =0 {Nothing waiting now.} other {# waiting.}} {decided, plural, one {# decided this visit; it clears when you leave the Promises tab.} other {# decided this visit; they clear when you leave the Promises tab.}}",
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
            defaultMessage: "Review Promises",
          })}
        </AdminCardTitle>
        {approvals.rows.length === 0 ? (
          <p className="mt-1 type-body text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.approvals.empty",
              defaultMessage: "Nothing to review.",
            })}
          </p>
        ) : (
          <p className="mt-1 type-meta text-text-soft">{description}</p>
        )}
      </div>
      {approvals.rows.length > 0 ? (
        <ul className="divide-y divide-stroke-soft">
          {approvals.rows.map((item) => (
            <WaitingForApprovalRow
              key={item.key}
              item={item}
              title={titleOf(item.row.commitment)}
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
              voucher={voucherView(item.row)}
            />
          ))}
        </ul>
      ) : null}
      <VoucherApproveDialog
        ask={approving}
        title={titleFor(approving)}
        safe={safe}
        nowMs={nowMs}
        tone={tone}
        onClose={() => setApproving(null)}
        onApprove={vouchers.acts.approveBooking}
      />
      <VoucherAcceptDialog
        ask={accepting}
        title={titleFor(accepting)}
        target={target}
        chainId={chainId}
        now={vouchers.now}
        phase={
          accepting ? pool.claimPhase(accepting.commitmentId, accepting.buyer) : { status: "idle" }
        }
        disabled={disabled}
        tone={tone}
        onClose={() => setAccepting(null)}
        onAccept={acts.acceptServiceClaim}
      />
    </AdminCard>
  );
}
