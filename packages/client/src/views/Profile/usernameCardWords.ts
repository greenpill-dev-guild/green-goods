import type { UsernameCardState } from "@green-goods/shared/hooks/client-ui/profile/useUsernameController";
import type { IntlShape } from "react-intl";

type UsernameChipTone = "success" | "info" | "warning" | "neutral";

export interface UsernameCardWords {
  /** The name, or what stands in for it when there is none. */
  title: string;
  /** One text chip for where the name stands, when it has one. */
  chip: { tone: UsernameChipTone; text: string } | null;
  /** One sentence: what is happening, and what others see meanwhile. */
  sentence: string;
}

export const nameOf = (slug: string) => `${slug}.greengoods.eth`;

/**
 * What the Username card says in each state (PRD-1026 p1 to p11): the title,
 * one chip and one sentence, without showing an address. A failed check never
 * reads as a failed name (p5).
 */
export function usernameCardWords(
  card: Exclude<UsernameCardState, { kind: "loading" }>,
  isOnline: boolean,
  formatMessage: IntlShape["formatMessage"]
): UsernameCardWords {
  const changing = (step: 1 | 2) =>
    formatMessage(
      { id: "app.profile.username.changingStep", defaultMessage: "Changing · {step} of 2" },
      { step }
    );
  switch (card.kind) {
    case "ready":
      return {
        title: nameOf(card.slug),
        chip: {
          tone: "success",
          text: formatMessage({ id: "app.profile.username.ready", defaultMessage: "Ready" }),
        },
        sentence: formatMessage({
          id: "app.profile.username.readyLine",
          defaultMessage: "People can use this name to find your work.",
        }),
      };
    case "setting-up":
      return {
        title: nameOf(card.slug),
        chip: {
          tone: "info",
          text: formatMessage({
            id: "app.profile.username.settingUp",
            defaultMessage: "Setting up",
          }),
        },
        sentence: card.claimedHere
          ? formatMessage({
              id: "app.profile.username.claimedLine",
              defaultMessage:
                "Claimed. This usually takes 15–20 minutes. Until it’s ready, others see your account ID.",
            })
          : formatMessage({
              id: "app.profile.username.settingUpLine",
              defaultMessage:
                "This usually takes 15–20 minutes. Until it’s ready, others see your account ID.",
            }),
      };
    case "taking-longer":
      return {
        title: nameOf(card.slug),
        chip: {
          tone: "warning",
          text: formatMessage({
            id: "app.profile.username.takingLonger",
            defaultMessage: "Taking longer",
          }),
        },
        sentence: formatMessage({
          id: "app.profile.username.takingLongerLine",
          defaultMessage: "Still being checked. Checking again won’t claim another name.",
        }),
      };
    case "checking":
      return {
        title: nameOf(card.slug),
        chip: {
          tone: "neutral",
          text: formatMessage({
            id: "app.profile.username.checkingChip",
            defaultMessage: "Checking",
          }),
        },
        sentence: formatMessage({
          id: "app.profile.username.checkingLine",
          defaultMessage: "Checking where your name stands.",
        }),
      };
    case "unknown":
      return {
        title: nameOf(card.slug),
        chip: {
          tone: "neutral",
          text: formatMessage({
            id: "app.profile.username.unknown",
            defaultMessage: "Status unknown",
          }),
        },
        sentence: isOnline
          ? formatMessage({
              id: "app.profile.username.unknownLine",
              defaultMessage: "We couldn’t check your name. Try again in a moment.",
            })
          : formatMessage({
              id: "app.profile.username.offlineLine",
              defaultMessage: "You’re offline. Your name’s status updates when you’re back online.",
            }),
      };
    case "claiming":
      return {
        title: nameOf(card.slug),
        chip: {
          tone: "info",
          text: formatMessage({ id: "app.profile.username.claiming", defaultMessage: "Claiming" }),
        },
        sentence: formatMessage({
          id: "app.profile.username.claimingLine",
          defaultMessage: "Confirm the claim in your wallet.",
        }),
      };
    case "releasing":
      return {
        title: nameOf(card.from),
        chip: { tone: "info", text: changing(1) },
        sentence: card.to
          ? formatMessage(
              {
                id: "app.profile.username.releasingLine",
                defaultMessage:
                  "Releasing this name. When it clears, usually in 15–20 minutes, you’ll claim {name}.",
              },
              { name: nameOf(card.to) }
            )
          : formatMessage({
              id: "app.profile.username.releasingLineNoTarget",
              defaultMessage: "Releasing this name. It usually clears in 15–20 minutes.",
            }),
      };
    case "claimable":
      return {
        title: nameOf(card.to),
        chip: { tone: "warning", text: changing(2) },
        sentence: formatMessage({
          id: "app.profile.username.claimableLine",
          defaultMessage:
            "Your old name has cleared. Claim the new one to finish; your wallet asks once more.",
        }),
      };
    case "locked":
      return {
        title: formatMessage({
          id: "app.profile.username.none",
          defaultMessage: "No username yet",
        }),
        chip: {
          tone: "neutral",
          text: formatMessage({
            id: "app.profile.claimENSUnavailable",
            defaultMessage: "Not available yet",
          }),
        },
        sentence: formatMessage({
          id: "app.profile.username.lockedLine",
          defaultMessage: "Join a garden to unlock your username.",
        }),
      };
    case "choose":
      if (card.after === "none") {
        return {
          title: formatMessage({
            id: "app.profile.username.none",
            defaultMessage: "No username yet",
          }),
          chip: null,
          sentence: formatMessage({
            id: "app.profile.username.chooseLine",
            defaultMessage: "Choose a name people can use to find your work.",
          }),
        };
      }
      return {
        title: formatMessage({
          id: "app.profile.username.noneNow",
          defaultMessage: "No username right now",
        }),
        chip:
          card.after === "taken"
            ? {
                tone: "warning",
                text: formatMessage({
                  id: "app.profile.username.chooseAgain",
                  defaultMessage: "Choose again",
                }),
              }
            : null,
        sentence:
          card.after === "taken" && card.taken
            ? formatMessage(
                {
                  id: "app.profile.username.takenLine",
                  defaultMessage:
                    "{name} was claimed by someone else while your old name cleared. Choose another name to finish.",
                },
                { name: card.taken }
              )
            : formatMessage({
                id: "app.profile.username.clearedLine",
                defaultMessage: "Your old name has cleared. Choose the name to claim instead.",
              }),
      };
  }
}
