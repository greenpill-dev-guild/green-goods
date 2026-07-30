import type { IntlShape } from "react-intl";

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
    case "saving":
      return formatMessage({ id: "profile.avatar.saving", defaultMessage: "Saving photo…" });
    default:
      return null;
  }
}

export function getProfileAvatarFailureMessage(
  action: ProfileAvatarFailureAction,
  formatMessage: IntlShape["formatMessage"]
): string {
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
