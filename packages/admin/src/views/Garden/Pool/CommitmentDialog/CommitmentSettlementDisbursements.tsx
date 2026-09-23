import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type { CommitmentSettlementController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { SettlementDisbursementView } from "@green-goods/shared/modules/commitment-pooling/settlement-workflow";
import { useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminReasonDialog } from "@/components/AdminReasonDialog";
import { formatGdollar, shortAddress } from "../poolFundingPresentation";
import { type TransferAct, TransferReviewDialog } from "../TransferReviewDialog";
import { displayChip } from "./commitmentSettlementPresentation";

type RowAct = TransferAct;
type OpenDialog = { act: RowAct | "cancel"; disbursementId: bigint } | null;

/**
 * Every child disbursement of the payout plan with the state the chain
 * reports and only the acts LifecycleLib still accepts for that state: dispatch
 * a queued child, resend the same command for a dispatched one, start a new
 * attempt for a failed one, or cancel an unbatched queued or failed one with
 * a recorded reason.
 */
export function CommitmentSettlementDisbursements({
  settlement,
  tone,
}: {
  settlement: CommitmentSettlementController;
  tone: "garden" | "hub" | "community";
}) {
  const intl = useIntl();
  const { formatMessage, locale } = intl;
  const [open, setOpen] = useState<OpenDialog>(null);
  const rows = settlement.workflow.disbursements;
  if (rows.length === 0) return null;
  const who = (address: string) => shortAddress(address as `0x${string}`);
  const idLabel = (id: bigint) => `#${id.toString()}`;

  const runRowAct = async (act: RowAct, disbursementId: bigint) => {
    const hash = await (act === "dispatch"
      ? settlement.acts.dispatch(disbursementId)
      : act === "retry"
        ? settlement.acts.retry(disbursementId)
        : settlement.acts.requeue(disbursementId));
    toastService.success({
      title: formatMessage({
        id: "cockpit.garden.pool.settlement.toast.confirmed",
        defaultMessage: "Settlement step confirmed",
      }),
      message: `${idLabel(disbursementId)} · ${hash.slice(0, 10)}…`,
    });
  };

  const rowActions = (view: SettlementDisbursementView) => {
    const id = view.disbursement.disbursementId;
    const disabled = settlement.isActing;
    return (
      <div className="flex flex-wrap justify-end gap-1">
        {view.actions.dispatch ? (
          <AdminButton
            type="button"
            variant="filled"
            size="sm"
            disabled={disabled}
            onClick={() => setOpen({ act: "dispatch", disbursementId: id })}
          >
            {formatMessage({
              id: "cockpit.garden.pool.settlement.act.dispatch",
              defaultMessage: "Dispatch…",
            })}
          </AdminButton>
        ) : null}
        {view.actions.retry ? (
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            disabled={disabled}
            onClick={() => setOpen({ act: "retry", disbursementId: id })}
          >
            {formatMessage({
              id: "cockpit.garden.pool.settlement.act.retry",
              defaultMessage: "Retry Command…",
            })}
          </AdminButton>
        ) : null}
        {view.actions.requeue ? (
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            disabled={disabled}
            onClick={() => setOpen({ act: "requeue", disbursementId: id })}
          >
            {formatMessage({
              id: "cockpit.garden.pool.settlement.act.requeue",
              defaultMessage: "Requeue…",
            })}
          </AdminButton>
        ) : null}
        {view.actions.cancel ? (
          <AdminButton
            type="button"
            variant="danger"
            size="sm"
            disabled={disabled}
            onClick={() => setOpen({ act: "cancel", disbursementId: id })}
          >
            {formatMessage({
              id: "cockpit.garden.pool.settlement.act.cancel",
              defaultMessage: "Cancel…",
            })}
          </AdminButton>
        ) : null}
      </div>
    );
  };

  const openView = open
    ? rows.find((row) => row.disbursement.disbursementId === open.disbursementId)
    : undefined;

  return (
    <div className="space-y-2" data-component="CommitmentSettlementDisbursements">
      <h5 className="label-sm text-text-soft">
        {formatMessage({
          id: "cockpit.garden.pool.settlement.disbursements",
          defaultMessage: "Disbursements",
        })}
      </h5>
      <ul className="space-y-2">
        {rows.map((view) => {
          const chip = displayChip(view.display, intl);
          const { disbursement } = view;
          return (
            <li
              key={disbursement.disbursementId.toString()}
              className="space-y-1 rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container))] p-3"
              data-disbursement={disbursement.disbursementId.toString()}
              data-display={view.display}
            >
              <div className="flex items-center justify-between gap-2 text-body-md">
                <span className="text-text-strong">
                  {formatMessage(
                    {
                      id: "cockpit.garden.pool.settlement.disbursement.row",
                      defaultMessage: "{id} · {amount} to {recipient}",
                    },
                    {
                      id: idLabel(disbursement.disbursementId),
                      amount: formatGdollar(disbursement.amount, locale),
                      recipient: who(disbursement.recipient),
                    }
                  )}
                </span>
                <StatusBadge variant={chip.variant} size="sm">
                  {chip.label}
                </StatusBadge>
              </div>
              {rowActions(view)}
            </li>
          );
        })}
      </ul>

      <TransferReviewDialog
        review={
          open && open.act !== "cancel"
            ? { act: open.act, disbursementId: open.disbursementId }
            : null
        }
        amount={openView?.disbursement.amount ?? null}
        recipient={openView ? who(openView.disbursement.recipient) : "—"}
        tone={tone}
        isLoading={settlement.isActing}
        onClose={() => setOpen(null)}
        onConfirm={async () => {
          if (!open || open.act === "cancel") return;
          await runRowAct(open.act, open.disbursementId);
        }}
      />
      <AdminReasonDialog
        isOpen={open?.act === "cancel"}
        onClose={() => setOpen(null)}
        tone={tone}
        variant="danger"
        title={formatMessage(
          {
            id: "cockpit.garden.pool.settlement.cancel.title",
            defaultMessage: "Cancel disbursement {id}",
          },
          { id: open ? idLabel(open.disbursementId) : "" }
        )}
        description={formatMessage({
          id: "cockpit.garden.pool.settlement.cancel.body",
          defaultMessage:
            "The disbursement stays recorded as cancelled with your reason. The payout plan keeps its pointer to this commitment.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.settlement.cancel.confirm",
          defaultMessage: "Cancel Disbursement",
        })}
        isLoading={settlement.isActing}
        onConfirm={async (reason) => {
          if (!open) return;
          await settlement.acts.cancel(open.disbursementId, reason);
          setOpen(null);
        }}
        onError={() => undefined}
      />
    </div>
  );
}
