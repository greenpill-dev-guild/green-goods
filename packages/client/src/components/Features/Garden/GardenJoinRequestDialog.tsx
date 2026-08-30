import {
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import {
  GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH,
  GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH,
} from "@green-goods/shared/public-contracts/join-requests";
import {
  gardenJoinRequestErrorMessage,
  GardenJoinRequestTransportError,
} from "@green-goods/shared/modules/garden-join-requests";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiUserAddLine } from "@remixicon/react";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { Button } from "@/components/Actions";
import { pwaDrawerStyles } from "@/components/Pwa/drawerStyles";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

export function GardenJoinRequestDialog({ gardenAddress }: { gardenAddress: Address }) {
  const { formatMessage } = useIntl();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [successMessage, setSuccessMessage] = useState<string>();
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [ignoreMutationError, setIgnoreMutationError] = useState(false);
  const isAvailable = useGardenJoinRequestAvailability();
  const join = useGardenJoinRequests(gardenAddress);
  const error = outcomeUnknown
    ? join.statusState.error
    : ((ignoreMutationError ? null : join.mutationState.error) ?? join.statusState.error);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(undefined);
    setOutcomeUnknown(false);
    setIgnoreMutationError(false);
    try {
      await join.submitRequest({
        displayName,
        note: note || undefined,
        requestedVia: "garden_detail",
      });
      setSuccessMessage(
        formatMessage({
          id: "app.garden.joinRequest.sent",
          defaultMessage: "Your request was sent to the garden stewards.",
        })
      );
    } catch (caught) {
      if (caught instanceof GardenJoinRequestTransportError && caught.outcomeUnknown) {
        setOutcomeUnknown(true);
      }
    }
  }

  async function checkStatus() {
    try {
      await join.checkStatus();
      setOutcomeUnknown(false);
      setIgnoreMutationError(true);
    } catch {
      // The persistent status error remains visible and a retry stays blocked.
    }
  }

  async function withdraw() {
    setSuccessMessage(undefined);
    await join
      .withdrawRequest()
      .then(() =>
        setSuccessMessage(
          formatMessage({
            id: "app.garden.joinRequest.withdrawn",
            defaultMessage: "Your request was withdrawn.",
          })
        )
      )
      .catch(() => undefined);
  }

  if (!isAvailable) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          label={formatMessage({
            id: "app.garden.joinRequest.action",
            defaultMessage: "Request to Join",
          })}
          leadingIcon={<RiUserAddLine className="h-4 w-4" />}
          variant="primary"
          mode="filled"
          size="small"
        />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={pwaDrawerStyles.dialogOverlay} />
        <Dialog.Content
          aria-describedby={descriptionId}
          className={cn(
            "fixed left-1/2 top-1/2 z-modal w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 p-5 focus:outline-none",
            pwaDrawerStyles.dialogSurface
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold text-text-strong-950">
                {formatMessage({
                  id: "app.garden.joinRequest.title",
                  defaultMessage: "Request to Join This Garden",
                })}
              </Dialog.Title>
              <Dialog.Description id={descriptionId} className="mt-1 text-sm text-text-sub-600">
                {formatMessage({
                  id: "app.garden.joinRequest.description",
                  defaultMessage: "Introduce yourself. A steward will review your request.",
                })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn("min-h-11 min-w-11 p-2", pwaDrawerStyles.closeButtonBase)}
                aria-label={formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
              >
                <RiCloseLine className={cn("h-5 w-5", pwaDrawerStyles.closeIcon)} />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 space-y-4">
            <div aria-live="polite" className="space-y-3">
              {successMessage ? (
                <p className="rounded-[var(--radius-md)] bg-success-lighter p-3 text-sm text-success-dark">
                  {successMessage}
                </p>
              ) : null}
              {outcomeUnknown ? (
                <p
                  role="alert"
                  className="rounded-[var(--radius-md)] bg-warning-lighter p-3 text-sm text-warning-dark"
                >
                  {formatMessage({
                    id: "app.garden.joinRequest.outcomeUnknown",
                    defaultMessage:
                      "We could not confirm whether your request was saved. Check its status before trying again.",
                  })}
                </p>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="rounded-[var(--radius-md)] bg-error-lighter p-3 text-sm text-error-dark"
                >
                  {formatMessage(gardenJoinRequestErrorMessage(error))}
                </p>
              ) : null}
            </div>

            {join.request?.state === "pending" ? (
              <section className="space-y-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-4">
                <h3 className="font-semibold">
                  {formatMessage({
                    id: "app.garden.joinRequest.pendingTitle",
                    defaultMessage: "Request awaiting review",
                  })}
                </h3>
                <p className="text-sm text-text-sub-600">
                  {formatMessage({
                    id: "app.garden.joinRequest.pendingDescription",
                    defaultMessage: "A steward can welcome or decline your request.",
                  })}
                </p>
                <Button
                  label={formatMessage({
                    id: "app.garden.joinRequest.withdraw",
                    defaultMessage: "Withdraw Request",
                  })}
                  variant="neutral"
                  mode="stroke"
                  size="small"
                  onClick={withdraw}
                  isLoading={join.mutationState.isLoading}
                />
              </section>
            ) : join.request?.state === "welcomed" ? (
              <section className="space-y-3 rounded-[var(--radius-lg)] bg-success-lighter p-4">
                <h3 className="font-semibold text-success-dark">
                  {formatMessage({
                    id: "app.garden.joinRequest.welcomedTitle",
                    defaultMessage: "Welcome to the garden",
                  })}
                </h3>
                <p className="text-sm text-text-sub-600">
                  {formatMessage({
                    id: "app.garden.joinRequest.welcomedDescription",
                    defaultMessage:
                      "Your membership is active. You can now claim a Green Goods username from your profile.",
                  })}
                </p>
                <Link
                  to="/profile"
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-4 font-semibold text-primary-base",
                    pwaStatusStyles.primary.focus
                  )}
                >
                  {formatMessage({
                    id: "app.garden.joinRequest.claimUsername",
                    defaultMessage: "Claim a username",
                  })}
                </Link>
              </section>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                {join.request?.state === "declined" ? (
                  <div className="rounded-[var(--radius-lg)] bg-warning-lighter p-3 text-sm text-warning-dark">
                    <p className="font-semibold">
                      {formatMessage({
                        id: "app.garden.joinRequest.declinedTitle",
                        defaultMessage: "This request was declined",
                      })}
                    </p>
                    {join.request.reason ? <p className="mt-1">{join.request.reason}</p> : null}
                  </div>
                ) : null}
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    {formatMessage({
                      id: "app.garden.joinRequest.displayName",
                      defaultMessage: "Display name",
                    })}
                  </span>
                  <input
                    required
                    maxLength={GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className={cn(
                      "min-h-11 w-full rounded-[var(--radius-md)] border border-stroke-soft-200 bg-bg-white-0 px-3 text-base",
                      pwaStatusStyles.primary.focus
                    )}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    {formatMessage({
                      id: "app.garden.joinRequest.note",
                      defaultMessage: "Note (optional)",
                    })}
                  </span>
                  <textarea
                    maxLength={GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH}
                    rows={4}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className={cn(
                      "w-full rounded-[var(--radius-md)] border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-base",
                      pwaStatusStyles.primary.focus
                    )}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    label={formatMessage({
                      id: "app.garden.joinRequest.send",
                      defaultMessage: "Send Request",
                    })}
                    variant="primary"
                    mode="filled"
                    size="small"
                    isLoading={join.mutationState.isLoading}
                    disabled={!displayName.trim() || outcomeUnknown || join.statusState.isLoading}
                    type="submit"
                  />
                  <Button
                    label={formatMessage({
                      id: "app.garden.joinRequest.checkStatus",
                      defaultMessage: "Check request status",
                    })}
                    variant="neutral"
                    mode="stroke"
                    size="small"
                    isLoading={join.statusState.isLoading}
                    disabled={join.mutationState.isLoading}
                    onClick={() => void checkStatus()}
                    type="button"
                  />
                </div>
              </form>
            )}
            {join.hasCheckedStatus && !join.request ? (
              <p className="text-sm text-text-sub-600" aria-live="polite">
                {formatMessage({
                  id: "app.garden.joinRequest.none",
                  defaultMessage: "You do not have a request for this garden yet.",
                })}
              </p>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
