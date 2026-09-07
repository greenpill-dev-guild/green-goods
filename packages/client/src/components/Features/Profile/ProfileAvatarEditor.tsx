import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  useProfileAvatarEditor,
  useResolvedProfileAvatar,
} from "@green-goods/shared/hooks/profile/useProfileAvatar";
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
  RiLoader4Line,
  RiRefreshLine,
} from "@remixicon/react";
import { useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";

interface ProfileAvatarEditorProps {
  fallbackAvatar: string;
  className?: string;
}

type ActiveAction = "choose" | "retry" | "remove" | "discard" | null;

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
  const sheetTitle = formatMessage({
    id: "profile.avatar.title",
    defaultMessage: "Profile Photo",
  });
  const removeTitle = formatMessage({
    id: "profile.avatar.confirmRemove",
    defaultMessage: "Remove profile photo?",
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
    } catch {
      setError(getProfileAvatarFailureMessage("save", formatMessage));
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
    } catch {
      setRemoveConfirmOpen(false);
      setError(getProfileAvatarFailureMessage("remove", formatMessage));
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
    } catch {
      setError(getProfileAvatarFailureMessage("continue", formatMessage));
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
    } catch {
      setError(getProfileAvatarFailureMessage("discard", formatMessage));
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

  const picker = (label: string) => (
    <label
      htmlFor={inputId}
      className="inline-flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-stroke-soft bg-[var(--color-material-solid)] px-4 py-3 text-left text-sm font-medium text-text-strong transition-colors hover:bg-bg-soft focus-within:ring-2 focus-within:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] focus-within:ring-offset-2"
    >
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-invalid={Boolean(displayedError) || undefined}
        aria-describedby={displayedError ? `${inputId}-error` : undefined}
        className="sr-only"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          event.currentTarget.value = "";
          void saveFile(file);
        }}
        disabled={busy}
      />
      <RiImageAddLine className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </label>
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
          alt={formatMessage({ id: "profile.avatar.alt", defaultMessage: "Profile photo" })}
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
        <header className="flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-2">
          <h2 className="min-w-0 text-lg font-semibold text-text-strong">
            {removeConfirmOpen ? removeTitle : sheetTitle}
          </h2>
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
          {removeConfirmOpen ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-text-sub">
                {formatMessage({
                  id: "profile.avatar.confirmRemoveDescription",
                  defaultMessage:
                    "This clears only your app profile pointer. Older IPFS uploads remain public.",
                })}
              </p>
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
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRemoveConfirmOpen(false)}
                  disabled={busy}
                  className="min-h-12 rounded-[var(--radius-md)] border border-stroke-soft px-4 py-3 text-sm font-medium text-text-strong hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {formatMessage({ id: "profile.avatar.keep", defaultMessage: "Keep Photo" })}
                </button>
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-error-base px-4 py-3 text-sm font-medium text-static-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <RiLoader4Line className="h-5 w-5 animate-spin" aria-hidden="true" />
                      <span aria-live="polite">{progressLabel}</span>
                    </>
                  ) : (
                    <>
                      <RiDeleteBinLine className="h-5 w-5" aria-hidden="true" />
                      <span>
                        {formatMessage({
                          id: "profile.avatar.remove",
                          defaultMessage: "Remove Photo",
                        })}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-text-sub">
                {formatMessage({
                  id: "profile.avatar.privacyNotice",
                  defaultMessage:
                    "Your profile photo is public on IPFS. Replacing or removing it does not delete an earlier upload.",
                })}
              </p>

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

              {recoverableDraft ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-text-sub">
                    {formatMessage({
                      id: "profile.avatar.offlineSavedForRetry",
                      defaultMessage:
                        "Your draft is saved on this device. Continue when you are connected and ready to publish it.",
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => void recoverDraft()}
                    disabled={!isOnline || busy}
                    className="inline-flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] bg-[rgb(var(--tone-action,var(--primary-action)))] px-4 py-3 text-left text-sm font-medium text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {retryInProgress ? (
                      <RiLoader4Line className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
                    ) : (
                      <RiRefreshLine className="h-5 w-5 shrink-0" aria-hidden="true" />
                    )}
                    <span aria-live="polite">
                      {retryInProgress
                        ? progressLabel
                        : isOnline
                          ? formatMessage({
                              id: "profile.avatar.tryAgain",
                              defaultMessage: "Try Again",
                            })
                          : formatMessage({
                              id: "profile.avatar.reconnect",
                              defaultMessage: "Reconnect to publish",
                            })}
                    </span>
                  </button>
                  {activeAction === "choose" ? (
                    <div
                      role="status"
                      className="inline-flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] bg-[rgb(var(--tone-action,var(--primary-action)))] px-4 py-3 text-sm font-medium text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]"
                    >
                      <RiLoader4Line className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
                      <span>{progressLabel}</span>
                    </div>
                  ) : (
                    picker(
                      formatMessage({
                        id: "profile.avatar.chooseDifferent",
                        defaultMessage: "Choose a Different Photo",
                      })
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => void discardDraft()}
                    disabled={busy}
                    className="min-h-11 self-start rounded-full px-3 py-2 text-sm font-medium text-text-sub hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {formatMessage({
                      id: "profile.avatar.discardDraft",
                      defaultMessage: "Discard Draft",
                    })}
                  </button>
                </div>
              ) : busy ? (
                <div
                  role="status"
                  className="inline-flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] bg-[rgb(var(--tone-action,var(--primary-action)))] px-4 py-3 text-sm font-medium text-[rgb(var(--tone-on-action,var(--primary-action-foreground)))]"
                >
                  <RiLoader4Line className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
                  <span>{progressLabel}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {picker(pickerLabel)}
                  {resolved.source === "app" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setRemoveConfirmOpen(true);
                      }}
                      disabled={busy}
                      className="inline-flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-md)] border border-error-base/30 px-4 py-3 text-left text-sm font-medium text-error-base hover:bg-error-lighter disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RiDeleteBinLine className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>
                        {formatMessage({
                          id: "profile.avatar.remove",
                          defaultMessage: "Remove Photo",
                        })}
                      </span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </PwaSheet>
    </>
  );
}
