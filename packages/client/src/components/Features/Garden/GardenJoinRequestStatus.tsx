import { gardenJoinRequestErrorMessage } from "@green-goods/shared/modules/garden-join-requests";
import type { GardenJoinRequestSelfRecord } from "@green-goods/shared/public-contracts/join-requests";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiLoader4Line,
} from "@remixicon/react";
import { useIntl } from "react-intl";

type Props = {
  activity: "sending" | "checking" | "withdrawing" | "updating" | null;
  request?: GardenJoinRequestSelfRecord | null;
  uncertain: boolean;
  error?: Error | null;
  receipt?: { kind: "sent" | "checked" | "withdrawn"; text: string };
  hasCheckedStatus: boolean;
};

/**
 * One stable region: progress and outcomes never move the form below it (DL-072). It holds at
 * least the height its usual lines need and grows for a longer one, never scrolling or clipping.
 */
export function GardenJoinRequestStatus({
  activity,
  request,
  uncertain,
  error,
  receipt,
  hasCheckedStatus,
}: Props) {
  const { formatMessage } = useIntl();
  const busy = Boolean(activity);
  const problem = !busy && (uncertain || error);
  const positive = !busy && !problem && (receipt || request?.state === "welcomed");
  const Icon = busy
    ? RiLoader4Line
    : problem
      ? RiErrorWarningLine
      : positive
        ? RiCheckboxCircleLine
        : RiInformationLine;
  const title =
    activity === "checking"
      ? { id: "app.garden.joinRequest.checking", defaultMessage: "Checking for updates…" }
      : activity === "sending"
        ? { id: "app.garden.joinRequest.sending", defaultMessage: "Asking to join…" }
        : activity === "withdrawing"
          ? {
              id: "app.garden.joinRequest.withdrawing",
              defaultMessage: "Withdrawing…",
            }
          : activity === "updating"
            ? { id: "app.garden.joinRequest.updating", defaultMessage: "Updating…" }
            : problem
              ? {
                  id: "app.garden.joinRequest.attentionTitle",
                  defaultMessage: "Let’s check where this stands",
                }
              : receipt?.kind === "withdrawn"
                ? {
                    id: "app.garden.joinRequest.withdrawnTitle",
                    defaultMessage: "Withdrawn",
                  }
                : request?.state === "pending"
                  ? {
                      id: "app.garden.joinRequest.pendingTitle",
                      defaultMessage: "Waiting for a steward",
                    }
                  : request?.state === "welcomed"
                    ? {
                        id: "app.garden.joinRequest.welcomedTitle",
                        defaultMessage: "Welcome to the garden",
                      }
                    : request?.state === "declined"
                      ? {
                          id: "app.garden.joinRequest.declinedTitle",
                          defaultMessage: "A steward declined this",
                        }
                      : {
                          id: "app.garden.joinRequest.readyTitle",
                          defaultMessage: "Your Introduction",
                        };
  const description = busy
    ? formatMessage({
        id: "app.garden.joinRequest.progressDescription",
        defaultMessage: "We’re updating this. Confirm with your wallet or passkey if asked.",
      })
    : uncertain
      ? formatMessage({
          id: "app.garden.joinRequest.outcomeUnknown",
          defaultMessage:
            "We couldn’t confirm whether that was saved. Check its status before trying again.",
        })
      : error
        ? formatMessage(gardenJoinRequestErrorMessage(error))
        : receipt && receipt.kind !== "checked"
          ? receipt.text
          : request?.state === "pending"
            ? formatMessage({
                id: "app.garden.joinRequest.pendingDescription",
                defaultMessage: "A garden steward will review your introduction.",
              })
            : request?.state === "welcomed"
              ? formatMessage({
                  id: "app.garden.joinRequest.welcomedDescription",
                  defaultMessage: "Your membership is active.",
                })
              : request?.state === "declined"
                ? request.reason
                : hasCheckedStatus
                  ? formatMessage({
                      id: "app.garden.joinRequest.none",
                      defaultMessage: "You haven’t asked to join this garden yet.",
                    })
                  : formatMessage({
                      id: "app.garden.joinRequest.description",
                      defaultMessage: "Introduce yourself. A steward will review it.",
                    });

  return (
    <div
      role={problem ? "alert" : "status"}
      aria-live="polite"
      aria-atomic="true"
      aria-busy={busy}
      className={`flex min-h-28 gap-3 sm:min-h-24 rounded-[var(--radius-lg)] border p-3 [overflow-wrap:anywhere] ${problem ? "border-warning-light bg-warning-lighter text-warning-dark" : positive ? "border-success-light bg-success-lighter text-success-dark" : "border-stroke-soft-200 bg-bg-weak-50 text-text-strong-950"}`}
    >
      <Icon
        aria-hidden="true"
        className={`mt-0.5 size-5 shrink-0 ${busy ? "motion-safe:animate-spin" : ""}`}
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold">{formatMessage(title)}</p>
        {description ? <p className="text-sm">{description}</p> : null}
        {!busy && !problem && receipt?.kind === "checked" ? (
          <p className="text-xs font-medium">{receipt.text}</p>
        ) : null}
      </div>
    </div>
  );
}
