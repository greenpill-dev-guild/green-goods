import {
  RiAlertLine,
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiRefreshLine,
  RiTimeLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import type { IntlShape, MessageDescriptor } from "react-intl";
import { BarStatus } from "./CeremonyBar";
import { BLOCKED_ID, StageNotice } from "./CeremonyFrame";
import type { CeremonyScreen } from "./ceremonyScreen";
import type { CeremonyProblem } from "./failures";
import { CEREMONY_COPY, STATUS_COPY } from "./messages";

const ICON = "h-5 w-5 flex-shrink-0";
const WAITING = <RiLoader4Line className={`${ICON} animate-spin`} aria-hidden="true" />;
const NOT_YET = <RiTimeLine className={ICON} aria-hidden="true" />;

const REVIEW_ACTIVE: { title: MessageDescriptor; body: MessageDescriptor } = {
  title: {
    id: "public.reporting.grant.reviewActiveTitle",
    defaultMessage: "Review permission active",
  },
  body: {
    id: "public.reporting.grant.reviewActiveBody",
    defaultMessage: "Each decision still needs your yes in chat. Remove it any time.",
  },
};

interface Standing {
  variant: "info" | "success" | "warning" | "error";
  icon?: ReactNode;
  title: MessageDescriptor;
  body: MessageDescriptor;
}

/**
 * The account and chat-code screens show no report or permission yet, and a dead end is its own
 * empty state, so none of them has a status card.
 */
export function hasStatusCard(screen: CeremonyScreen): boolean {
  return !(screen.opening || screen.proving || screen.unusable || screen.stage === "pairing");
}

/** Where the request stands at this stage, before any problem is laid over it. */
function standing(screen: CeremonyScreen): Standing | null {
  const { stage, decides } = screen;
  if (screen.uncertain) {
    return {
      variant: "warning",
      icon: <RiRefreshLine className={ICON} aria-hidden="true" />,
      title: STATUS_COPY.unknown.title,
      body: STATUS_COPY.unknown.body,
    };
  }
  const copy = CEREMONY_COPY[stage];
  const body = copy.body as MessageDescriptor;
  switch (stage) {
    case "loading":
      return {
        variant: "info",
        icon: WAITING,
        title: decides ? STATUS_COPY.decisionLoading : copy.title,
        body,
      };
    case "review":
      return {
        variant: "info",
        icon: NOT_YET,
        title: STATUS_COPY.notSent.title,
        body: decides ? STATUS_COPY.notSent.decision : STATUS_COPY.notSent.report,
      };
    case "grant_ready":
      return screen.permissionStep
        ? {
            variant: "info",
            icon: NOT_YET,
            title: STATUS_COPY.notAllowed.title,
            body: STATUS_COPY.notAllowed.body,
          }
        : {
            variant: "info",
            icon: NOT_YET,
            title: STATUS_COPY.notSent.title,
            body: decides ? STATUS_COPY.notSent.grantDecision : STATUS_COPY.notSent.grantReport,
          };
    case "signing":
    case "grant_signing":
      return {
        variant: "info",
        icon: WAITING,
        title: CEREMONY_COPY.signing.title,
        body: CEREMONY_COPY.signing.body as MessageDescriptor,
      };
    case "submitted":
    case "grant_submitted":
      return { variant: "info", icon: WAITING, title: copy.title, body };
    case "linked":
    case "published":
      return { variant: "success", title: copy.title, body };
    case "grant_active":
      return decides
        ? { variant: "success", ...REVIEW_ACTIVE }
        : { variant: "success", title: copy.title, body };
    case "not_sent":
      return {
        variant: "warning",
        icon: <RiAlertLine className={ICON} aria-hidden="true" />,
        title: copy.title,
        body,
      };
    case "failed":
      return { variant: "error", title: copy.title, body };
    default:
      return null;
  }
}

const PROBLEM_VARIANT = { error: "error", caution: "warning", neutral: "info" } as const;

/**
 * Where the request stands, under the heading, as the app's work page says where queued work
 * stands. It is on the page from the first screen that shows the report or permission, before
 * anything is sent, and every state of it is a title and two lines, so sending the request moves
 * nothing under it. An unknown outcome uses the app's own words for it and never reads as sent.
 *
 * A problem is said here too, in the same two lines: what failed keeps the state's title, so the
 * card still says where the request stands, and what stops the act brings its own.
 */
export function StatusCard({
  screen,
  problem = null,
}: {
  screen: CeremonyScreen;
  problem?: CeremonyProblem | null;
}) {
  if (!hasStatusCard(screen)) return null;
  const state = standing(screen);
  if (!state) return null;
  if (problem) {
    return (
      <StageNotice
        id={BLOCKED_ID}
        variant={PROBLEM_VARIANT[problem.tone]}
        icon={problem.tone === "neutral" ? WAITING : undefined}
        title={problem.title ?? state.title}
        body={problem.message}
        values={problem.values}
      />
    );
  }
  return <StageNotice {...state} />;
}

/**
 * Where the request stands when the bar has no act, in the act's place: a wait, or the outcome in
 * a word. Null when the stage has nothing to say there.
 */
export function barStanding(intl: IntlShape, screen: CeremonyScreen): ReactNode {
  const { stage, decides } = screen;
  const copy = CEREMONY_COPY[stage];
  const text = (message: MessageDescriptor) => intl.formatMessage(message);
  // The status card announces a request's standing, so the bar stays quiet wherever there is one.
  const status = (tone: "neutral" | "success" | "error", icon: ReactNode, words: string) => (
    <BarStatus tone={tone} icon={icon} announce={!hasStatusCard(screen)}>
      {words}
    </BarStatus>
  );
  const waiting = <RiLoader4Line className="animate-spin" />;

  if (stage === "pairing") {
    return status(
      "neutral",
      waiting,
      text({ id: "public.reporting.bar.waitingChat", defaultMessage: "Waiting for your chat" })
    );
  }
  if (screen.uncertain) {
    return status(
      "neutral",
      waiting,
      text({
        id: "public.reporting.uncertain.title",
        defaultMessage: "Checking whether the request was sent",
      })
    );
  }
  switch (stage) {
    case "loading":
      return status("neutral", waiting, text(decides ? STATUS_COPY.decisionLoading : copy.title));
    case "submitted":
    case "grant_submitted":
      return status(
        "neutral",
        waiting,
        text({
          id: "public.reporting.bar.waitingNetwork",
          defaultMessage: "Waiting for the network",
        })
      );
    case "linked":
    case "published":
      return status("success", <RiCheckLine />, text(copy.title));
    case "grant_active":
      return status("success", <RiCheckLine />, text(decides ? REVIEW_ACTIVE.title : copy.title));
    case "not_sent":
    case "failed":
      return status("error", <RiCloseLine />, text(copy.title));
    default:
      return null;
  }
}
