import type { IntlShape } from "react-intl";
import { ProfileAvatarTransportError } from "./types";
import { isPasskeyCredentialUnavailableError } from "../../utils/errors/tx-error-classifier";

export type ProfileAvatarFailureAction = "save" | "remove" | "continue" | "discard";

export function getProfileAvatarStageMessage(
  stage: unknown,
  formatMessage: IntlShape["formatMessage"]
): string | null {
  switch (String(stage)) {
    case "normalizing":
      return formatMessage({ id: "profile.avatar.preparing", defaultMessage: "Preparing photo…" });
    case "uploading":
      return formatMessage({ id: "profile.avatar.uploading", defaultMessage: "Uploading photo…" });
    case "signing":
      return formatMessage({
        id: "profile.avatar.signing",
        defaultMessage: "Approve photo change…",
      });
    case "saving":
      return formatMessage({ id: "profile.avatar.saving", defaultMessage: "Saving photo…" });
    default:
      return null;
  }
}

export function getProfileAvatarFailureMessage(
  action: ProfileAvatarFailureAction,
  formatMessage: IntlShape["formatMessage"],
  error?: unknown
): string {
  if (isPasskeyCredentialUnavailableError(error)) {
    return formatMessage({
      id: "profile.avatar.passkeyUnavailable",
      defaultMessage: "We couldn't find this passkey. Sign in again, then try once more.",
    });
  }
  if (error instanceof ProfileAvatarTransportError) {
    if (error.errorCode === "signature_invalid") {
      return formatMessage({
        id: "profile.avatar.signatureInvalid",
        defaultMessage: "We couldn't verify your approval. Sign in again, then retry.",
      });
    }
    if (error.errorCode === "version_conflict") {
      return formatMessage({
        id: "profile.avatar.versionConflict",
        defaultMessage: "Your profile photo changed elsewhere. Try again to use this photo.",
      });
    }
    if (error.status === 429) {
      return formatMessage({
        id: "profile.avatar.rateLimited",
        defaultMessage: "Too many photo changes. Wait a moment, then try again.",
      });
    }
    if (error.status && error.status >= 500) {
      return formatMessage({
        id: "profile.avatar.serviceUnavailable",
        defaultMessage: "The photo service is unavailable. Please try again later.",
      });
    }
    if (error.isAmbiguous) {
      return formatMessage({
        id: "profile.avatar.connectionError",
        defaultMessage:
          "We couldn't confirm your photo change. Check your connection, then try again.",
      });
    }
  }
  const messages = {
    save: {
      id: "profile.avatar.saveError",
      defaultMessage: "We could not save your profile photo. Please try again.",
    },
    remove: {
      id: "profile.avatar.removeError",
      defaultMessage: "We could not remove your profile photo. Please try again.",
    },
    continue: {
      id: "profile.avatar.continueError",
      defaultMessage: "We could not publish your profile photo. Please try again.",
    },
    discard: {
      id: "profile.avatar.discardError",
      defaultMessage: "We could not discard your profile photo draft. Please try again.",
    },
  } as const;
  return formatMessage(messages[action]);
}
