import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  RiChat3Line,
  RiCheckDoubleLine,
  RiErrorWarningLine,
  RiFileList3Line,
  RiFileTextLine,
  RiLinkUnlinkM,
  RiSendPlaneLine,
  RiShieldCheckLine,
  RiShieldUserLine,
  RiUserFollowLine,
} from "@remixicon/react";
import type { ReactNode } from "react";
import type { IntlShape, MessageDescriptor } from "react-intl";
import { AccountLine } from "./CeremonyActs";
import type { CeremonyHeading } from "./CeremonyFrame";
import type { CeremonyScreen } from "./ceremonyScreen";
import { CEREMONY_COPY, SENT_HEADINGS } from "./messages";

/** A garden's name on a line of its own: it is someone's own words, so it is cut, never wrapped. */
export function GardenLine({ children }: { children: string }) {
  return (
    <span className="block truncate" title={children}>
      {children}
    </span>
  );
}

/**
 * The page's heading card at each stage. A step is headed by what to do in it; once the request has
 * left the page, by what was sent, as the app's work page names a submission, and the status card
 * under it says where it stands. Every heading is a title on one line and a body within two.
 */
export function ceremonyHeading(
  intl: IntlShape,
  screen: CeremonyScreen,
  { resource, grant, account }: Pick<AgentReportingCeremony, "resource" | "grant" | "account">
): CeremonyHeading {
  const { stage, decides } = screen;
  const copy = CEREMONY_COPY[stage];
  const text = (message: MessageDescriptor | undefined, values?: Record<string, string>) =>
    message ? intl.formatMessage(message, values) : "";

  if (stage === "unavailable") {
    return { title: copy.title, info: text(copy.body), Icon: RiLinkUnlinkM };
  }
  if (stage === "unsupported") {
    return {
      title: copy.title,
      info: screen.isGrant
        ? text({
            id: "public.reporting.grant.unsupported",
            defaultMessage:
              "A safe assistant permission isn't available for this account yet. Return to your chat to sign this report or decision with your own wallet or passkey.",
          })
        : text(copy.body),
      Icon: RiErrorWarningLine,
    };
  }
  if (screen.opening) {
    return {
      title: CEREMONY_COPY.intro.title,
      info: text(CEREMONY_COPY.intro.body),
      Icon: RiChat3Line,
    };
  }
  if (screen.proving) {
    // How many times the person will sign is said here, once, before the first signature. While
    // the prompt is open the same two lines point at it.
    return {
      title: copy.title,
      info:
        stage === "proving"
          ? text(copy.body)
          : screen.twoSignatures
            ? text(
                {
                  id: "public.reporting.connect.twice",
                  defaultMessage:
                    "You'll sign twice: now to show it's yours, then to {act, select, allow {allow it} record {record it} other {publish}}.",
                },
                { act: screen.isGrant ? "allow" : decides ? "record" : "publish" }
              )
            : text({
                id: "public.reporting.connect.once",
                defaultMessage: "You'll sign once to show it's yours. It costs nothing.",
              }),
      Icon: RiShieldUserLine,
    };
  }
  if (stage === "pairing") {
    return { title: copy.title, info: text(copy.body), Icon: RiSendPlaneLine };
  }

  if (screen.sent) {
    if (screen.isLink) {
      return {
        title: SENT_HEADINGS.account,
        info: account ? <AccountLine account={account} /> : "",
        Icon: RiUserFollowLine,
      };
    }
    const garden = screen.isGrant
      ? (grant?.gardenLabel ?? (grant ? formatAddress(grant.policy.gardenAddress) : ""))
      : (resource?.gardenLabel ?? "");
    const info: ReactNode = garden ? <GardenLine>{garden}</GardenLine> : "";
    if (screen.isGrant) return { title: SENT_HEADINGS.permission, info, Icon: RiShieldCheckLine };
    return {
      title: decides ? SENT_HEADINGS.decision : SENT_HEADINGS.report,
      info,
      Icon: decides ? RiCheckDoubleLine : RiFileTextLine,
    };
  }

  if (screen.isGrant) {
    return screen.permissionStep
      ? {
          title: decides
            ? {
                id: "public.reporting.grant.reviewTitle",
                defaultMessage: "Allow Bounded Reviews",
              }
            : CEREMONY_COPY.grant_ready.title,
          info: text(CEREMONY_COPY.grant_ready.body),
          Icon: RiShieldCheckLine,
        }
      : {
          title: {
            id: "public.reporting.grant.reviewStepTitle",
            defaultMessage: "Check and Allow",
          },
          info: text(
            {
              id: "public.reporting.grant.reviewStepBody",
              defaultMessage:
                "{purpose, select, review {Your first decision} other {Your first report}} and the permission, in one signature.",
            },
            { purpose: decides ? "review" : "reporting" }
          ),
          Icon: RiShieldCheckLine,
        };
  }
  // The line that never changes comes first. The garden joins it once the frozen publication has
  // arrived, so nothing in the card moves when it does.
  return {
    title: screen.isReview
      ? { id: "public.reporting.review.decisionTitle", defaultMessage: "Check and Record" }
      : CEREMONY_COPY.review.title,
    info: (
      <>
        <span className="block">{text(CEREMONY_COPY.review.body)}</span>
        {resource?.gardenLabel ? <GardenLine>{resource.gardenLabel}</GardenLine> : null}
      </>
    ),
    Icon: screen.isReview ? RiCheckDoubleLine : RiFileList3Line,
  };
}
