import type { Address } from "@green-goods/shared/types/domain";
import { validateSlug } from "@green-goods/shared/utils/blockchain/ens";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

type ENSUsernameChangeReason = "same-passkey" | "lost-passkey" | "other";

const ENS_SUPPORT_URL = "https://t.me/+N3o3_43iRec1Y2Jh";
const ENS_USERNAME_CHANGE_REQUESTS_KEY = "green-goods:ens-username-change-requests";

function normalizeRequestedSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/\.greengoods\.eth$/, "");
}

function createUsernameChangeRequestId(owner: Address) {
  return `ens-change-${Date.now()}-${owner.slice(2, 8).toLowerCase()}`;
}

function saveUsernameChangeRequest(request: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    let parsed: unknown = [];
    const existing = window.localStorage.getItem(ENS_USERNAME_CHANGE_REQUESTS_KEY);
    parsed = existing ? (JSON.parse(existing) as unknown) : [];
    const requests = Array.isArray(parsed) ? parsed : [];
    window.localStorage.setItem(
      ENS_USERNAME_CHANGE_REQUESTS_KEY,
      JSON.stringify([request, ...requests].slice(0, 10))
    );
  } catch {
    // Local storage is best-effort; the prepared support packet still renders.
  }
}

interface ENSUsernameChangeRequestProps {
  primaryAddress: Address;
  existingSlug: string;
  /** The username card's release button toggles the form; the support note always shows. */
  isOpen: boolean;
}

/**
 * Support hand-off for username changes while sponsored release is unavailable:
 * collects the desired name and a contact, prepares a message the gardener can
 * send to support, and keeps recent requests locally as a receipt.
 */
export const ENSUsernameChangeRequest: React.FC<ENSUsernameChangeRequestProps> = ({
  primaryAddress,
  existingSlug,
  isOpen,
}) => {
  const intl = useIntl();
  const [requestedSlug, setRequestedSlug] = useState("");
  const [requestReason, setRequestReason] = useState<ENSUsernameChangeReason>("same-passkey");
  const [requestContact, setRequestContact] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [preparedRequest, setPreparedRequest] = useState<{
    id: string;
    copied: boolean;
    message: string;
  } | null>(null);
  const requestReasonOptions: Array<{ value: ENSUsernameChangeReason; label: string }> = [
    {
      value: "same-passkey",
      label: intl.formatMessage({
        id: "app.profile.ensChangeReasonSamePasskey",
        defaultMessage: "I still use this sign-in",
      }),
    },
    {
      value: "lost-passkey",
      label: intl.formatMessage({
        id: "app.profile.ensChangeReasonLostPasskey",
        defaultMessage: "I lost access to my old sign-in",
      }),
    },
    {
      value: "other",
      label: intl.formatMessage({
        id: "app.profile.ensChangeReasonOther",
        defaultMessage: "Something else",
      }),
    },
  ];

  // Toggling the form clears a stale validation error so a reopened form starts clean.
  useEffect(() => {
    setRequestError(null);
  }, [isOpen]);

  const handlePrepareUsernameChangeRequest = async () => {
    const desiredSlug = normalizeRequestedSlug(requestedSlug);
    const slugValidation = validateSlug(desiredSlug);
    if (!slugValidation.valid) {
      setRequestError(
        intl.formatMessage(
          {
            id: "app.profile.ensChangeDesiredSlugError",
            defaultMessage: "Enter a valid desired username: {error}",
          },
          { error: slugValidation.error ?? "invalid username" }
        )
      );
      return;
    }
    if (requestContact.trim().length < 3) {
      setRequestError(
        intl.formatMessage({
          id: "app.profile.ensChangeContactError",
          defaultMessage: "Add a Telegram handle, email, or another way to reach you.",
        })
      );
      return;
    }

    const requestId = createUsernameChangeRequestId(primaryAddress);
    const reasonLabel =
      requestReasonOptions.find((option) => option.value === requestReason)?.label ?? requestReason;
    // Gardener-visible message — read aloud in the support textarea and copied to clipboard.
    // Support can derive the underlying account from the request id and current name, so we
    // keep only details the gardener understands here.
    const message = [
      "Name change request",
      `Request ID: ${requestId}`,
      `Current name: ${existingSlug}`,
      `Desired name: ${desiredSlug}`,
      `Reason: ${reasonLabel}`,
      `Contact: ${requestContact.trim()}`,
      requestNotes.trim() ? `Notes: ${requestNotes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    saveUsernameChangeRequest({
      id: requestId,
      currentSlug: existingSlug,
      desiredSlug,
      owner: primaryAddress,
      reason: requestReason,
      contact: requestContact.trim(),
      notes: requestNotes.trim(),
      createdAt: new Date().toISOString(),
      message,
    });

    let copied = false;
    try {
      await navigator.clipboard?.writeText(message);
      copied = Boolean(navigator.clipboard);
    } catch {
      copied = false;
    }

    setPreparedRequest({ id: requestId, copied, message });
    setRequestError(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stroke-soft-200 bg-bg-weak-50 p-3">
      <p className="text-xs text-text-sub-600">
        {intl.formatMessage({
          id: "app.profile.ensChangeSupportDescription",
          defaultMessage:
            "Username changes need a hand from support right now. We can either help you release this name or look into recovering it if you've lost access.",
        })}
      </p>
      {isOpen && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-sub-600">
            {intl.formatMessage({
              id: "app.profile.ensChangeDesiredSlug",
              defaultMessage: "Desired username",
            })}
            <input
              value={requestedSlug}
              onChange={(event) => setRequestedSlug(event.target.value)}
              placeholder={intl.formatMessage({
                id: "app.profile.ensChangeDesiredSlugPlaceholder",
                defaultMessage: "new-name",
              })}
              inputMode="text"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              className="gg-control font-mono"
              data-size="sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-sub-600">
            {intl.formatMessage({
              id: "app.profile.ensChangeReason",
              defaultMessage: "What happened?",
            })}
            <select
              value={requestReason}
              onChange={(event) => setRequestReason(event.target.value as ENSUsernameChangeReason)}
              className="gg-control gg-control-select"
              data-size="sm"
            >
              {requestReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-sub-600">
            {intl.formatMessage({
              id: "app.profile.ensChangeContact",
              defaultMessage: "Contact",
            })}
            <input
              value={requestContact}
              onChange={(event) => setRequestContact(event.target.value)}
              placeholder={intl.formatMessage({
                id: "app.profile.ensChangeContactPlaceholder",
                defaultMessage: "@telegram, email, or phone",
              })}
              className="gg-control"
              data-size="sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-sub-600">
            {intl.formatMessage({
              id: "app.profile.ensChangeNotes",
              defaultMessage: "Notes",
            })}
            <textarea
              value={requestNotes}
              onChange={(event) => setRequestNotes(event.target.value)}
              placeholder={intl.formatMessage({
                id: "app.profile.ensChangeNotesPlaceholder",
                defaultMessage: "Anything support should know",
              })}
              rows={3}
              className="gg-control gg-control-textarea resize-none"
              data-size="sm"
            />
          </label>
          {requestError && <p className="text-xs text-error-base">{requestError}</p>}
          {preparedRequest && (
            <div
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-2 text-xs text-text-sub-600",
                pwaStatusStyles.success.surface,
                pwaStatusStyles.success.border
              )}
            >
              <p>
                {intl.formatMessage(
                  {
                    id: "app.profile.ensChangeRequestPrepared",
                    defaultMessage:
                      "Request {id} is ready. {copied, select, true {Details were copied.} other {Copy the details below.}} Send it to support so the team can help.",
                  },
                  { id: preparedRequest.id, copied: String(preparedRequest.copied) }
                )}
              </p>
              <label className="sr-only" htmlFor="ens-change-request-details">
                {intl.formatMessage({
                  id: "app.profile.ensChangeRequestDetails",
                  defaultMessage: "Request details",
                })}
              </label>
              <textarea
                id="ens-change-request-details"
                readOnly
                value={preparedRequest.message}
                rows={6}
                className="w-full resize-none rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-2 py-1 font-mono text-[11px] text-text-sub-600"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              mode="filled"
              size="small"
              onClick={handlePrepareUsernameChangeRequest}
              label={intl.formatMessage({
                id: "app.profile.ensChangePrepareRequest",
                defaultMessage: "Prepare request",
              })}
              className="w-full"
            />
            <a
              href={ENS_SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm font-medium text-primary"
            >
              {intl.formatMessage({
                id: "app.profile.ensChangeOpenSupport",
                defaultMessage: "Open Telegram Support",
              })}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
