import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import type { AgentReportingRecovery } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingRecovery";
import type { MessageDescriptor } from "react-intl";

type Copy = { title: MessageDescriptor; body?: MessageDescriptor };

/** A sent request reads the same whether it is a report, a decision or a permission. */
const SUBMITTED: Copy = {
  title: {
    id: "public.reporting.submitted.title",
    defaultMessage: "Sent. Waiting for the network",
  },
  body: {
    id: "public.reporting.submitted.body",
    defaultMessage: "Your chat will confirm it. Don't send it again.",
  },
};

const ACCOUNT_TITLE: MessageDescriptor = {
  id: "public.reporting.connect.title",
  defaultMessage: "Show It's Your Account",
};

/** Said in the heading card while a wallet or passkey prompt is open on the account step. */
const PROMPT: MessageDescriptor = {
  id: "public.reporting.proving.body",
  defaultMessage: "Check your wallet or passkey prompt to sign.",
};

/**
 * One title and line per ceremony stage, in the person's terms: a step's heading, or the status of
 * a request that has been sent. Each is written to fit its card on a 320px phone in every
 * language: a title on one line and a body within two.
 */
export const CEREMONY_COPY: Record<AgentReportingCeremony["stage"], Copy> = {
  intro: {
    title: { id: "public.reporting.intro.title", defaultMessage: "Continue From Your Chat" },
    body: {
      id: "public.reporting.intro.body",
      defaultMessage: "Nothing happens until you continue.",
    },
  },
  opening: {
    title: { id: "public.reporting.intro.title", defaultMessage: "Continue From Your Chat" },
  },
  connect: { title: ACCOUNT_TITLE },
  proving: { title: ACCOUNT_TITLE, body: PROMPT },
  pairing: {
    title: { id: "public.reporting.pairing.title", defaultMessage: "Send This Code" },
    body: {
      id: "public.reporting.pairing.body",
      defaultMessage: "Send this code alone in your chat to link this account.",
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
    title: { id: "public.reporting.review.title", defaultMessage: "Check and Publish" },
    body: { id: "public.reporting.review.body", defaultMessage: "Public and permanent." },
  },
  grant_ready: {
    title: { id: "public.reporting.grant.title", defaultMessage: "Allow Bounded Reporting" },
    body: {
      id: "public.reporting.grant.body",
      defaultMessage: "Check the garden, the dates and the limits below.",
    },
  },
  grant_signing: {
    title: { id: "public.reporting.grant.title", defaultMessage: "Allow Bounded Reporting" },
  },
  grant_submitted: SUBMITTED,
  grant_active: {
    title: {
      id: "public.reporting.grant.activeTitle",
      defaultMessage: "Reporting permission active",
    },
    body: {
      id: "public.reporting.grant.activeBody",
      defaultMessage: "Each report still needs your yes in chat. Remove it any time.",
    },
  },
  signing: {
    title: { id: "public.reporting.status.approving", defaultMessage: "Waiting for your approval" },
    body: {
      id: "public.reporting.signing.body",
      defaultMessage: "Approve the request in your wallet or passkey prompt.",
    },
  },
  submitted: SUBMITTED,
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
      defaultMessage: "It was declined, so nothing was published. Try again from your chat.",
    },
  },
  failed: {
    title: { id: "public.reporting.failed.title", defaultMessage: "This wasn't published" },
    body: {
      id: "public.reporting.failed.body",
      defaultMessage: "It couldn't be prepared or sent. Your chat has the next step.",
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

/** The recovery page's headings, to the same fit as the ceremony's. */
export const RECOVERY_COPY: Record<AgentReportingRecovery["stage"], Copy> = {
  intro: {
    title: { id: "public.reporting.recovery.title", defaultMessage: "Move Your Account Here" },
    body: {
      id: "public.reporting.recovery.body",
      defaultMessage: "Nothing moves until you confirm.",
    },
  },
  opening: {
    title: { id: "public.reporting.recovery.title", defaultMessage: "Move Your Account Here" },
  },
  connect: { title: ACCOUNT_TITLE },
  proving: { title: ACCOUNT_TITLE, body: PROMPT },
  code: {
    title: { id: "public.reporting.recovery.code.title", defaultMessage: "Enter the Code" },
    body: {
      id: "public.reporting.recovery.code.body",
      defaultMessage: "Your new chat received a 6-digit code. Enter it here.",
    },
  },
  confirm: {
    title: { id: "public.reporting.recovery.confirm.title", defaultMessage: "Move This Account?" },
    body: {
      id: "public.reporting.recovery.confirm.info",
      defaultMessage: "Check what changes first.",
    },
  },
  applying: {
    title: { id: "public.reporting.recovery.confirm.title", defaultMessage: "Move This Account?" },
    body: {
      id: "public.reporting.recovery.confirm.info",
      defaultMessage: "Check what changes first.",
    },
  },
  applied: {
    title: { id: "public.reporting.recovery.moved", defaultMessage: "Account moved" },
    body: CEREMONY_COPY.linked.body,
  },
  unavailable: CEREMONY_COPY.unavailable,
  unsupported: CEREMONY_COPY.unsupported,
};

/** Each flow's named steps, shown as the app's flows name theirs (D6). */
export const STEP_NAMES = {
  account: { id: "public.reporting.steps.account", defaultMessage: "Account" },
  link: { id: "public.reporting.steps.link", defaultMessage: "Link" },
  permission: { id: "public.reporting.steps.permission", defaultMessage: "Permission" },
  review: { id: "app.work.step.review", defaultMessage: "Review" },
  code: { id: "public.reporting.steps.code", defaultMessage: "Code" },
  move: { id: "public.reporting.steps.move", defaultMessage: "Move" },
} satisfies Record<string, MessageDescriptor>;

/**
 * Once a request has left the page, the heading names what was sent, as the app's work page names
 * a submission, and the status card under it says where it stands.
 */
export const SENT_HEADINGS = {
  report: { id: "public.reporting.yourReport", defaultMessage: "Your Report" },
  decision: { id: "public.reporting.yourDecision", defaultMessage: "Your Decision" },
  permission: { id: "public.reporting.yourPermission", defaultMessage: "Your Permission" },
  account: { id: "public.reporting.yourAccount", defaultMessage: "Your Account" },
} satisfies Record<string, MessageDescriptor>;

/**
 * Where a request stands before it is sent, said in the status card that later says it was sent,
 * so the card is in place from the first screen that shows the report or permission.
 */
export const STATUS_COPY = {
  notAllowed: {
    title: { id: "public.reporting.status.notAllowed", defaultMessage: "Not allowed yet" },
    body: {
      id: "public.reporting.status.notAllowedBody",
      defaultMessage: "Nothing is allowed until you sign. This step doesn't ask you to.",
    },
  },
  notSent: {
    title: { id: "public.reporting.status.notSent", defaultMessage: "Not sent yet" },
    report: {
      id: "public.reporting.status.notSentReport",
      defaultMessage: "Nothing is published until you sign. It can't be edited afterwards.",
    },
    decision: {
      id: "public.reporting.status.notSentDecision",
      defaultMessage: "Nothing is recorded until you sign. It can't be edited afterwards.",
    },
    grantReport: {
      id: "public.reporting.status.notSentGrantReport",
      defaultMessage: "One signature allows the permission and publishes this report.",
    },
    grantDecision: {
      id: "public.reporting.status.notSentGrantDecision",
      defaultMessage: "One signature allows the permission and records this decision.",
    },
  },
  decisionLoading: {
    id: "public.reporting.loading.decisionTitle",
    defaultMessage: "Getting your decision ready",
  },
  unknown: {
    title: { id: "app.work.notice.checking.title", defaultMessage: "May already be sent" },
    body: {
      id: "public.reporting.status.unknown",
      defaultMessage: "Green Goods is checking the network. Don't send it again.",
    },
  },
} as const;
