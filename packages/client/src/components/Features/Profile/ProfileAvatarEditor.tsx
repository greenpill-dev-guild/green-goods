import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
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
import {
  RiCameraLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiImageAddLine,
  RiRefreshLine,
} from "@remixicon/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";

import { Button } from "@/components/Actions/Button";

interface ProfileAvatarEditorProps {
  fallbackAvatar: string;
  className?: string;
}

interface DraftPhotoPreviewProps {
  file: File;
  alt: string;
  caption: string;
}

type ActiveAction = "choose" | "retry" | "remove" | "discard" | null;

function DraftPhotoPreview({ file, alt, caption }: DraftPhotoPreviewProps) {
  const previewUrl = useMemo(
    () => mediaResourceManager.getOrCreateUrl(file, "profile-avatar-draft"),
    [file]
  );

  useEffect(() => () => mediaResourceManager.cleanupFile(file), [file]);

  return (
    <figure className="flex items-center gap-4 rounded-[var(--radius-lg)] bg-bg-soft p-3">
      <img
        src={previewUrl}
        alt={alt}
        width={80}
        height={80}
        className="h-20 w-20 shrink-0 rounded-full object-cover"
      />
      <figcaption className="text-sm font-medium text-text-strong">{caption}</figcaption>
    </figure>
  );
}

/**
 * Compact PWA command sheet for changing the authenticated profile avatar.
 * Shared owns normalization, durable drafts, signing, and query refresh.
 */
export function ProfileAvatarEditor({ fallbackAvatar, className }: ProfileAvatarEditorProps) {
  const { formatMessage } = useIntl();
  const editor = useProfileAvatarEditor();
  const resolved = useResolvedProfileAvatar(undefined, fallbackAvatar);
  const isOnline = useOnlineStatus();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
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

  const picker = (label: string, secondary = false) => (
    <Button
      type="button"
      label={pickerInProgress ? progressLabel : label}
      leadingIcon={<RiImageAddLine className="h-5 w-5" aria-hidden="true" />}
      variant={secondary ? "neutral" : "primary"}
      mode={secondary ? "stroke" : "filled"}
      isLoading={pickerInProgress}
      disabled={busy && !pickerInProgress}
      aria-live={pickerInProgress ? "polite" : undefined}
      aria-invalid={Boolean(displayedError) || undefined}
      aria-describedby={displayedError ? `${inputId}-error` : undefined}
      onClick={() => inputRef.current?.click()}
      className="w-full justify-center"
    />
  );

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
        ariaLabel={removeConfirmOpen ? removeTitle : sheetTitle}
        panelStyle={{ height: "auto", maxHeight: "85dvh" }}
        dragToDismiss={!busy}
        testId="profile-photo-sheet"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-2">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-text-strong">
              {removeConfirmOpen ? removeTitle : sheetTitle}
            </h2>
            <p className="text-sm leading-snug text-text-sub">
              {removeConfirmOpen ? removalDescription : privacyNotice}
            </p>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            disabled={busy}
            data-testid="pwa-sheet-close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-sub transition-colors hover:bg-bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
          >
            <RiCloseLine className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={Boolean(displayedError) || undefined}
            aria-describedby={displayedError ? `${inputId}-error` : undefined}
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              event.currentTarget.value = "";
              void saveFile(file);
            }}
            disabled={busy}
            data-testid="profile-photo-input"
          />

          <p
            id={`${inputId}-error`}
            role={displayedError ? "alert" : undefined}
            tabIndex={displayedError ? 0 : undefined}
            className="text-sm text-error-base"
            style={{
              blockSize: "3lh",
              flexShrink: 0,
              overflowY: "auto",
              overflowWrap: "anywhere",
            }}
          >
            {displayedError}
          </p>

          {removeConfirmOpen ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                label={formatMessage({ id: "profile.avatar.keep", defaultMessage: "Keep Photo" })}
                variant="neutral"
                mode="stroke"
                disabled={busy}
                onClick={() => setRemoveConfirmOpen(false)}
                className="justify-center"
              />
              <Button
                type="button"
                label={
                  activeAction === "remove"
                    ? progressLabel
                    : formatMessage({
                        id: "profile.avatar.remove",
                        defaultMessage: "Remove Photo",
                      })
                }
                leadingIcon={<RiDeleteBinLine className="h-5 w-5" aria-hidden="true" />}
                variant="error"
                isLoading={activeAction === "remove"}
                disabled={busy && activeAction !== "remove"}
                aria-live={activeAction === "remove" ? "polite" : undefined}
                onClick={() => void remove()}
                className="justify-center"
              />
            </div>
          ) : recoverableDraft ? (
            <div className="flex flex-col gap-3">
              {editor.draft?.file ? (
                <DraftPhotoPreview
                  file={editor.draft.file}
                  alt={formatMessage({
                    id: "profile.avatar.draftPreviewAlt",
                    defaultMessage: "Unpublished profile photo draft",
                  })}
                  caption={formatMessage({
                    id: "profile.avatar.unpublishedDraft",
                    defaultMessage: "This draft photo has not been published.",
                  })}
                />
              ) : null}
              <Button
                type="button"
                label={
                  retryInProgress
                    ? progressLabel
                    : isOnline
                      ? formatMessage({
                          id: "profile.avatar.tryAgain",
                          defaultMessage: "Try Again",
                        })
                      : formatMessage({
                          id: "profile.avatar.reconnect",
                          defaultMessage: "Reconnect to publish",
                        })
                }
                leadingIcon={<RiRefreshLine className="h-5 w-5" aria-hidden="true" />}
                isLoading={retryInProgress}
                disabled={!isOnline || (busy && !retryInProgress)}
                aria-live={retryInProgress ? "polite" : undefined}
                onClick={() => void recoverDraft()}
                className="w-full justify-center"
              />
              {picker(
                formatMessage({
                  id: "profile.avatar.chooseDifferent",
                  defaultMessage: "Choose a Different Photo",
                }),
                true
              )}
              <Button
                type="button"
                label={formatMessage({
                  id: "profile.avatar.discardDraft",
                  defaultMessage: "Discard Draft",
                })}
                variant="error"
                mode="ghost"
                isLoading={activeAction === "discard"}
                disabled={busy && activeAction !== "discard"}
                aria-live={activeAction === "discard" ? "polite" : undefined}
                onClick={() => void discardDraft()}
                className="self-center"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {picker(pickerLabel)}
              {resolved.source === "app" ? (
                <Button
                  type="button"
                  label={formatMessage({
                    id: "profile.avatar.remove",
                    defaultMessage: "Remove Photo",
                  })}
                  leadingIcon={<RiDeleteBinLine className="h-5 w-5" aria-hidden="true" />}
                  variant="error"
                  mode="ghost"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setRemoveConfirmOpen(true);
                  }}
                  className="self-center"
                />
              ) : null}
            </div>
          )}
        </div>
      </PwaSheet>
    </>
  );
}
