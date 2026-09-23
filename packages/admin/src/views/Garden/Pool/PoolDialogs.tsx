import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { Dispatch, SetStateAction } from "react";
import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { PoolReasonDialogs } from "./PoolReasonDialogs";
import { PoolSettingsDialog } from "./PoolSettingsDialog";
import { PoolTarget, type PoolWriteTarget } from "./PoolTarget";
import type { ConfirmDialog, FlowState, ReasonDialog } from "./poolDialogState";
import { PoolSetupFlow } from "./SetupFlow";

export interface PoolDialogsProps {
  pool: PoolConsoleController;
  /** The pool every dialog here writes to, named first in each of them. */
  target: PoolWriteTarget;
  tone: "garden" | "hub" | "community";
  flow: FlowState;
  setFlow: Dispatch<SetStateAction<FlowState>>;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  reasonDialog: ReasonDialog;
  setReasonDialog: Dispatch<SetStateAction<ReasonDialog>>;
  confirmDialog: ConfirmDialog;
  setConfirmDialog: Dispatch<SetStateAction<ConfirmDialog>>;
}

/**
 * Every dialog the pool console opens in place: the setup and open flows, the
 * settings sheet, the three reasoned acts, and the three blast-radius
 * confirmations. Each one names the pool it writes to before anything else.
 * The seeding console and the commitment inspector are routes of the Garden
 * workspace, not dialogs here.
 */
export function PoolDialogs({
  pool,
  target,
  tone,
  flow,
  setFlow,
  settingsOpen,
  setSettingsOpen,
  reasonDialog,
  setReasonDialog,
  confirmDialog,
  setConfirmDialog,
}: PoolDialogsProps) {
  const { formatMessage } = useIntl();
  return (
    <>
      <PoolSetupFlow
        open={flow !== null}
        intent={flow?.intent ?? "first-run"}
        cycle={flow?.cycle ?? null}
        console={pool}
        target={target}
        onClose={() => setFlow(null)}
      />

      <PoolSettingsDialog
        console={pool}
        target={target}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <PoolReasonDialogs
        pool={pool}
        target={target}
        tone={tone}
        reasonDialog={reasonDialog}
        setReasonDialog={setReasonDialog}
      />

      <AdminConfirmDialog
        isOpen={confirmDialog === "close"}
        onClose={() => setConfirmDialog(null)}
        tone={tone}
        variant="danger"
        title={formatMessage({
          id: "cockpit.garden.pool.close.title",
          defaultMessage: "Close This Pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.close.description",
          defaultMessage:
            "Closing ends participation for every member. Every cycle is finished and no commitment is live; history stays with the garden. Archiving and reopening stay available.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.close.confirm",
          defaultMessage: "Close Pool",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.close.keep",
          defaultMessage: "Keep Open",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.closePool();
          setConfirmDialog(null);
        }}
        target={<PoolTarget target={target} />}
      />

      <AdminConfirmDialog
        isOpen={confirmDialog === "compost"}
        onClose={() => setConfirmDialog(null)}
        tone={tone}
        variant="warning"
        title={formatMessage({
          id: "cockpit.garden.pool.compost.title",
          defaultMessage: "Archive This Pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.compost.description",
          defaultMessage:
            "Archiving keeps this closed pool’s seasons, commitments, reasons, and history readable. Reopening later begins from set-up.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.compost.confirm",
          defaultMessage: "Archive Pool",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.compost.keep",
          defaultMessage: "Keep Closed",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.compostPool();
          setConfirmDialog(null);
        }}
        target={<PoolTarget target={target} />}
      />

      <AdminConfirmDialog
        isOpen={confirmDialog === "reopen"}
        onClose={() => setConfirmDialog(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.reopen.title",
          defaultMessage: "Reopen This Pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.reopen.description",
          defaultMessage:
            "Reopening moves the archived pool back to set-up. Members still cannot take part until a season opens again; history is preserved.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.reopen.confirm",
          defaultMessage: "Reopen to Set-Up",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.reopen.keep",
          defaultMessage: "Keep Archived",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.reopenPool(false);
          setConfirmDialog(null);
        }}
        target={<PoolTarget target={target} />}
      />
    </>
  );
}
