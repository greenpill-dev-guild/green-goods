import {
  RiAlertLine,
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiRefreshLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import type { IntlShape, MessageDescriptor } from "react-intl";
import { BarStatus, StageNotice } from "./CeremonyFrame";
import type { CeremonyScreen } from "./ceremonyScreen";
import { CEREMONY_COPY, FAILURE_COPY } from "./messages";

const ICON = "h-5 w-5 flex-shrink-0";

const REVIEW_ACTIVE: { title: MessageDescriptor; body: MessageDescriptor } = {
  title: {
    id: "public.reporting.grant.reviewActiveTitle",
    defaultMessage: "Review permission active",
  },
  body: {
    id: "public.reporting.grant.reviewActiveBody",
    defaultMessage:
      "The assistant can record your review decisions within these limits after you confirm each decision in chat. You can remove permissions from the reporting permissions page.",
  },
};

/**
 * Where a sent request stands, under the heading, as the app's work page says where queued work
 * stands. An unknown outcome uses the app's own words for it and never reads as sent.
 */
export function OutcomeNotice({ screen }: { screen: CeremonyScreen }) {
  const { stage, decides } = screen;
  if (!screen.sent) return null;
  if (screen.uncertain) {
    return (
      <StageNotice
        variant="warning"
        icon={<RiRefreshLine className={ICON} aria-hidden="true" />}
        title={{ id: "app.work.notice.checking.title", defaultMessage: "May already be sent" }}
        body={FAILURE_COPY.outcome_unknown}
      />
    );
  }
  const copy = CEREMONY_COPY[stage];
  const body = copy.body as MessageDescriptor;
  switch (stage) {
    case "submitted":
    case "grant_submitted":
      return (
        <StageNotice
          variant="info"
          icon={<RiLoader4Line className={`${ICON} animate-spin`} aria-hidden="true" />}
          title={copy.title}
          body={body}
        />
      );
    case "linked":
    case "published":
      return <StageNotice variant="success" title={copy.title} body={body} />;
    case "grant_active":
      return (
        <StageNotice
          variant="success"
          title={decides ? REVIEW_ACTIVE.title : copy.title}
          body={decides ? REVIEW_ACTIVE.body : body}
        />
      );
    case "not_sent":
      return (
        <StageNotice
          variant="warning"
          icon={<RiAlertLine className={ICON} aria-hidden="true" />}
          title={copy.title}
          body={body}
        />
      );
    case "failed":
      return <StageNotice variant="error" title={copy.title} body={body} />;
    default:
      return null;
  }
}

/**
 * Where the step stands when the bar has no act, in the act's place: a wait, or the outcome in a
 * word. Null when the stage has nothing to say there.
 */
export function barStanding(intl: IntlShape, screen: CeremonyScreen): ReactNode {
  const { stage, decides } = screen;
  const copy = CEREMONY_COPY[stage];
  const text = (message: MessageDescriptor) => intl.formatMessage(message);
  // The notice under the heading announces a sent request's outcome, so the bar stays quiet.
  const status = (tone: "neutral" | "success" | "error", icon: ReactNode, words: string) => (
    <BarStatus tone={tone} icon={icon} announce={!screen.sent}>
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
      return status(
        "neutral",
        waiting,
        decides
          ? text({
              id: "public.reporting.loading.decisionTitle",
              defaultMessage: "Getting your decision ready",
            })
          : text(copy.title)
      );
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
