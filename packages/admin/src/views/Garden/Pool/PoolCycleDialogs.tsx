import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { Dispatch, SetStateAction } from "react";
import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { PoolTarget, type PoolWriteTarget } from "./PoolTarget";
import type { CycleDialog } from "./poolDialogState";
import { cycleName } from "./poolPresentation";

/**
 * How a season or campaign ends (hub decision 29): End reconciles an Open cycle
 * whose commitments have all finished (`closeCycle`), and Archive composts a
 * Reconciled one (`compostCycle`). They are separate acts because Archive is
 * final: the certificate composer takes only a Reconciled cycle, so the
 * dialog says so before an archived season can no longer be certified. Each
 * names the cycle, in its pool, before anything else.
 */
export function PoolCycleDialogs({
  pool,
  target,
  tone,
  cycleDialog,
  setCycleDialog,
}: {
  pool: PoolConsoleController;
  /** The pool whose cycle this is, named first in both dialogs. */
  target: PoolWriteTarget;
  tone: "garden" | "hub" | "community";
  cycleDialog: CycleDialog;
  setCycleDialog: Dispatch<SetStateAction<CycleDialog>>;
}) {
  const { formatMessage } = useIntl();
  const cycle = cycleDialog?.cycle ?? null;
  const campaign = cycle?.cycleType === "CAMPAIGN";
  const record = cycle ? cycleName(cycle, pool.cycleNames, formatMessage) : undefined;
  const close = () => setCycleDialog(null);

  return (
    <>
      <AdminConfirmDialog
        isOpen={cycleDialog?.kind === "end"}
        onClose={close}
        tone={tone}
        title={
          campaign
            ? formatMessage({
                id: "cockpit.garden.pool.endCycle.campaignTitle",
                defaultMessage: "End This Campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.endCycle.seasonTitle",
                defaultMessage: "End This Season",
              })
        }
        target={<PoolTarget target={target} record={record} />}
        description={
          campaign
            ? formatMessage({
                id: "cockpit.garden.pool.endCycle.campaignDescription",
                defaultMessage:
                  "Nobody can make or take up commitments in this campaign any more. Its record is reconciled and ready for an impact certificate.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.endCycle.seasonDescription",
                defaultMessage:
                  "Nobody can make or take up commitments in this season any more. Its record is reconciled and ready for an impact certificate, and a new season can start.",
              })
        }
        confirmLabel={
          campaign
            ? formatMessage({
                id: "cockpit.garden.pool.endCycle.campaignConfirm",
                defaultMessage: "End Campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.endCycle.seasonConfirm",
                defaultMessage: "End Season",
              })
        }
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.endCycle.keep",
          defaultMessage: "Keep Running",
        })}
        isLoading={pool.isActing}
        confirmDisabled={!pool.isOnline}
        onConfirm={async () => {
          if (!cycle) return;
          await pool.acts.closeCycle(cycle.cycleId);
          close();
        }}
      />

      <AdminConfirmDialog
        isOpen={cycleDialog?.kind === "archive"}
        onClose={close}
        tone={tone}
        variant="warning"
        title={
          campaign
            ? formatMessage({
                id: "cockpit.garden.pool.archiveCycle.campaignTitle",
                defaultMessage: "Archive This Campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.archiveCycle.seasonTitle",
                defaultMessage: "Archive This Season",
              })
        }
        target={<PoolTarget target={target} record={record} />}
        description={
          campaign
            ? formatMessage({
                id: "cockpit.garden.pool.archiveCycle.campaignDescription",
                defaultMessage:
                  "Archiving is final. After it, no impact certificate can be made for this campaign, so make one first if the garden wants it. The campaign stays readable in the pool’s history.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.archiveCycle.seasonDescription",
                defaultMessage:
                  "Archiving is final. After it, no impact certificate can be made for this season, so make one first if the garden wants it. The season stays readable in the pool’s history.",
              })
        }
        confirmLabel={
          campaign
            ? formatMessage({
                id: "cockpit.garden.pool.archiveCycle.campaignConfirm",
                defaultMessage: "Archive Campaign",
              })
            : formatMessage({
                id: "cockpit.garden.pool.archiveCycle.seasonConfirm",
                defaultMessage: "Archive Season",
              })
        }
        cancelLabel={formatMessage({
          id: "cockpit.garden.pool.archiveCycle.keep",
          defaultMessage: "Not Now",
        })}
        isLoading={pool.isActing}
        confirmDisabled={!pool.isOnline}
        onConfirm={async () => {
          if (!cycle) return;
          await pool.acts.compostCycle(cycle.cycleId);
          close();
        }}
      />
    </>
  );
}
