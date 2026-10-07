import { Textarea, TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { useAuthState } from "@green-goods/shared/hooks/auth/useAuth";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import {
  useGardenJoinRequestActivity,
  useGardenJoinRequestAvailability,
  useGardenJoinRequests,
} from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import {
  GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH,
  GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH,
} from "@green-goods/shared/public-contracts/join-requests";
import { GardenJoinRequestTransportError } from "@green-goods/shared/modules/garden-join-requests";
import type { Address } from "@green-goods/shared/types/domain";
import { chosenPasskeyUsername } from "@green-goods/shared/utils/app/text";
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { RiCloseCircleLine, RiRefreshLine, RiSendPlaneLine } from "@remixicon/react";
import { GardenJoinRequestStatus } from "./GardenJoinRequestStatus";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

export function GardenJoinRequestDialog({ gardenAddress }: { gardenAddress: Address }) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [successMessage, setSuccessMessage] = useState<{
    kind: "sent" | "checked" | "withdrawn";
    text: string;
  }>();
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [feedbackRevision, setFeedbackRevision] = useState(0);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [ignoreMutationError, setIgnoreMutationError] = useState(false);
  const isAvailable = useGardenJoinRequestAvailability();
  const join = useGardenJoinRequests(gardenAddress);
  const feedback = useGardenJoinRequestActivity(join.scopeKey);
  const busy =
    Boolean(feedback.activity) || join.mutationState.isLoading || join.statusState.isLoading;
  const currentScope = useRef(join.scopeKey);
  currentScope.current = join.scopeKey;
  const [feedbackScope, setFeedbackScope] = useState(join.scopeKey);
  if (feedbackScope !== join.scopeKey) {
    setFeedbackScope(join.scopeKey);
    setFeedbackRevision(0);
    setDisplayName("");
    setNote("");
    setSuccessMessage(undefined);
    setOutcomeUnknown(false);
    setIgnoreMutationError(false);
  }
  // Explicit actions bring their result into the sheet viewport, even after
  // scrolling the form. Silent on-open reconciliation leaves reading position alone.
  useLayoutEffect(() => {
    if (open && feedbackRevision > 0) {
      feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
  }, [open, feedbackRevision]);
  const uncertain = outcomeUnknown || join.outcomeUnknown;
  // An account that already has a name requests under it: its Green Goods name,
  // then its ENS name, then the username it chose for its passkey. Only an
  // account that is just an address is asked what to be called.
  const { authMode, userName } = useAuthState();
  const greenGoodsName = useGreenGoodsEnsName(join.accountAddress);
  const ensName = useEnsName(join.accountAddress);
  // While a lookup that outranks the name in hand is still running, the name can
  // change, so nothing is shown or sent until it settles. This reads `isFetching`,
  // not `isLoading`: a cached empty answer refetching in the background (claiming a
  // username invalidates these keys) would otherwise look settled and let a request
  // go out under a lower-priority name. A lookup that fails falls through to the next
  // name and finally to the display-name field, which is what every account was asked
  // before: a name service being down must not block a request, and the request is
  // tied to the account's address either way.
  const isResolvingName = greenGoodsName.isFetching || (!greenGoodsName.data && ensName.isFetching);
  const accountName = isResolvingName
    ? null
    : greenGoodsName.data || ensName.data || chosenPasskeyUsername(authMode, userName);
  const requestName = (accountName ?? displayName)
    .trim()
    .slice(0, GARDEN_JOIN_REQUEST_DISPLAY_NAME_MAX_LENGTH);
  const error = uncertain
    ? join.statusState.error
    : ((ignoreMutationError ? null : join.mutationState.error) ?? join.statusState.error);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(undefined);
    setFeedbackRevision((value) => value + 1);
    setOutcomeUnknown(false);
    setIgnoreMutationError(false);
    const scope = join.scopeKey;
    try {
      const completed = await feedback.run("sending", () =>
        join.submitRequest({
          displayName: requestName,
          note: note || undefined,
          requestedVia: "garden_detail",
        })
      );
      if (currentScope.current !== scope || !completed?.value) return;
      setSuccessMessage({
        kind: "sent",
        text: formatMessage({
          id: "app.garden.joinRequest.sent",
          defaultMessage: "Your request was sent to the garden stewards.",
        }),
      });
    } catch (caught) {
      if (
        currentScope.current === scope &&
        caught instanceof GardenJoinRequestTransportError &&
        caught.outcomeUnknown
      ) {
        setOutcomeUnknown(true);
      }
    } finally {
      if (currentScope.current === scope) setFeedbackRevision((value) => value + 1);
    }
  }

  async function checkStatus(allowSignature = true) {
    const scope = join.scopeKey;
    if (allowSignature) {
      setSuccessMessage(undefined);
      setFeedbackRevision((value) => value + 1);
    }
    try {
      if (allowSignature) {
        const completed = await feedback.run("checking", () =>
          join.checkStatus({ allowSignature })
        );
        if (!completed) return;
      } else {
        await join.checkStatus({ allowSignature });
      }
      if (currentScope.current !== scope) return;
      setOutcomeUnknown(false);
      setIgnoreMutationError(true);
      if (allowSignature) {
        setSuccessMessage({
          kind: "checked",
          text: formatMessage({
            id: "app.garden.joinRequest.statusChecked",
            defaultMessage: "Checked just now.",
          }),
        });
      }
    } catch {
      // The persistent status error remains visible and a retry stays blocked.
    } finally {
      if (allowSignature && currentScope.current === scope) {
        setFeedbackRevision((value) => value + 1);
      }
    }
  }

  async function withdraw() {
    const scope = join.scopeKey;
    setSuccessMessage(undefined);
    setIgnoreMutationError(false);
    setFeedbackRevision((value) => value + 1);
    try {
      const completed = await feedback.run("withdrawing", () => join.withdrawRequest());
      if (!completed?.value || currentScope.current !== scope) return;
      setSuccessMessage({
        kind: "withdrawn",
        text: formatMessage({
          id: "app.garden.joinRequest.withdrawn",
          defaultMessage:
            "Your request was withdrawn. You can send a new one whenever you’re ready.",
        }),
      });
    } catch {
      // The data hook retains the failure and the request for recovery.
    } finally {
      if (currentScope.current === scope) setFeedbackRevision((value) => value + 1);
    }
  }

  if (!isAvailable) return null;

  // The dialog's actions follow the request state and sit in the pinned bar (DL-016).
  const actionLabels = {
    send: formatMessage({
      id: "app.garden.joinRequest.send",
      defaultMessage: "Send Request",
    }),
    check: formatMessage({
      id: "app.garden.joinRequest.checkStatus",
      defaultMessage: "Check Request Status",
    }),
    withdraw: formatMessage({
      id: "app.garden.joinRequest.withdraw",
      defaultMessage: "Withdraw Request",
    }),
  };
  // Reserve the largest action label so changing request state cannot move the buttons.
  function actionLabel(idle: string, pending: string, loading: boolean) {
    return (
      <span className="grid">
        {Object.values(actionLabels).map((label) => (
          <span key={label} aria-hidden="true" className="invisible col-start-1 row-start-1">
            {label}
          </span>
        ))}
        <span className="col-start-1 row-start-1">{loading ? pending : idle}</span>
      </span>
    );
  }
  const requestState = join.request?.state;
  const actions: SheetActionsProps =
    requestState === "pending"
      ? {
          primary: {
            label: actionLabel(
              actionLabels.check,
              formatMessage({
                id: "app.garden.joinRequest.checkingAction",
                defaultMessage: "Checking…",
              }),
              feedback.activity === "checking" || join.statusState.isLoading
            ),
            icon: <RiRefreshLine aria-hidden="true" className="size-4" />,
            loading: feedback.activity === "checking" || join.statusState.isLoading,
            disabled: busy,
            onClick: () => void checkStatus(),
          },
          secondary: {
            label: actionLabel(
              actionLabels.withdraw,
              formatMessage({
                id: "app.garden.joinRequest.withdrawingAction",
                defaultMessage: "Withdrawing…",
              }),
              feedback.activity === "withdrawing"
            ),
            icon: <RiCloseCircleLine aria-hidden="true" className="size-4" />,
            loading: feedback.activity === "withdrawing" || join.mutationState.isLoading,
            disabled: busy,
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
              label: actionLabel(
                actionLabels.send,
                formatMessage({
                  id: "app.garden.joinRequest.sendingAction",
                  defaultMessage: "Sending…",
                }),
                feedback.activity === "sending"
              ),
              icon: <RiSendPlaneLine aria-hidden="true" className="size-4" />,
              type: "submit",
              form: formId,
              loading: feedback.activity === "sending" || join.mutationState.isLoading,
              disabled: !requestName || isResolvingName || uncertain || busy,
            },
            secondary: {
              label: actionLabel(
                actionLabels.check,
                formatMessage({
                  id: "app.garden.joinRequest.checkingAction",
                  defaultMessage: "Checking…",
                }),
                feedback.activity === "checking" || join.statusState.isLoading
              ),
              icon: <RiRefreshLine aria-hidden="true" className="size-4" />,
              loading: feedback.activity === "checking" || join.statusState.isLoading,
              disabled: busy,
              onClick: () => void checkStatus(),
            },
          };

  return (
    <>
      <Button
        type="button"
        size="compact"
        onClick={() => {
          setSuccessMessage(undefined);
          setFeedbackRevision(0);
          setOpen(true);
          if (join.canRefreshStatus) void checkStatus(false);
        }}
      >
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
          id: "app.garden.joinRequest.overview",
          defaultMessage: "Follow your request to join this garden.",
        })}
        size="lg"
        sheetSize="full"
        bodyClassName="sm:h-[30rem]"
        actions={actions}
      >
        <div className="space-y-4">
          <div ref={feedbackRef}>
            <GardenJoinRequestStatus
              activity={
                feedback.activity ??
                (join.statusState.isLoading
                  ? "checking"
                  : join.mutationState.isLoading
                    ? "updating"
                    : null)
              }
              request={join.request}
              uncertain={uncertain}
              error={error}
              receipt={successMessage}
              hasCheckedStatus={join.hasCheckedStatus}
            />
          </div>
          {join.request?.state !== "pending" && join.request?.state !== "welcomed" ? (
            <form id={formId} className="space-y-4" onSubmit={submit}>
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
                    disabled={busy}
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
                  disabled={busy}
                  maxLength={GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH}
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </form>
          ) : null}
          {!join.request ? (
            <p className="text-sm text-text-sub-600">
              {formatMessage({
                id: "app.garden.joinRequest.signingExplanation",
                defaultMessage:
                  "Confirm with your wallet or passkey to send your request and check for updates. There’s no fee.",
              })}
            </p>
          ) : null}
        </div>
      </DialogShell>
    </>
  );
}
