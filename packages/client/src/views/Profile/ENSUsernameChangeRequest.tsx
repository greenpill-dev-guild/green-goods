import { Button } from "@green-goods/shared/components/Button";
import {
  NativeSelect,
  Textarea,
  TextInput,
} from "@green-goods/shared/components/Form/ControlPrimitives";
import { useSlugForm } from "@green-goods/shared/hooks/ens/useSlugForm";
import type { Address } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiAddLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { UsernameField } from "./UsernameField";

type ENSUsernameChangeReason = "same-passkey" | "lost-passkey" | "other";

/** Where username help happens today, for the request and for Get Help. */
export const ENS_SUPPORT_URL = "https://t.me/+N3o3_43iRec1Y2Jh";
const ENS_USERNAME_CHANGE_REQUESTS_KEY = "green-goods:ens-username-change-requests";

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
  isOpen: boolean;
  onClose: () => void;
  primaryAddress: Address;
  existingSlug: string;
}

/**
 * Change Username for a passkey account (PRD-1026 p10, p13, D8): today's
 * support request, in the same tall sheet as a wallet's change, because
 * today's Arbitrum name sender can't release a passkey account's name. It
 * collects the desired name, what happened and a contact, a note behind Add a
 * Note, then prepares a message to send to support and keeps recent requests
 * on this device as a receipt. One action per state; Close cancels or
 * finishes.
 */
export const ENSUsernameChangeRequest: React.FC<ENSUsernameChangeRequestProps> = ({
  isOpen,
  onClose,
  primaryAddress,
  existingSlug,
}) => {
  const intl = useIntl();
  const { formatMessage } = intl;
  const form = useSlugForm("");
  const requestedSlug = form.watch("slug");
  const [requestReason, setRequestReason] = useState<ENSUsernameChangeReason>("same-passkey");
  const [requestContact, setRequestContact] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [requestNotes, setRequestNotes] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
  const [preparedRequest, setPreparedRequest] = useState<{
    id: string;
    copied: boolean;
    message: string;
  } | null>(null);
  const requestReasonOptions: Array<{ value: ENSUsernameChangeReason; label: string }> = [
    {
      value: "same-passkey",
      label: formatMessage({
        id: "app.profile.ensChangeReasonSamePasskey",
        defaultMessage: "I still use this sign-in",
      }),
    },
    {
      value: "lost-passkey",
      label: formatMessage({
        id: "app.profile.ensChangeReasonLostPasskey",
        defaultMessage: "I lost access to my old sign-in",
      }),
    },
    {
      value: "other",
      label: formatMessage({
        id: "app.profile.ensChangeReasonOther",
        defaultMessage: "Something else",
      }),
    },
  ];

  // Close cancels a request not yet prepared, and finishes a prepared one.
  const close = () => {
    form.reset({ slug: "" });
    setRequestReason("same-passkey");
    setRequestContact("");
    setShowNotes(false);
    setRequestNotes("");
    setContactError(null);
    setPreparedRequest(null);
    onClose();
  };

  const handlePrepareUsernameChangeRequest = async () => {
    const slugValid = await form.trigger("slug");
    const contactValid = requestContact.trim().length >= 3;
    setContactError(
      contactValid
        ? null
        : formatMessage({
            id: "app.profile.ensChangeContactError",
            defaultMessage: "Add a Telegram handle, email, or another way to reach you.",
          })
    );
    if (!slugValid || !contactValid) return;

    const desiredSlug = form.getValues("slug");
    const requestId = createUsernameChangeRequestId(primaryAddress);
    const reasonLabel =
      requestReasonOptions.find((option) => option.value === requestReason)?.label ?? requestReason;
    // Gardener-visible message, shown in the sheet and copied to the clipboard.
    // Support can derive the underlying account from the request id and current
    // name, so it keeps only details the gardener understands.
    const message = [
      "Name change request",
      `Request ID: ${requestId}`,
      `Current name: ${existingSlug}.greengoods.eth`,
      `Desired name: ${desiredSlug}.greengoods.eth`,
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
  };

  const current = `${existingSlug}.greengoods.eth`;
  return (
    <AppSheet
      isOpen={isOpen}
      onClose={close}
      size="tall"
      header={{
        title: formatMessage({
          id: "app.profile.username.change",
          defaultMessage: "Change Username",
        }),
        description: preparedRequest
          ? formatMessage(
              { id: "app.profile.username.current", defaultMessage: "Your username is {name}." },
              { name: current }
            )
          : formatMessage(
              {
                id: "app.profile.username.currentSupport",
                defaultMessage:
                  "Your username is {name}. For passkey accounts, support helps with the change for now.",
              },
              { name: current }
            ),
      }}
      actions={{
        primary: preparedRequest
          ? {
              label: formatMessage({
                id: "app.profile.ensChangeOpenSupport",
                defaultMessage: "Open Telegram Support",
              }),
              onClick: () => window.open(ENS_SUPPORT_URL, "_blank", "noopener,noreferrer"),
            }
          : {
              label: formatMessage({
                id: "app.profile.ensChangePrepareRequestAction",
                defaultMessage: "Prepare Request",
              }),
              onClick: () => void handlePrepareUsernameChangeRequest(),
            },
      }}
    >
      {preparedRequest ? (
        <div className="flex flex-col gap-3" data-testid="ens-change-request-prepared">
          <p
            className={cn(
              "rounded-xl border p-3 text-sm",
              pwaStatusStyles.success.surface,
              pwaStatusStyles.success.border
            )}
          >
            {formatMessage(
              {
                id: "app.profile.ensChangeRequestPrepared",
                defaultMessage:
                  "Request {id} is ready. {copied, select, true {Details were copied.} other {Copy the details below.}} Send it to support so the team can help.",
              },
              { id: preparedRequest.id, copied: String(preparedRequest.copied) }
            )}
          </p>
          <label className="sr-only" htmlFor="ens-change-request-details">
            {formatMessage({
              id: "app.profile.ensChangeRequestDetails",
              defaultMessage: "Request details",
            })}
          </label>
          <Textarea
            id="ens-change-request-details"
            readOnly
            value={preparedRequest.message}
            rows={6}
            className="resize-none font-mono text-xs text-text-sub-600"
          />
          <p className="text-xs text-text-sub-600">
            {formatMessage({
              id: "app.profile.ensChangeKeepsWorking",
              defaultMessage: "Your username keeps working until support releases it.",
            })}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <UsernameField
            id="ens-change-desired"
            label={formatMessage({
              id: "app.profile.ensChangeDesiredSlug",
              defaultMessage: "Desired username",
            })}
            form={form}
            typed={requestedSlug}
          />
          <div>
            <label
              htmlFor="ens-change-reason"
              className="block text-sm font-medium text-text-strong-950"
            >
              {formatMessage({
                id: "app.profile.ensChangeReason",
                defaultMessage: "What happened?",
              })}
            </label>
            <NativeSelect
              id="ens-change-reason"
              value={requestReason}
              onChange={(event) => setRequestReason(event.target.value as ENSUsernameChangeReason)}
              className="mt-1.5"
            >
              {requestReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label
              htmlFor="ens-change-contact"
              className="block text-sm font-medium text-text-strong-950"
            >
              {formatMessage({ id: "app.profile.ensChangeContact", defaultMessage: "Contact" })}
            </label>
            <TextInput
              id="ens-change-contact"
              value={requestContact}
              onChange={(event) => setRequestContact(event.target.value)}
              invalid={contactError !== null}
              aria-describedby="ens-change-contact-hint"
              className="mt-1.5"
            />
            <p
              id="ens-change-contact-hint"
              className={cn(
                "mt-1.5 min-h-5 text-xs",
                contactError ? "text-error-dark" : "text-text-sub-600"
              )}
            >
              {contactError ??
                formatMessage({
                  id: "app.profile.ensChangeContactHint",
                  defaultMessage: "Telegram, email or phone.",
                })}
            </p>
          </div>
          {showNotes ? (
            <div>
              <label
                htmlFor="ens-change-notes"
                className="block text-sm font-medium text-text-strong-950"
              >
                {formatMessage({ id: "app.profile.ensChangeNotes", defaultMessage: "Notes" })}
              </label>
              <Textarea
                id="ens-change-notes"
                value={requestNotes}
                onChange={(event) => setRequestNotes(event.target.value)}
                placeholder={formatMessage({
                  id: "app.profile.ensChangeNotesPlaceholder",
                  defaultMessage: "Anything support should know",
                })}
                rows={3}
                className="mt-1.5 resize-none"
              />
            </div>
          ) : (
            <Button
              type="button"
              emphasis="tertiary"
              onClick={() => setShowNotes(true)}
              leadingIcon={<RiAddLine className="h-4 w-4" aria-hidden="true" />}
              className="self-start"
            >
              {formatMessage({ id: "app.profile.ensChangeAddNote", defaultMessage: "Add a Note" })}
            </Button>
          )}
        </div>
      )}
    </AppSheet>
  );
};
