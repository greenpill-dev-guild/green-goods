import type { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import type { AgentReportingRecovery } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingRecovery";
import type { MessageDescriptor } from "react-intl";

/**
 * What stops a step or went wrong in it. The status card says it where the screen has one; on the
 * screens without one, the heading card's body does. Either way it takes the place of words that
 * were already there, so nothing on the page moves when it appears or clears.
 */
export interface CeremonyProblem {
  /** Given when the problem is the state itself, as a wrong account is; else the state keeps its title. */
  title?: MessageDescriptor;
  message: MessageDescriptor;
  values?: Record<string, string>;
  /** `caution` asks for patience; `neutral` only explains a wait. */
  tone: "error" | "caution" | "neutral";
}

/**
 * A problem that arrives already in words: a failed sign-in or account creation comes back from
 * the account layer as a sentence in the reader's language, not as a message to format. Only the
 * heading card says these.
 */
export interface SpokenProblem {
  spoken: string;
  tone: CeremonyProblem["tone"];
}

const UNUSABLE: MessageDescriptor = {
  id: "public.reporting.unavailable.body",
  defaultMessage:
    "It may have expired, been used already, or been opened in another browser. Ask your chat for a new link.",
};

/** What went wrong, and what to do about it, each within two lines of a card on a small phone. */
export const FAILURE_COPY: Record<
  NonNullable<AgentReportingCeremony["error"] | AgentReportingRecovery["error"]>,
  MessageDescriptor
> = {
  expired: UNUSABLE,
  not_yours: UNUSABLE,
  changed: {
    id: "public.reporting.error.changed",
    defaultMessage: "Something changed, so this page refreshed. Check it again.",
  },
  paused: {
    id: "public.reporting.error.paused",
    defaultMessage: "Publishing is paused right now. Try again later.",
  },
  rate_limited: {
    id: "public.reporting.error.rateLimited",
    defaultMessage: "Too many attempts. Wait a moment and try again.",
  },
  unsupported: {
    id: "public.reporting.unsupported.title",
    defaultMessage: "This step isn't available here yet",
  },
  offline: {
    id: "public.reporting.error.offline",
    defaultMessage: "Green Goods couldn't be reached. Check your connection.",
  },
  declined: {
    id: "public.reporting.error.declined",
    defaultMessage: "The request was declined. Nothing was signed.",
  },
  wrong_account: {
    id: "public.reporting.error.wrongAccount",
    defaultMessage: "Not the account linked to your chat. Switch and try again.",
  },
  envelope_mismatch: {
    id: "public.reporting.error.envelopeMismatch",
    defaultMessage: "The details didn't match, so this page won't sign. Nothing was sent.",
  },
  outcome_unknown: {
    id: "public.reporting.status.unknown",
    defaultMessage: "Green Goods is checking the network. Don't send it again.",
  },
  wrong_code: {
    id: "public.reporting.error.wrongCode",
    defaultMessage: "That code didn't match. Check the latest message in your new chat.",
  },
  unknown: {
    id: "public.reporting.error.unknown",
    defaultMessage: "Something went wrong. Try again.",
  },
};

/** Failures that ask for patience rather than a correction read as a caution, not an error. */
export const CAUTIONS = new Set<keyof typeof FAILURE_COPY>([
  "outcome_unknown",
  "paused",
  "rate_limited",
  "offline",
]);

/** A failure as the problem a card shows: the state keeps its title and the body says what happened. */
export function failureProblem(failure: keyof typeof FAILURE_COPY): CeremonyProblem {
  return { message: FAILURE_COPY[failure], tone: CAUTIONS.has(failure) ? "caution" : "error" };
}

type AccountFailure = NonNullable<AgentReportingCeremony["failure"]>;

/** This browser cannot open a passkey prompt at all: said before anyone presses for one. */
export const PASSKEYS_UNAVAILABLE: CeremonyProblem = {
  message: {
    id: "public.reporting.browser.noPasskey",
    defaultMessage: "Passkeys don't work here. Use Safari or Chrome, or a wallet.",
  },
  tone: "caution",
};

/**
 * What happened when connecting or creating an account failed, and what to do next. No line
 * here tells anyone to create an account, and none says they have none: a prompt that closed
 * may have been dismissed, may have timed out, or may have had no passkey to offer.
 */
const ACCOUNT_FAILURE_COPY: Partial<Record<AccountFailure["reason"], MessageDescriptor>> = {
  prompt_closed: {
    id: "public.reporting.account.failure.promptClosed",
    defaultMessage: "The passkey prompt closed. Try again, or use another way in.",
  },
  not_created: {
    id: "public.reporting.account.failure.notCreated",
    defaultMessage: "The passkey prompt closed, so no account was made. Try again.",
  },
  no_saved_passkey: {
    id: "public.reporting.account.failure.noSavedPasskey",
    defaultMessage: "No passkey is saved in this browser. Try another way in.",
  },
  name_not_found: {
    id: "public.reporting.account.failure.nameNotFound",
    defaultMessage: "No account has that name. Check the spelling, or go back.",
  },
  passkey_not_here: {
    id: "public.reporting.account.failure.passkeyNotHere",
    defaultMessage: "That passkey isn't on this device. Try another way in.",
  },
  name_taken: {
    id: "public.reporting.account.failure.nameTaken",
    defaultMessage: "That name is taken. Pick another, or go back if it's yours.",
  },
  passkeys_unavailable: PASSKEYS_UNAVAILABLE.message,
  unreachable: FAILURE_COPY.offline,
};

/** A failed attempt on the account step as the problem the heading card says. */
export function accountFailureProblem(failure: AccountFailure): CeremonyProblem | SpokenProblem {
  const message = ACCOUNT_FAILURE_COPY[failure.reason];
  // Without words of its own for it, the page says the account layer's.
  if (!message) return { spoken: failure.spoken, tone: "error" };
  const waits = failure.reason === "unreachable" || failure.reason === "passkeys_unavailable";
  return { message, tone: waits ? "caution" : "error" };
}

/** Why an act is switched off. These are states of their own, so each brings its title. */
export const BLOCKS = {
  wrongAccount: {
    title: { id: "public.reporting.block.wrongAccount", defaultMessage: "Wrong account" },
    message: {
      id: "public.reporting.block.wrongAccountBody",
      defaultMessage: "Switch to {account} to continue.",
    },
  },
  mismatch: {
    title: { id: "public.reporting.block.mismatch", defaultMessage: "Can't sign this" },
    message: FAILURE_COPY.envelope_mismatch,
  },
} satisfies Record<string, { title: MessageDescriptor; message: MessageDescriptor }>;

type PermissionFailure = NonNullable<ReturnType<typeof useAgentReportingPermissions>["error"]>;

/** What went wrong on the permissions page: a title for its status card and a line or two. */
export const PERMISSION_FAILURE_COPY: Record<
  PermissionFailure,
  { title: MessageDescriptor; message: MessageDescriptor }
> = {
  unsupported_account: {
    title: {
      id: "public.reporting.permissions.error.unsupportedTitle",
      defaultMessage: "Not supported",
    },
    message: {
      id: "public.reporting.permissions.error.unsupported",
      defaultMessage: "This account can't hold these permissions. Sign each report yourself.",
    },
  },
  invalid_descriptor: {
    title: {
      id: "public.reporting.permissions.error.invalidTitle",
      defaultMessage: "Record not usable",
    },
    message: {
      id: "public.reporting.permissions.error.invalid",
      defaultMessage:
        "That saved record can't be used here. Paste the complete record exported from this page.",
    },
  },
  wrong_account: {
    title: { id: "public.reporting.block.wrongAccount", defaultMessage: "Wrong account" },
    message: {
      id: "public.reporting.permissions.error.account",
      defaultMessage: "This record belongs to another account. Connect that account to continue.",
    },
  },
  dependency_unavailable: {
    title: {
      id: "public.reporting.permissions.error.connectionTitle",
      defaultMessage: "Couldn't reach the network",
    },
    message: {
      id: "public.reporting.permissions.error.connection",
      defaultMessage: "Check your connection and try again.",
    },
  },
  declined: {
    title: {
      id: "public.reporting.permissions.error.declinedTitle",
      defaultMessage: "Nothing changed",
    },
    message: {
      id: "public.reporting.permissions.error.declined",
      defaultMessage: "The request was declined. Your permissions haven't changed.",
    },
  },
  outcome_unknown: {
    title: {
      id: "public.reporting.permissions.error.unknownTitle",
      defaultMessage: "Not confirmed yet",
    },
    message: {
      id: "public.reporting.permissions.error.unknown",
      defaultMessage: "It isn't clear yet whether permissions changed. Check again first.",
    },
  },
  remaining_permissions: {
    title: {
      id: "public.reporting.permissions.error.remainingTitle",
      defaultMessage: "Some are still active",
    },
    message: {
      id: "public.reporting.permissions.error.remaining",
      defaultMessage: "Newer permissions are still active. Remove them too if you want.",
    },
  },
};
