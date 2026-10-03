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
import type { IntlShape, MessageDescriptor } from "react-intl";
import { AccountLine } from "./CeremonyActs";
import type { CeremonyHeading } from "./CeremonyFrame";
import type { CeremonyScreen } from "./ceremonyScreen";
import { CEREMONY_COPY, SENT_HEADINGS } from "./messages";

/**
 * The page's heading card at each stage. A step is headed by what to do in it; once the request has
 * left the page, by what was sent, as the app's work page names a submission, so the notice under
 * it can say where it stands.
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
    return { title: copy.title, info: text(copy.body), Icon: RiShieldUserLine };
  }
  if (stage === "pairing") {
    return { title: copy.title, info: text(copy.body), Icon: RiSendPlaneLine };
  }

  if (screen.sent) {
    if (screen.isLink) {
      return {
        title: SENT_HEADINGS.account,
        info: account ? <AccountLine account={account} relation="connected" /> : "",
        Icon: RiUserFollowLine,
      };
    }
    if (screen.isGrant) {
      return {
        title: SENT_HEADINGS.permission,
        info: grant?.gardenLabel ?? (grant ? formatAddress(grant.policy.gardenAddress) : ""),
        Icon: RiShieldCheckLine,
      };
    }
    return {
      title: decides ? SENT_HEADINGS.decision : SENT_HEADINGS.report,
      info: resource?.gardenLabel ?? "",
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
                "Check {purpose, select, review {your first decision} other {your first report}} and the permission's limits. One signature allows the permission and {purpose, select, review {records the decision} other {publishes the report}}.",
            },
            { purpose: decides ? "review" : "reporting" }
          ),
          Icon: RiShieldCheckLine,
        };
  }
  return {
    title: screen.isReview
      ? {
          id: "public.reporting.review.decisionTitle",
          defaultMessage: "Check and Record Your Decision",
        }
      : CEREMONY_COPY.review.title,
    // Until the frozen publication arrives, the garden it goes to isn't known.
    info: resource
      ? text(CEREMONY_COPY.review.body, { garden: resource.gardenLabel })
      : text(CEREMONY_COPY.loading.body),
    Icon: screen.isReview ? RiCheckDoubleLine : RiFileList3Line,
  };
}
