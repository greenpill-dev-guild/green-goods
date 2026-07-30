import { mediaResourceManager, useOffline } from "@green-goods/shared";
import {
  useProfileAvatarEditor,
  useResolvedProfileAvatar,
} from "@green-goods/shared/profile-avatar";
import { RiCameraLine, RiDeleteBinLine, RiImageAddLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "../AdminButton";
import { AdminConfirmDialog, AdminDialog } from "../AdminDialog";

const AVATAR_PREVIEW_TRACKING_ID = "admin-profile-avatar-editor";

interface AccountProfileAvatarEditorProps {
  fallbackInitials: string;
}

function stageMessage(
  stage: unknown,
  formatMessage: ReturnType<typeof useIntl>["formatMessage"]
): string | null {
  switch (String(stage)) {
    case "normalizing":
      return formatMessage({ id: "profile.avatar.preparing", defaultMessage: "Preparing photo…" });
    case "uploading":
      return formatMessage({ id: "profile.avatar.uploading", defaultMessage: "Uploading photo…" });
    case "signing":
    case "saving":
      return formatMessage({ id: "profile.avatar.saving", defaultMessage: "Saving photo…" });
    default:
      return null;
  }
}

/** The admin account inspector's avatar trigger and single-purpose editor. */
export function AccountProfileAvatarEditor({ fallbackInitials }: AccountProfileAvatarEditorProps) {
  const { formatMessage } = useIntl();
  const editor = useProfileAvatarEditor();
  const resolved = useResolvedProfileAvatar();
  const { isOnline } = useOffline();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const displayedError =
    error ??
    (editor.error
      ? formatMessage({
          id: "profile.avatar.error",
          defaultMessage: "We could not save your profile photo. Please try again.",
        })
      : null);
  const selectedPreview = selectedFile
    ? mediaResourceManager.getOrCreateUrl(selectedFile, AVATAR_PREVIEW_TRACKING_ID)
    : null;
  const draftFile = editor.draft?.file ?? null;
  const draftPreview = draftFile
    ? mediaResourceManager.getOrCreateUrl(draftFile, AVATAR_PREVIEW_TRACKING_ID)
    : null;
  const previewSrc = selectedPreview ?? draftPreview ?? resolved.avatarUri;
  const status = stageMessage(editor.stage, formatMessage);
  const busy = editor.isSaving || Boolean(status);
  const recoverableDraft = Boolean(editor.draft) && !selectedFile;
  const hasUnpublishedDraft = Boolean(selectedFile ?? draftFile);
  const saveLabel =
    resolved.source === "app"
      ? formatMessage({ id: "profile.avatar.replace", defaultMessage: "Replace photo" })
      : formatMessage({ id: "profile.avatar.save", defaultMessage: "Save photo" });

  useEffect(() => () => mediaResourceManager.cleanupUrls(AVATAR_PREVIEW_TRACKING_ID), []);
  useEffect(() => {
    mediaResourceManager.cleanupUrls(AVATAR_PREVIEW_TRACKING_ID);
    setSelectedFile(null);
    setError(null);
    setRemoveConfirmOpen(false);
  }, [editor.address]);

  const save = async () => {
    if (!selectedFile) return;
    setError(null);
    try {
      await editor.save(selectedFile);
      setSelectedFile(null);
    } catch {
      setSelectedFile(null);
      setError(
        formatMessage({
          id: "profile.avatar.error",
          defaultMessage: "We could not save your profile photo. Please try again.",
        })
      );
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await editor.clear();
      setSelectedFile(null);
    } catch {
      setError(
        formatMessage({
          id: "profile.avatar.error",
          defaultMessage: "We could not save your profile photo. Please try again.",
        })
      );
    }
  };

  const continueAfterReconnect = async () => {
    setError(null);
    try {
      await editor.continueAfterReconnect();
    } catch {
      setError(
        formatMessage({
          id: "profile.avatar.error",
          defaultMessage: "We could not save your profile photo. Please try again.",
        })
      );
    }
  };

  const discardDraft = async () => {
    setError(null);
    try {
      await editor.discardDraft();
      setSelectedFile(null);
    } catch {
      setError(
        formatMessage({
          id: "profile.avatar.error",
          defaultMessage: "We could not save your profile photo. Please try again.",
        })
      );
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="account-avatar-tile relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-2"
        aria-label={formatMessage({
          id: "profile.avatar.edit",
          defaultMessage: "Edit profile photo",
        })}
      >
        {resolved.avatarUri ? (
          <img
            src={resolved.avatarUri}
            alt={formatMessage({ id: "profile.avatar.alt", defaultMessage: "Profile photo" })}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm font-semibold">{fallbackInitials}</span>
        )}
        <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--color-material-solid)] bg-[rgb(var(--tone-action,var(--primary-action)))] text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]">
          <RiCameraLine className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>

      <AdminDialog
        open={open}
        onOpenChange={setOpen}
        title={formatMessage({ id: "profile.avatar.edit", defaultMessage: "Edit profile photo" })}
        description={formatMessage({
          id: "profile.avatar.privacyNotice",
          defaultMessage:
            "Your profile photo is public on IPFS. Replacing or removing it does not delete an earlier upload.",
        })}
        icon={RiCameraLine}
        size="md"
        tone="hub"
        preventClose={busy}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {resolved.source === "app" ? (
              <AdminButton
                variant="danger"
                onClick={() => setRemoveConfirmOpen(true)}
                disabled={busy}
                leadingIcon={<RiDeleteBinLine />}
              >
                {formatMessage({ id: "profile.avatar.remove", defaultMessage: "Remove photo" })}
              </AdminButton>
            ) : null}
            <AdminButton
              variant="filled"
              onClick={save}
              disabled={!selectedFile || busy}
              loading={busy && Boolean(selectedFile)}
            >
              {saveLabel}
            </AdminButton>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="account-avatar-tile flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden">
              {previewSrc ? (
                <img src={previewSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold">{fallbackInitials}</span>
              )}
            </div>
            {hasUnpublishedDraft ? (
              <p className="text-sm font-medium text-text-strong" aria-live="polite">
                {formatMessage({
                  id: "profile.avatar.unpublishedDraft",
                  defaultMessage: "This draft photo has not been published.",
                })}
              </p>
            ) : null}
          </div>

          <label
            htmlFor={inputId}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-stroke-soft px-4 py-2 text-sm font-medium text-text-strong transition-colors hover:bg-bg-soft focus-within:ring-2 focus-within:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-within:ring-offset-2"
          >
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={formatMessage({
                id: "profile.avatar.chooseFile",
                defaultMessage: "Choose photo",
              })}
              className="sr-only"
              onChange={(event) => {
                setError(null);
                setSelectedFile(event.currentTarget.files?.[0] ?? null);
              }}
              disabled={busy}
            />
            <RiImageAddLine className="h-4 w-4" aria-hidden="true" />
            {formatMessage({ id: "profile.avatar.chooseFile", defaultMessage: "Choose photo" })}
          </label>

          {status ? (
            <output className="flex items-center gap-2 text-sm text-text-sub" aria-live="polite">
              <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden="true" />
              {status}
            </output>
          ) : null}
          {recoverableDraft ? (
            <div
              className="rounded-[var(--radius-md)] border border-stroke-soft bg-bg-soft p-3"
              aria-live="polite"
            >
              <p className="text-sm text-text-sub">
                {formatMessage({
                  id: "profile.avatar.offlineSavedForRetry",
                  defaultMessage:
                    "Your draft is saved on this device. Continue when you are connected and ready to publish it.",
                })}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AdminButton
                  variant="text"
                  size="md"
                  onClick={continueAfterReconnect}
                  disabled={!isOnline || busy}
                >
                  {isOnline
                    ? formatMessage({ id: "profile.avatar.continue", defaultMessage: "Continue" })
                    : formatMessage({
                        id: "profile.avatar.reconnect",
                        defaultMessage: "Reconnect to publish",
                      })}
                </AdminButton>
                <AdminButton variant="text" size="md" onClick={discardDraft} disabled={busy}>
                  {formatMessage({
                    id: "profile.avatar.discardDraft",
                    defaultMessage: "Discard draft",
                  })}
                </AdminButton>
              </div>
            </div>
          ) : null}
          {displayedError ? (
            <p role="alert" className="text-sm text-error-base">
              {displayedError}
            </p>
          ) : null}
        </div>
      </AdminDialog>

      <AdminConfirmDialog
        isOpen={removeConfirmOpen}
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={async () => {
          await remove();
          setRemoveConfirmOpen(false);
        }}
        title={formatMessage({
          id: "profile.avatar.confirmRemove",
          defaultMessage: "Remove profile photo?",
        })}
        description={formatMessage({
          id: "profile.avatar.confirmRemoveDescription",
          defaultMessage:
            "This clears only your app profile pointer. Older IPFS uploads remain public.",
        })}
        confirmLabel={formatMessage({
          id: "profile.avatar.remove",
          defaultMessage: "Remove photo",
        })}
        cancelLabel={formatMessage({ id: "profile.avatar.cancel", defaultMessage: "Cancel" })}
        variant="danger"
        isLoading={busy}
        tone="hub"
      />
    </>
  );
}
