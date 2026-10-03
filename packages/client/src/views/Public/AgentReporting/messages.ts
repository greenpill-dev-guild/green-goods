import type { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import type { AgentReportingRecovery } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingRecovery";
import type { MessageDescriptor } from "react-intl";

type Copy = { title: MessageDescriptor; body?: MessageDescriptor };

/** One title and explanation per ceremony step, in the person's terms. */
export const CEREMONY_COPY: Record<AgentReportingCeremony["stage"], Copy> = {
  intro: {
    title: { id: "public.reporting.intro.title", defaultMessage: "Continue from your chat" },
    body: {
      id: "public.reporting.intro.body",
      defaultMessage:
        "This page finishes a step you started in chat. Nothing happens until you continue.",
    },
  },
  opening: {
    title: { id: "public.reporting.intro.title", defaultMessage: "Continue from your chat" },
  },
  connect: {
    title: { id: "public.reporting.connect.title", defaultMessage: "Show it's your account" },
    body: {
      id: "public.reporting.connect.body",
      defaultMessage:
        "Use the wallet or passkey you already use with Green Goods. You'll sign a short message to prove it's yours. Signing it costs nothing.",
    },
  },
  proving: {
    title: { id: "public.reporting.connect.title", defaultMessage: "Show it's your account" },
    body: {
      id: "public.reporting.proving.body",
      defaultMessage: "Check your wallet or passkey prompt to sign the message.",
    },
  },
  pairing: {
    title: { id: "public.reporting.pairing.title", defaultMessage: "Send this code in your chat" },
    body: {
      id: "public.reporting.pairing.body",
      defaultMessage:
        "Send PAIR and this code in your chat to link this account. This page updates once the chat confirms it.",
    },
  },
  linked: {
    title: { id: "public.reporting.linked.title", defaultMessage: "Account linked" },
    body: {
      id: "public.reporting.linked.body",
      defaultMessage: "Go back to your chat to continue. You can close this page.",
    },
  },
  loading: {
    title: { id: "public.reporting.loading.title", defaultMessage: "Getting your report ready" },
    body: {
      id: "public.reporting.loading.body",
      defaultMessage: "Preparing the exact publication. This takes a moment.",
    },
  },
  review: {
    title: { id: "public.reporting.review.title", defaultMessage: "Check and publish" },
    body: {
      id: "public.reporting.review.body",
      defaultMessage:
        "This is exactly what will be published on-chain for {garden}. It can't be edited once it is published.",
    },
  },
  grant_ready: {
    title: { id: "public.reporting.grant.title", defaultMessage: "Allow bounded reporting" },
    body: {
      id: "public.reporting.grant.body",
      defaultMessage:
        "Check the garden, time window and limits below. Prepare your first publication, then review it before approving the permission and publication together.",
    },
  },
  grant_signing: {
    title: {
      id: "public.reporting.grant.signingTitle",
      defaultMessage: "Confirm permission and first publication",
    },
    body: {
      id: "public.reporting.grant.signingBody",
      defaultMessage:
        "Approve the permission and first publication in your wallet or passkey prompt.",
    },
  },
  grant_submitted: {
    title: {
      id: "public.reporting.grant.submittedTitle",
      defaultMessage: "Permission and first publication sent",
    },
    body: {
      id: "public.reporting.grant.submittedBody",
      defaultMessage:
        "Waiting for the network to confirm both. Keep using your chat; don't send the request again.",
    },
  },
  grant_active: {
    title: {
      id: "public.reporting.grant.activeTitle",
      defaultMessage: "Reporting permission active",
    },
    body: {
      id: "public.reporting.grant.activeBody",
      defaultMessage:
        "The assistant can publish within these limits after you confirm each report in chat. You can remove permissions from the reporting permissions page.",
    },
  },
  signing: {
    title: { id: "public.reporting.signing.title", defaultMessage: "Confirm in your wallet" },
    body: {
      id: "public.reporting.signing.body",
      defaultMessage: "Approve the request in your wallet or passkey prompt.",
    },
  },
  submitted: {
    title: {
      id: "public.reporting.submitted.title",
      defaultMessage: "Sent. Waiting for the network",
    },
    body: {
      id: "public.reporting.submitted.body",
      defaultMessage:
        "Your chat will confirm once it is recorded on-chain. You can close this page; don't send it again.",
    },
  },
  published: {
    title: { id: "public.reporting.published.title", defaultMessage: "Published" },
    body: {
      id: "public.reporting.published.body",
      defaultMessage: "It is recorded on-chain. You can close this page.",
    },
  },
  not_sent: {
    title: { id: "public.reporting.notSent.title", defaultMessage: "Nothing was sent" },
    body: {
      id: "public.reporting.notSent.body",
      defaultMessage:
        "The request was declined or refused, so nothing was published. Go back to your chat to try again.",
    },
  },
  failed: {
    title: { id: "public.reporting.failed.title", defaultMessage: "This wasn't published" },
    body: {
      id: "public.reporting.failed.body",
      defaultMessage:
        "It couldn't be prepared or the network refused it. Your chat has the next step.",
    },
  },
  unavailable: {
    title: {
      id: "public.reporting.unavailable.title",
      defaultMessage: "This link can't be used here",
    },
    body: {
      id: "public.reporting.unavailable.body",
      defaultMessage:
        "It may have expired, been used already, or been opened in another browser. Ask your chat for a new link.",
    },
  },
  unsupported: {
    title: {
      id: "public.reporting.unsupported.title",
      defaultMessage: "This step isn't available here yet",
    },
    body: {
      id: "public.reporting.unsupported.body",
      defaultMessage: "Go back to your chat to continue.",
    },
  },
};

export const RECOVERY_COPY: Record<AgentReportingRecovery["stage"], Copy> = {
  intro: {
    title: {
      id: "public.reporting.recovery.title",
      defaultMessage: "Move your account to this chat",
    },
    body: {
      id: "public.reporting.recovery.body",
      defaultMessage:
        "First show the account is yours, then enter the code your new chat received. Nothing moves until you confirm.",
    },
  },
  opening: {
    title: {
      id: "public.reporting.recovery.title",
      defaultMessage: "Move your account to this chat",
    },
  },
  connect: CEREMONY_COPY.connect,
  proving: CEREMONY_COPY.proving,
  code: {
    title: {
      id: "public.reporting.recovery.code.title",
      defaultMessage: "Enter the code from your new chat",
    },
  },
  confirm: {
    title: {
      id: "public.reporting.recovery.confirm.title",
      defaultMessage: "Move {account} here?",
    },
    body: {
      id: "public.reporting.recovery.confirm.body",
      defaultMessage:
        "Your previous chat on this channel loses access. Other connected channels keep their conversations. Open pages close and reporting permissions pause. Unfinished reports from the replaced chat move here.",
    },
  },
  applying: {
    title: {
      id: "public.reporting.recovery.confirm.title",
      defaultMessage: "Move {account} here?",
    },
  },
  applied: {
    title: {
      id: "public.reporting.recovery.applied.title",
      defaultMessage: "Your account now uses this chat",
    },
    body: CEREMONY_COPY.linked.body,
  },
  unavailable: CEREMONY_COPY.unavailable,
  unsupported: CEREMONY_COPY.unsupported,
};

/** What went wrong, and what to do about it. */
export const FAILURE_COPY: Record<
  NonNullable<AgentReportingCeremony["error"] | AgentReportingRecovery["error"]>,
  MessageDescriptor
> = {
  expired: CEREMONY_COPY.unavailable.body as MessageDescriptor,
  not_yours: CEREMONY_COPY.unavailable.body as MessageDescriptor,
  changed: {
    id: "public.reporting.error.changed",
    defaultMessage:
      "Something changed since this page loaded, so it was refreshed. Check it again.",
  },
  paused: {
    id: "public.reporting.error.paused",
    defaultMessage: "Publishing is paused right now. Try again later.",
  },
  rate_limited: {
    id: "public.reporting.error.rateLimited",
    defaultMessage: "Too many attempts. Wait a moment and try again.",
  },
  unsupported: CEREMONY_COPY.unsupported.title,
  offline: {
    id: "public.reporting.error.offline",
    defaultMessage: "Green Goods couldn't be reached. Check your connection and try again.",
  },
  declined: {
    id: "public.reporting.error.declined",
    defaultMessage: "The request was declined. Nothing was signed.",
  },
  wrong_account: {
    id: "public.reporting.error.wrongAccount",
    defaultMessage:
      "This isn't the account linked to your chat. Switch to that account and try again.",
  },
  envelope_mismatch: {
    id: "public.reporting.error.envelopeMismatch",
    defaultMessage:
      "This page refused to sign because the prepared publication didn't match its own details. Nothing was sent.",
  },
  outcome_unknown: {
    id: "public.reporting.error.outcomeUnknown",
    defaultMessage:
      "It isn't clear yet whether your wallet sent it. Green Goods is checking the network, so don't send it again.",
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

export const PERMISSION_FAILURE_COPY: Record<
  NonNullable<ReturnType<typeof useAgentReportingPermissions>["error"]>,
  MessageDescriptor
> = {
  unsupported_account: {
    id: "public.reporting.permissions.error.unsupported",
    defaultMessage:
      "This account doesn't support these permissions. You can still sign each report yourself.",
  },
  invalid_descriptor: {
    id: "public.reporting.permissions.error.invalid",
    defaultMessage:
      "That saved record can't be used here. Paste the complete record exported from this page.",
  },
  wrong_account: {
    id: "public.reporting.permissions.error.account",
    defaultMessage: "This record belongs to another account. Connect that account to continue.",
  },
  dependency_unavailable: {
    id: "public.reporting.permissions.error.connection",
    defaultMessage: "The network couldn't be reached. Check your connection and try again.",
  },
  declined: {
    id: "public.reporting.permissions.error.declined",
    defaultMessage: "The request was declined. Your permissions haven't changed.",
  },
  outcome_unknown: {
    id: "public.reporting.permissions.error.unknown",
    defaultMessage:
      "The network hasn't confirmed whether permissions changed. Check again before sending another request.",
  },
  remaining_permissions: {
    id: "public.reporting.permissions.error.remaining",
    defaultMessage:
      "Newer permissions remain active. Check them and approve another removal if you want to stop them too.",
  },
};
