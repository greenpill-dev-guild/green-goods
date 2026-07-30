import { cn, DialogShell, mediaResourceManager } from "@green-goods/shared";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  useProfileAvatarEditor,
  useResolvedProfileAvatar,
} from "@green-goods/shared/profile-avatar";
import { RiCameraLine, RiDeleteBinLine, RiImageAddLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";

const AVATAR_PREVIEW_TRACKING_ID = "profile-avatar-editor";
type AvatarFailureAction = "save" | "remove" | "continue" | "discard";

interface ProfileAvatarEditorProps {
  fallbackAvatar: string;
  className?: string;
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

function failureMessage(
  action: AvatarFailureAction,
  formatMessage: ReturnType<typeof useIntl>["formatMessage"]
): string {
  const messages = {
    save: {
      id: "profile.avatar.saveError",
      defaultMessage: "We could not save your profile photo. Please try again.",
    },
    remove: {
      id: "profile.avatar.removeError",
      defaultMessage: "We could not remove your profile photo. Please try again.",
    },
    continue: {
      id: "profile.avatar.continueError",
      defaultMessage: "We could not publish your profile photo. Please try again.",
    },
    discard: {
      id: "profile.avatar.discardError",
      defaultMessage: "We could not discard your profile photo draft. Please try again.",
    },
  } as const;
  return formatMessage(messages[action]);
}

/**
 * Client-owned avatar affordance for the authenticated profile header. The
 * shared editor owns normalization, durable drafts, signing, and query refresh;
 * this surface only stages a selected file and exposes that state accessibly.
 */
export function ProfileAvatarEditor({ fallbackAvatar, className }: ProfileAvatarEditorProps) {
  const { formatMessage } = useIntl();
  const editor = useProfileAvatarEditor();
  const resolved = useResolvedProfileAvatar(undefined, fallbackAvatar);
  const isOnline = useOnlineStatus();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const displayedError =
    error ??
    (editor.error
      ? formatMessage({
          id: "profile.avatar.restoreError",
          defaultMessage: "We could not restore your saved profile photo draft.",
        })
      : null);
  const draftFile = editor.draft?.file ?? null;
  const previewSrc = selectedPreview ?? draftPreview ?? resolved.avatarUri ?? fallbackAvatar;
  const status = stageMessage(editor.stage, formatMessage);
  const recoverableDraft = Boolean(editor.draft) && !selectedFile;
  const busy = editor.isSaving || Boolean(status);
  const hasUnpublishedDraft = Boolean(selectedFile ?? draftFile);
  const saveLabel =
    resolved.source === "app"
      ? formatMessage({ id: "profile.avatar.replace", defaultMessage: "Replace photo" })
      : formatMessage({ id: "profile.avatar.save", defaultMessage: "Save photo" });

  useEffect(() => {
    setSelectedPreview(null);
    if (!selectedFile) return;
    const url = mediaResourceManager.createUrl(
      selectedFile,
      `${AVATAR_PREVIEW_TRACKING_ID}:selected`
    );
    setSelectedPreview(url);
    return () => mediaResourceManager.cleanupUrl(url);
  }, [selectedFile]);

  useEffect(() => {
    setDraftPreview(null);
    if (!draftFile) return;
    const url = mediaResourceManager.createUrl(draftFile, `${AVATAR_PREVIEW_TRACKING_ID}:draft`);
    setDraftPreview(url);
    return () => mediaResourceManager.cleanupUrl(url);
  }, [draftFile]);

  useEffect(() => {
    setSelectedFile(null);
    setError(null);
    setRemoveConfirmOpen(false);
  }, [editor.address]);

  const chooseFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    setSelectedFile(file);
  };

  const save = async () => {
    if (!selectedFile) return;
    setError(null);
    try {
      await editor.save(selectedFile);
      setSelectedFile(null);
    } catch {
      setSelectedFile(null);
      setError(failureMessage("save", formatMessage));
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await editor.clear();
      setSelectedFile(null);
    } catch {
      setError(failureMessage("remove", formatMessage));
    }
  };

  const recoverDraft = async () => {
    setError(null);
    try {
      await editor.continueAfterReconnect();
    } catch {
      setError(failureMessage("continue", formatMessage));
    }
  };

  const discardDraft = async () => {
    setError(null);
    try {
      await editor.discardDraft();
      setSelectedFile(null);
    } catch {
      setError(failureMessage("discard", formatMessage));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative block h-24 w-24 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-2",
          className
        )}
        aria-label={formatMessage({
          id: "profile.avatar.edit",
          defaultMessage: "Edit profile photo",
        })}
      >
        <img
          src={resolved.avatarUri ?? fallbackAvatar}
          alt={formatMessage({ id: "profile.avatar.alt", defaultMessage: "Profile photo" })}
          className="h-full w-full rounded-full object-cover"
        />
        {resolved.isLoading ? (
          <span className="absolute inset-0 rounded-full bg-bg-soft/70 animate-pulse" />
        ) : null}
        <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-material-solid)] bg-[rgb(var(--tone-action,var(--primary-action)))] text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]">
          <RiCameraLine className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title={formatMessage({ id: "profile.avatar.edit", defaultMessage: "Edit profile photo" })}
        description={formatMessage({
          id: "profile.avatar.privacyNotice",
          defaultMessage:
            "Your profile photo is public on IPFS. Replacing or removing it does not delete an earlier upload.",
        })}
        icon={<RiCameraLine className="h-5 w-5" />}
        size="md"
        preventClose={busy}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <img src={previewSrc} alt="" className="h-20 w-20 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              {hasUnpublishedDraft ? (
                <p className="text-sm font-medium text-text-strong" aria-live="polite">
                  {formatMessage({
                    id: "profile.avatar.unpublishedDraft",
                    defaultMessage: "This draft photo has not been published.",
                  })}
                </p>
              ) : (
                <p className="text-sm text-text-sub">
                  {formatMessage({
                    id: "profile.avatar.chooseFile",
                    defaultMessage: "Choose photo",
                  })}
                </p>
              )}
            </div>
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
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = "";
                chooseFile(file);
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
              <button
                type="button"
                onClick={recoverDraft}
                disabled={!isOnline || busy}
                className="mt-3 min-h-11 rounded-full px-3 text-sm font-medium text-primary-base hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isOnline
                  ? formatMessage({ id: "profile.avatar.continue", defaultMessage: "Continue" })
                  : formatMessage({
                      id: "profile.avatar.reconnect",
                      defaultMessage: "Reconnect to publish",
                    })}
              </button>
              <button
                type="button"
                onClick={discardDraft}
                disabled={busy}
                className="ml-2 min-h-11 rounded-full px-3 text-sm font-medium text-text-sub hover:bg-bg-weak disabled:cursor-not-allowed disabled:opacity-50"
              >
                {formatMessage({
                  id: "profile.avatar.discardDraft",
                  defaultMessage: "Discard draft",
                })}
              </button>
            </div>
          ) : null}
          {displayedError ? (
            <p role="alert" className="text-sm text-error-base">
              {displayedError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!selectedFile || busy}
              className="min-h-11 rounded-full bg-[rgb(var(--tone-action,var(--primary-action)))] px-4 py-2 text-sm font-medium text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveLabel}
            </button>
            {resolved.source === "app" ? (
              <button
                type="button"
                onClick={() => setRemoveConfirmOpen(true)}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-error-base hover:bg-error-lighter disabled:opacity-50"
              >
                <RiDeleteBinLine className="h-4 w-4" aria-hidden="true" />
                {formatMessage({ id: "profile.avatar.remove", defaultMessage: "Remove photo" })}
              </button>
            ) : null}
          </div>
        </div>
      </DialogShell>

      <DialogShell
        open={removeConfirmOpen}
        onOpenChange={setRemoveConfirmOpen}
        title={formatMessage({
          id: "profile.avatar.confirmRemove",
          defaultMessage: "Remove profile photo?",
        })}
        description={formatMessage({
          id: "profile.avatar.confirmRemoveDescription",
          defaultMessage:
            "This clears only your app profile pointer. Older IPFS uploads remain public.",
        })}
        icon={<RiDeleteBinLine className="h-5 w-5" />}
        size="md"
        preventClose={busy}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setRemoveConfirmOpen(false)}
            className="min-h-11 rounded-full px-4 py-2 text-sm font-medium text-text-sub hover:bg-bg-soft"
          >
            {formatMessage({ id: "profile.avatar.cancel", defaultMessage: "Cancel" })}
          </button>
          <button
            type="button"
            onClick={async () => {
              await remove();
              setRemoveConfirmOpen(false);
            }}
            disabled={busy}
            className="min-h-11 rounded-full bg-error-base px-4 py-2 text-sm font-medium text-static-white disabled:opacity-50"
          >
            {formatMessage({ id: "profile.avatar.remove", defaultMessage: "Remove photo" })}
          </button>
        </div>
      </DialogShell>
    </>
  );
}
