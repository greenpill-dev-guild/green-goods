import type { Address, PoolConsoleController } from "@green-goods/shared";
import type { Dispatch, SetStateAction } from "react";
import { useIntl } from "react-intl";
import { AdminConfirmDialog, AdminDialog } from "@/components/AdminDialog";
import { CommitmentDialogPanel } from "./CommitmentDialog";
import { PoolReasonDialogs } from "./PoolReasonDialogs";
import { PoolSettingsDialog } from "./PoolSettingsDialog";
import type { ConfirmDialog, FlowState, ReasonDialog } from "./poolDialogState";
import { SeedCommitmentDialog } from "./Seed";
import { PoolSetupFlow } from "./SetupFlow";

export interface PoolDialogsProps {
  pool: PoolConsoleController;
  garden: { id: Address; name: string };
  chainId: number;
  tone: "garden" | "hub" | "community";
  presentation: { inspector: "route" | "dialog"; protocolContext?: boolean };
  flow: FlowState;
  setFlow: Dispatch<SetStateAction<FlowState>>;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  seedOpen: boolean;
  setSeedOpen: Dispatch<SetStateAction<boolean>>;
  inspected: string | null;
  setInspected: Dispatch<SetStateAction<string | null>>;
  reasonDialog: ReasonDialog;
  setReasonDialog: Dispatch<SetStateAction<ReasonDialog>>;
  confirmDialog: ConfirmDialog;
  setConfirmDialog: Dispatch<SetStateAction<ConfirmDialog>>;
}

/**
 * Every dialog the pool console can open: the setup and open flows, the
 * settings sheet, the seeding console and the commitment inspector, the three
 * reasoned acts, and the three blast-radius confirmations. Split out of
 * `index.tsx`, which is at its source-structure cap.
 */
export function PoolDialogs({
  pool,
  garden,
  chainId,
  tone,
  presentation,
  flow,
  setFlow,
  settingsOpen,
  setSettingsOpen,
  seedOpen,
  setSeedOpen,
  inspected,
  setInspected,
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
        onClose={() => setFlow(null)}
      />

      <PoolSettingsDialog
        console={pool}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {presentation.inspector === "dialog" ? (
        <>
          <SeedCommitmentDialog
            open={seedOpen}
            chainId={chainId}
            garden={garden.id}
            onClose={() => setSeedOpen(false)}
            protocolContext={presentation.protocolContext}
          />
          <AdminDialog
            open={inspected !== null}
            onOpenChange={(next) => {
              if (!next) setInspected(null);
            }}
            size="lg"
            tone={tone}
            title={formatMessage({
              id: "cockpit.garden.pool.commitment.title",
              defaultMessage: "Commitment",
            })}
            bodyClassName="p-0"
          >
            {inspected ? (
              <CommitmentDialogPanel
                chainId={chainId}
                garden={garden.id}
                commitmentId={inspected}
                tone={tone}
              />
            ) : null}
          </AdminDialog>
        </>
      ) : null}

      <PoolReasonDialogs
        pool={pool}
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
          defaultMessage: "Close this pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.close.description",
          defaultMessage:
            "Closing ends participation for every member. Every cycle is finished and no commitment is live; history stays with the garden. Archiving and reopening stay available.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.close.confirm",
          defaultMessage: "Close pool",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.close.keep",
          defaultMessage: "Keep open",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.closePool();
          setConfirmDialog(null);
        }}
      />

      <AdminConfirmDialog
        isOpen={confirmDialog === "compost"}
        onClose={() => setConfirmDialog(null)}
        tone={tone}
        variant="warning"
        title={formatMessage({
          id: "cockpit.garden.pool.compost.title",
          defaultMessage: "Archive this pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.compost.description",
          defaultMessage:
            "Archiving keeps this closed pool’s seasons, commitments, reasons, and history readable. Reopening later begins from set-up.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.compost.confirm",
          defaultMessage: "Archive pool",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.compost.keep",
          defaultMessage: "Keep closed",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.compostPool();
          setConfirmDialog(null);
        }}
      />

      <AdminConfirmDialog
        isOpen={confirmDialog === "reopen"}
        onClose={() => setConfirmDialog(null)}
        tone={tone}
        title={formatMessage({
          id: "cockpit.garden.pool.reopen.title",
          defaultMessage: "Reopen this pool",
        })}
        description={formatMessage({
          id: "cockpit.garden.pool.reopen.description",
          defaultMessage:
            "Reopening moves the archived pool back to set-up. Members still cannot take part until a season opens again; history is preserved.",
        })}
        confirmLabel={formatMessage({
          id: "cockpit.garden.pool.reopen.confirm",
          defaultMessage: "Reopen to set-up",
        })}
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.reopen.keep",
          defaultMessage: "Keep archived",
        })}
        isLoading={pool.isActing}
        onConfirm={async () => {
          await pool.acts.reopenPool(false);
          setConfirmDialog(null);
        }}
      />
    </>
  );
}
