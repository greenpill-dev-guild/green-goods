import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
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
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { RiUserAddLine } from "@remixicon/react";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Actions";

export function GardenJoinRequestDialog({ gardenAddress }: { gardenAddress: Address }) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const formId = useId();
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

  // The dialog's actions follow the request state and sit in the pinned bar (DL-016).
  const requestState = join.request?.state;
  const actions: SheetActionsProps =
    requestState === "pending"
      ? {
          secondary: {
            label: formatMessage({
              id: "app.garden.joinRequest.withdraw",
              defaultMessage: "Withdraw Request",
            }),
            loading: join.mutationState.isLoading,
            onClick: () => void withdraw(),
          },
        }
      : requestState === "welcomed"
        ? {
            primary: {
              label: formatMessage({
                id: "app.garden.joinRequest.claimUsername",
                defaultMessage: "Claim a Username",
              }),
              onClick: () => {
                setOpen(false);
                navigate("/profile");
              },
            },
          }
        : {
            primary: {
              label: formatMessage({
                id: "app.garden.joinRequest.send",
                defaultMessage: "Send Request",
              }),
              type: "submit",
              form: formId,
              loading: join.mutationState.isLoading,
              disabled: !displayName.trim() || outcomeUnknown || join.statusState.isLoading,
            },
            secondary: {
              label: formatMessage({
                id: "app.garden.joinRequest.checkStatus",
                defaultMessage: "Check Request Status",
              }),
              loading: join.statusState.isLoading,
              disabled: join.mutationState.isLoading,
              onClick: () => void checkStatus(),
            },
          };

  return (
    <>
      <Button
        label={formatMessage({
          id: "app.garden.joinRequest.action",
          defaultMessage: "Request to Join",
        })}
        leadingIcon={<RiUserAddLine className="h-4 w-4" />}
        variant="primary"
        mode="filled"
        size="small"
        onClick={() => setOpen(true)}
      />
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title={formatMessage({
          id: "app.garden.joinRequest.title",
          defaultMessage: "Request to Join This Garden",
        })}
        description={formatMessage({
          id: "app.garden.joinRequest.description",
          defaultMessage: "Introduce yourself. A steward will review your request.",
        })}
        size="lg"
        sheetSize="tall"
        actions={actions}
      >
        <div className="space-y-4">
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
            </section>
          ) : (
            <form id={formId} className="space-y-4" onSubmit={submit}>
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
                  className="gg-control"
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
                  className="gg-control gg-control-textarea"
                />
              </label>
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
      </DialogShell>
    </>
  );
}
