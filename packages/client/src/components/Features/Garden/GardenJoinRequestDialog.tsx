import { Textarea, TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
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
import { chosenPasskeyUsername } from "@green-goods/shared/utils/app/text";
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

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
  // An account that already has a name requests under it: its Green Goods name,
  // then its ENS name, then the username it chose for its passkey. Only an
  // account that is just an address is asked what to be called.
  const { authMode, userName } = useAuthState();
  const greenGoodsName = useGreenGoodsEnsName(join.accountAddress);
  const ensName = useEnsName(join.accountAddress);
  // While a lookup that outranks the name in hand is still running, the name can
  // change, so nothing is shown or sent until it settles.
  const isResolvingName = greenGoodsName.isLoading || (!greenGoodsName.data && ensName.isLoading);
  const accountName = isResolvingName
    ? null
    : greenGoodsName.data || ensName.data || chosenPasskeyUsername(authMode, userName);
  const requestName = (accountName ?? displayName)
    .trim()
    .slice(0, GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH);
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
        displayName: requestName,
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
              disabled:
                !requestName || isResolvingName || outcomeUnknown || join.statusState.isLoading,
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
      <Button type="button" size="compact" onClick={() => setOpen(true)}>
        {formatMessage({
          id: "app.garden.joinRequest.action",
          defaultMessage: "Request to Join",
        })}
      </Button>
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
          {join.request?.state === "pending" ? (
            <section className="space-y-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 p-4">
              <SheetHeading>
                {formatMessage({
                  id: "app.garden.joinRequest.pendingTitle",
                  defaultMessage: "Request awaiting review",
                })}
              </SheetHeading>
              <p className="text-sm text-text-sub-600">
                {formatMessage({
                  id: "app.garden.joinRequest.pendingDescription",
                  defaultMessage: "A steward can welcome or decline your request.",
                })}
              </p>
            </section>
          ) : join.request?.state === "welcomed" ? (
            <section className="space-y-3 rounded-[var(--radius-lg)] bg-success-lighter p-4">
              <SheetHeading>
                {formatMessage({
                  id: "app.garden.joinRequest.welcomedTitle",
                  defaultMessage: "Welcome to the garden",
                })}
              </SheetHeading>
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
              {accountName ? (
                <p className="text-sm text-text-sub-600">
                  {formatMessage(
                    {
                      id: "app.garden.joinRequest.requestingAs",
                      defaultMessage: "Requesting as {name}",
                    },
                    { name: <strong className="text-text-strong-950">{requestName}</strong> }
                  )}
                </p>
              ) : isResolvingName ? null : (
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    {formatMessage({
                      id: "app.garden.joinRequest.displayName",
                      defaultMessage: "Display name",
                    })}
                  </span>
                  <TextInput
                    required
                    maxLength={GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>
              )}
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">
                  {formatMessage({
                    id: "app.garden.joinRequest.note",
                    defaultMessage: "Note (optional)",
                  })}
                </span>
                <Textarea
                  maxLength={GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH}
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </form>
          )}
          {/* Results sit under the form: above it, each one pushed the fields down. */}
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
