import { Alert } from "@green-goods/shared/components/Alert";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import {
  type PoolSetupStepState,
  useCommitmentPoolSetupSequence,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import { logger } from "@green-goods/shared/modules/app/logger";
import {
  isRetriablePoolSetupFailure,
  type PoolSetupStep,
} from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { changedSettings, planSettingsSteps, settingsActions } from "./poolSettingsPlan";
import { PoolSettingsProgress } from "./PoolSettingsProgress";
import { PoolTarget, type PoolWriteTarget } from "./PoolTarget";
import { promptCount, promptNumbers } from "./SetupFlow/setupWrites";

export interface PoolSettingsDialogProps {
  console: PoolConsoleController;
  /** The pool the settings are written to, named first. */
  target: PoolWriteTarget;
  open: boolean;
  onClose: () => void;
}

/**
 * Edit pool settings (W7@edit-pool): the agreement and the per-person
 * commitment limit, both editable for the pool's whole life. Only what changed
 * is written, the agreement first, through the same sequence as setup: the
 * dialog says how many times the wallet will ask, shows each write landing,
 * names what was saved when a write stops, retries only what is left, and ends
 * on a done state. A pin failure keeps the words on screen with nothing sent.
 */
export function PoolSettingsDialog({
  console: pool,
  target,
  open,
  onClose,
}: PoolSettingsDialogProps) {
  const { formatMessage } = useIntl();
  const purposeId = useId();
  const [purpose, setPurpose] = useState("");
  const [cap, setCap] = useState("");
  const [pinning, setPinning] = useState(false);
  const [pinFailed, setPinFailed] = useState(false);
  // Which button started the run, so the busy button is the one pressed.
  const [lastAct, setLastAct] = useState<"save" | "retry">("save");
  const sequence = useCommitmentPoolSetupSequence({
    chainId: pool.chainId,
    toastContext: "pool settings",
  });
  const status = sequence.state.status;
  const editing = status === "idle";
  const currentPurpose = pool.charter.charter?.purpose ?? "";
  const currentCapValue = pool.pool?.providerOpenCommitmentCap ?? 0n;

  // A fresh open starts from the pool's values, with no save behind it.
  useEffect(() => {
    if (!open) return;
    setPinFailed(false);
    sequence.reset();
    // `sequence.reset` is stable; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The fields follow the pool's values as they load, but only while editing:
  // once a save starts, the words on screen are the ones being written.
  useEffect(() => {
    if (!open || !editing) return;
    setPurpose(currentPurpose);
    setCap(currentCapValue === 0n ? "" : currentCapValue.toString());
  }, [open, editing, currentPurpose, currentCapValue]);

  const capValue = /^\d+$/.test(cap.trim()) ? BigInt(cap.trim()) : null;
  const capError =
    cap.trim().length > 0 && (capValue === null || capValue === 0n)
      ? formatMessage({
          id: "cockpit.garden.pool.settings.capError",
          defaultMessage: "A whole number above zero",
        })
      : undefined;
  const current = { purpose: currentPurpose, cap: currentCapValue };
  const changes = changedSettings({ purpose: purpose.trim(), cap: capValue ?? 0n }, current);
  const dirty = changes.agreement || changes.limit;
  const busy = pinning || status === "running";
  // Cancel, the X, the scrim and Escape all land here, so an edited agreement
  // or limit is never dropped silently.
  const dirtyClose = useDirtyClose({ isDirty: open && editing && dirty && !busy, onClose });
  const canSave =
    editing &&
    dirty &&
    purpose.trim().length > 0 &&
    capValue !== null &&
    capValue > 0n &&
    !busy &&
    pool.isOnline &&
    pool.poolId !== undefined;

  const stopped = status === "failed";
  const rows: PoolSetupStepState[] =
    sequence.state.steps.length > 0
      ? sequence.state.steps
      : settingsActions(changes).map((action) => ({
          action,
          status: "pending",
          hash: null,
          batched: false,
        }));
  const prompts = promptNumbers(rows, sequence.batching === "available", stopped);
  const retryable = stopped && isRetriablePoolSetupFailure(sequence.state.failure);

  const save = async () => {
    if (!canSave || capValue === null || pool.poolId === undefined) return;
    setLastAct("save");
    setPinning(true);
    setPinFailed(false);
    let steps: PoolSetupStep[];
    try {
      steps = await planSettingsSteps({
        poolId: pool.poolId,
        garden: pool.garden,
        next: { purpose: purpose.trim(), cap: capValue },
        current,
      });
    } catch (error) {
      logger.error("[PoolSettingsDialog] the agreement could not be stored", {
        error: error instanceof Error ? error.message : String(error),
      });
      setPinFailed(true);
      return;
    } finally {
      setPinning(false);
    }
    const outcome = await sequence.run(steps);
    if (outcome.status === "complete") await pool.refetch();
  };

  const retry = async () => {
    setLastAct("retry");
    const outcome = await sequence.retry();
    if (outcome.status === "complete") await pool.refetch();
  };

  // Three footers: done, a stopped save (and the retry it started), and the
  // edit, whose Save stays busy through the first run.
  const footer = (): ReactNode => {
    if (status === "complete") {
      return (
        <AdminButton type="button" variant="filled" onClick={onClose}>
          {formatMessage({ id: "app.common.done", defaultMessage: "Done" })}
        </AdminButton>
      );
    }
    if (stopped || (status === "running" && lastAct === "retry")) {
      return (
        <>
          <AdminButton type="button" variant="text" onClick={onClose} disabled={busy}>
            {formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
          </AdminButton>
          {retryable || status === "running" ? (
            <AdminButton
              type="button"
              variant="filled"
              onClick={() => void retry()}
              disabled={busy || !pool.isOnline}
              loading={status === "running"}
            >
              {formatMessage({
                id: "cockpit.garden.pool.setup.retry",
                defaultMessage: "Try Again",
              })}
            </AdminButton>
          ) : null}
        </>
      );
    }
    return (
      <>
        <AdminButton
          type="button"
          variant="text"
          onClick={() => dirtyClose.onOpenChange(false)}
          disabled={busy}
        >
          {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        </AdminButton>
        <AdminButton
          type="button"
          variant="filled"
          onClick={() => void save()}
          disabled={!canSave}
          loading={busy}
        >
          {formatMessage({
            id: "cockpit.garden.pool.settings.save",
            defaultMessage: "Save Settings",
          })}
        </AdminButton>
      </>
    );
  };

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={dirtyClose.onOpenChange}
        size="md"
        tone="garden"
        preventClose={busy}
        title={formatMessage({
          id: "cockpit.garden.pool.settings.title",
          defaultMessage: "Pool settings",
        })}
        target={<PoolTarget target={target} />}
        bodyClassName="space-y-4"
        actions={footer()}
      >
        {editing ? (
          <>
            <AdminTextArea
              id={purposeId}
              label={formatMessage({
                id: "cockpit.garden.pool.settings.purpose",
                defaultMessage: "What this pool is for",
              })}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              rows={4}
              required
              disabled={busy}
              textareaProps={{ maxLength: 2000 }}
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.garden.pool.settings.cap",
                defaultMessage: "How many commitments one person can hold at once",
              })}
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              error={capError}
              helperText={formatMessage({
                id: "cockpit.garden.pool.settings.capHelp",
                defaultMessage: "A safety limit so nobody over-commits. 24 suits most gardens.",
              })}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              disabled={busy}
              required
            />
            <p className="text-xs text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.settings.note",
                defaultMessage:
                  "Both stay editable for the pool's whole life. Changing the limit never affects commitments already made.",
              })}
            </p>
            {canSave ? (
              <p className="text-body-md font-medium text-text-strong">
                {promptCount(prompts.total, formatMessage)}
              </p>
            ) : null}
          </>
        ) : (
          <PoolSettingsProgress
            status={status}
            rows={rows}
            numbers={prompts.numbers}
            total={prompts.total}
            failure={sequence.state.failure}
            chainId={pool.chainId}
          />
        )}
        {!pool.isOnline && status !== "complete" ? (
          <Alert variant="warning">
            {formatMessage({
              id: "cockpit.garden.pool.offline",
              defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
            })}
          </Alert>
        ) : null}
        {pinFailed ? (
          <Alert variant="error">
            {formatMessage({
              id: "cockpit.garden.pool.settings.pinFailed",
              defaultMessage:
                "The agreement could not be stored, so nothing was sent. Your words are still here; try saving again.",
            })}
          </Alert>
        ) : null}
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone="garden"
      />
    </>
  );
}
