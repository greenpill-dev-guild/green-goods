import { Alert } from "@green-goods/shared/components/Alert";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useDirtyClose } from "@green-goods/shared/hooks/admin-ui/useDirtyClose";
import { logger } from "@green-goods/shared/modules/app/logger";
import { isPoolDocumentPinError } from "@green-goods/shared/modules/commitment-pooling/pool-charter";
import { useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";

export interface PoolSettingsDialogProps {
  console: PoolConsoleController;
  open: boolean;
  onClose: () => void;
}

/**
 * Edit pool settings (W7@edit-pool): the charter sentence and the
 * per-person commitment limit. Both stay editable for the pool's whole life;
 * changing the limit never affects commitments already made. The charter is
 * pinned before `setPoolCharter`, and a pin failure keeps the dialog open with
 * the words intact.
 */
export function PoolSettingsDialog({ console: pool, open, onClose }: PoolSettingsDialogProps) {
  const { formatMessage } = useIntl();
  const purposeId = useId();
  const [purpose, setPurpose] = useState("");
  const [cap, setCap] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<"pin" | "send" | null>(null);
  const currentPurpose = pool.charter.charter?.purpose ?? "";
  const currentCap = (pool.pool?.providerOpenCommitmentCap ?? 0n).toString();

  useEffect(() => {
    if (open) {
      setPurpose(currentPurpose);
      setCap(currentCap === "0" ? "" : currentCap);
      setFailure(null);
    }
  }, [open, currentPurpose, currentCap]);

  const capValue = /^\d+$/.test(cap.trim()) ? BigInt(cap.trim()) : null;
  const capError =
    cap.trim().length > 0 && (capValue === null || capValue === 0n)
      ? formatMessage({
          id: "cockpit.garden.pool.settings.capError",
          defaultMessage: "A whole number above zero",
        })
      : undefined;
  const dirty = purpose.trim() !== currentPurpose || (capValue ?? 0n) !== BigInt(currentCap);
  // Cancel, the X, the scrim and Escape all land here, so an edited purpose or
  // cap is never dropped silently — the same guard the setup and seed flows use.
  const dirtyClose = useDirtyClose({ isDirty: open && dirty && !saving, onClose });
  const canSave =
    dirty &&
    purpose.trim().length > 0 &&
    capValue !== null &&
    capValue > 0n &&
    !saving &&
    pool.isOnline;

  const save = async () => {
    if (!canSave || capValue === null) return;
    setSaving(true);
    setFailure(null);
    try {
      await pool.acts.saveSettings({ purpose: purpose.trim(), cap: capValue });
      onClose();
    } catch (error) {
      logger.error("[PoolSettingsDialog] save failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      setFailure(isPoolDocumentPinError(error) ? "pin" : "send");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={dirtyClose.onOpenChange}
        size="md"
        tone="garden"
        preventClose={saving}
        title={formatMessage({
          id: "cockpit.garden.pool.settings.title",
          defaultMessage: "Pool settings",
        })}
        bodyClassName="space-y-4"
        actions={
          <>
            <AdminButton
              type="button"
              variant="text"
              onClick={() => dirtyClose.onOpenChange(false)}
              disabled={saving}
            >
              {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton
              type="button"
              variant="filled"
              onClick={() => void save()}
              disabled={!canSave}
              loading={saving}
            >
              {formatMessage({
                id: "cockpit.garden.pool.settings.save",
                defaultMessage: "Save Settings",
              })}
            </AdminButton>
          </>
        }
      >
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
          disabled={saving}
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
          disabled={saving}
          required
        />
        <p className="text-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.settings.note",
            defaultMessage:
              "Both stay editable for the pool's whole life. Changing the limit never affects commitments already made.",
          })}
        </p>
        {!pool.isOnline ? (
          <Alert variant="warning">
            {formatMessage({
              id: "cockpit.garden.pool.offline",
              defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
            })}
          </Alert>
        ) : null}
        {failure === "pin" ? (
          <Alert variant="error">
            {formatMessage({
              id: "cockpit.garden.pool.settings.pinFailed",
              defaultMessage:
                "The agreement could not be stored, so nothing was sent. Your words are still here; try saving again.",
            })}
          </Alert>
        ) : failure === "send" ? (
          <Alert variant="error">
            {formatMessage({
              id: "cockpit.garden.pool.settings.sendFailed",
              defaultMessage: "The change was not recorded. Try again.",
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
