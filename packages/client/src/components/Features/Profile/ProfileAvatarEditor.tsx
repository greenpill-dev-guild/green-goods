import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
import type {
  SheetAction,
  SheetActionsProps,
} from "@green-goods/shared/components/Dialog/SheetActions";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { Spinner } from "@green-goods/shared/components/Spinner";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  useProfileAvatarEditor,
  useResolvedProfileAvatar,
} from "@green-goods/shared/hooks/profile/useProfileAvatar";
import { mediaResourceManager } from "@green-goods/shared/modules/job-queue/media-resource-manager";
import {
  getProfileAvatarFailureMessage,
  getProfileAvatarStageMessage,
} from "@green-goods/shared/modules/profile-avatar/editor-messages";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCameraLine, RiDeleteBinLine, RiImageAddLine, RiRefreshLine } from "@remixicon/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";

interface ProfileAvatarEditorProps {
  fallbackAvatar: string;
  className?: string;
}

type ActiveAction = "choose" | "retry" | "remove" | "discard" | null;

/** Object URL for the unpublished draft, released together with the file. */
function useDraftPreviewUrl(file: File | null): string | null {
  const url = useMemo(
    () => (file ? mediaResourceManager.getOrCreateUrl(file, "profile-avatar-draft") : null),
    [file]
  );
  useEffect(() => {
    if (!file) return;
    return () => mediaResourceManager.cleanupFile(file);
  }, [file]);
  return url;
}

/**
 * The profile photo sheet (half tier). Four regions hold still across every
 * state: the shared header (title only), a fixed preview region showing the
 * current photo, the fallback, or the unpublished draft, a two-line status
 * slot (the privacy notice by default, then stage messages and errors), and
 * the shared action bar with at most two actions. A draft carries its own
 * discard control beside its pill, and removing the photo asks through the
 * shared confirmation stacked over the sheet. Shared owns normalization,
 * durable drafts, signing, and query refresh.
 */
export function ProfileAvatarEditor({ fallbackAvatar, className }: ProfileAvatarEditorProps) {
  const { formatMessage } = useIntl();
  const editor = useProfileAvatarEditor();
  const resolved = useResolvedProfileAvatar(undefined, fallbackAvatar);
  const isOnline = useOnlineStatus();
  const inputId = useId();
  const statusId = `${inputId}-status`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const draftFile = editor.draft?.file ?? null;
  const draftPreviewUrl = useDraftPreviewUrl(draftFile);
  const displayedError =
    error ??
    (editor.error
      ? formatMessage({
          id: "profile.avatar.restoreError",
          defaultMessage: "We could not restore your saved profile photo draft.",
        })
      : null);
  const status = getProfileAvatarStageMessage(editor.stage, formatMessage);
  const recoverableDraft = Boolean(editor.draft);
  const busy = editor.isSaving || activeAction !== null || Boolean(status);
  const retryInProgress =
    activeAction === "retry" || (activeAction === null && recoverableDraft && busy);
  const pickerInProgress =
    activeAction === "choose" || (activeAction === null && !recoverableDraft && busy);
  const sheetTitle = formatMessage({
    id: "profile.avatar.title",
    defaultMessage: "Profile Photo",
  });
  const removeTitle = formatMessage({
    id: "profile.avatar.confirmRemove",
    defaultMessage: "Remove profile photo?",
  });
  const privacyNotice = formatMessage({
    id: "profile.avatar.privacyNotice",
    defaultMessage: "Photos stay public on IPFS, even after replacement or removal.",
  });
  const removalDescription = formatMessage({
    id: "profile.avatar.confirmRemoveDescription",
    defaultMessage: "This removes the photo from your Green Goods profile.",
  });
  const removeLabel = formatMessage({
    id: "profile.avatar.remove",
    defaultMessage: "Remove Photo",
  });

  useEffect(() => {
    setOpen(false);
    setError(null);
    setRemoveConfirmOpen(false);
    setActiveAction(null);
  }, [editor.address]);

  const closeSheet = () => {
    if (busy) return;
    setOpen(false);
    setRemoveConfirmOpen(false);
  };

  const saveFile = async (file: File | null) => {
    if (!file || busy) return;
    setError(null);
    setActiveAction("choose");
    try {
      await editor.save(file);
      setOpen(false);
      setRemoveConfirmOpen(false);
    } catch (caught) {
      setError(getProfileAvatarFailureMessage("save", formatMessage, caught));
    } finally {
      setActiveAction(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setError(null);
    setActiveAction("remove");
    try {
      await editor.clear();
      setOpen(false);
      setRemoveConfirmOpen(false);
    } catch (caught) {
      setRemoveConfirmOpen(false);
      setError(getProfileAvatarFailureMessage("remove", formatMessage, caught));
    } finally {
      setActiveAction(null);
    }
  };

  const recoverDraft = async () => {
    if (busy || !isOnline) return;
    setError(null);
    setActiveAction("retry");
    try {
      await editor.continueAfterReconnect();
      setOpen(false);
      setRemoveConfirmOpen(false);
    } catch (caught) {
      setError(getProfileAvatarFailureMessage("continue", formatMessage, caught));
    } finally {
      setActiveAction(null);
    }
  };

  const discardDraft = async () => {
    if (busy) return;
    setError(null);
    setActiveAction("discard");
    try {
      await editor.discardDraft();
    } catch (caught) {
      setError(getProfileAvatarFailureMessage("discard", formatMessage, caught));
    } finally {
      setActiveAction(null);
    }
  };

  const progressLabel =
    status ?? formatMessage({ id: "profile.avatar.saving", defaultMessage: "Saving photo…" });
  const pickerLabel =
    resolved.source === "app"
      ? formatMessage({ id: "profile.avatar.replace", defaultMessage: "Replace Photo" })
      : formatMessage({ id: "profile.avatar.chooseFile", defaultMessage: "Choose Photo" });

  const picker = (label: string): SheetAction => ({
    label: pickerInProgress ? progressLabel : label,
    icon: <RiImageAddLine className="h-5 w-5" aria-hidden="true" />,
    loading: pickerInProgress,
    disabled: busy && !pickerInProgress,
    "aria-live": pickerInProgress ? "polite" : undefined,
    "aria-invalid": Boolean(displayedError) || undefined,
    "aria-describedby": displayedError ? statusId : undefined,
    onClick: () => inputRef.current?.click(),
  });

  // At most two actions in the pinned bar (DL-016, DL-028); the draft's
  // discard control sits beside its pill in the preview region.
  const actions: SheetActionsProps = recoverableDraft
    ? {
        primary: {
          label: retryInProgress
            ? progressLabel
            : isOnline
              ? formatMessage({ id: "profile.avatar.tryAgain", defaultMessage: "Try Again" })
              : formatMessage({
                  id: "profile.avatar.reconnect",
                  defaultMessage: "Reconnect to publish",
                }),
          icon: <RiRefreshLine className="h-5 w-5" aria-hidden="true" />,
          loading: retryInProgress,
          disabled: !isOnline || (busy && !retryInProgress),
          "aria-live": retryInProgress ? "polite" : undefined,
          onClick: () => void recoverDraft(),
        },
        secondary: picker(
          formatMessage({
            id: "profile.avatar.chooseDifferent",
            defaultMessage: "Choose a Different Photo",
          })
        ),
      }
    : {
        primary: picker(pickerLabel),
        secondary:
          resolved.source === "app"
            ? {
                label: removeLabel,
                icon: <RiDeleteBinLine className="h-5 w-5" aria-hidden="true" />,
                tone: "danger",
                disabled: busy,
                onClick: () => {
                  setError(null);
                  setRemoveConfirmOpen(true);
                },
              }
            : undefined,
      };

  const previewSrc = draftPreviewUrl ?? resolved.avatarUri ?? fallbackAvatar;
  const previewAlt = draftPreviewUrl
    ? formatMessage({
        id: "profile.avatar.draftPreviewAlt",
        defaultMessage: "Unpublished profile photo draft",
      })
    : formatMessage({
        id: "profile.avatar.currentPreviewAlt",
        defaultMessage: "Your current profile photo",
      });
  const statusText =
    displayedError ??
    status ??
    (recoverableDraft
      ? formatMessage({
          id: "profile.avatar.unpublishedDraft",
          defaultMessage: "This draft photo has not been published.",
        })
      : privacyNotice);

  return (
    <>
      <button
        type="button"
        data-pressable="trigger"
        onClick={() => setOpen(true)}
        className={cn(
          "relative block h-24 w-24 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-visible:ring-offset-2",
          className
        )}
        aria-label={formatMessage({
          id: "profile.avatar.edit",
          defaultMessage: "Edit Profile Photo",
        })}
      >
        <img
          src={resolved.avatarUri ?? fallbackAvatar}
          onError={(event) => {
            const image = event.currentTarget;
            if (image.src !== new URL(fallbackAvatar, window.location.origin).href)
              image.src = fallbackAvatar;
          }}
          alt={formatMessage({ id: "profile.avatar.alt", defaultMessage: "Profile photo" })}
          width={96}
          height={96}
          className="h-full w-full rounded-full object-cover"
        />
        {resolved.isLoading ? (
          <span className="absolute inset-0 animate-pulse rounded-full bg-bg-soft/70" />
        ) : null}
        <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-material-solid)] bg-[rgb(var(--tone-action,var(--primary-action)))] text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]">
          <RiCameraLine className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      <PwaSheet
        open={open}
        onClose={closeSheet}
        size="half"
        title={sheetTitle}
        closeLabel={formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
        preventClose={busy}
        testId="profile-photo-sheet"
        actions={actions}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={Boolean(displayedError) || undefined}
          aria-describedby={displayedError ? statusId : undefined}
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            event.currentTarget.value = "";
            void saveFile(file);
          }}
          disabled={busy}
          data-testid="profile-photo-input"
        />

        <div
          data-region="preview"
          className="flex shrink-0 flex-col items-center gap-2"
          style={{ minBlockSize: 120 }}
        >
          <span className="relative block h-20 w-20">
            <img
              src={previewSrc}
              onError={(event) => {
                const image = event.currentTarget;
                if (image.src !== new URL(fallbackAvatar, window.location.origin).href)
                  image.src = fallbackAvatar;
              }}
              alt={previewAlt}
              width={80}
              height={80}
              className={cn("h-20 w-20 rounded-full object-cover", busy && "opacity-60")}
            />
            {busy ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <Spinner size="sm" />
              </span>
            ) : null}
          </span>
          {recoverableDraft ? (
            <span className="flex items-center gap-1">
              <span className="rounded-full bg-bg-weak-50 px-2 py-1 text-xs font-medium text-text-sub-600">
                {formatMessage({
                  id: "profile.avatar.draftPill",
                  defaultMessage: "Unpublished draft",
                })}
              </span>
              <IconButton
                size="compact"
                tone="danger"
                aria-label={formatMessage({
                  id: "profile.avatar.discardDraft",
                  defaultMessage: "Discard Draft",
                })}
                loading={activeAction === "discard"}
                disabled={busy && activeAction !== "discard"}
                onClick={() => void discardDraft()}
                icon={<RiDeleteBinLine aria-hidden="true" />}
              />
            </span>
          ) : null}
        </div>

        <p
          id={statusId}
          role={displayedError ? "alert" : "status"}
          tabIndex={displayedError ? 0 : undefined}
          className={cn(
            "shrink-0 text-center text-sm",
            displayedError ? "text-error-base" : "text-text-sub-600"
          )}
          style={{ minBlockSize: "2lh", overflowWrap: "anywhere" }}
        >
          {statusText}
        </p>
      </PwaSheet>

      <ConfirmDialog
        isOpen={open && removeConfirmOpen}
        onClose={() => setRemoveConfirmOpen(false)}
        onConfirm={remove}
        title={removeTitle}
        description={removalDescription}
        confirmLabel={removeLabel}
        cancelLabel={formatMessage({ id: "profile.avatar.keep", defaultMessage: "Keep Photo" })}
        variant="danger"
        isLoading={activeAction === "remove"}
      />
    </>
  );
}
