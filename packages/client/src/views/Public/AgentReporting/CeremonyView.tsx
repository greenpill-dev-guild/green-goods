import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { type ReactNode, useId } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import { FlowForward } from "@/components/Features/Work";
import { AccountActions, PageAccount } from "./CeremonyActs";
import { BLOCKED_ID, CeremonyFrame } from "./CeremonyFrame";
import { barStanding, hasStatusCard, StatusCard } from "./CeremonyOutcome";
import { ceremonyHeading } from "./ceremonyHeading";
import { readCeremonyScreen } from "./ceremonyScreen";
import { BLOCKS, type CeremonyProblem, failureProblem } from "./failures";
import { GrantSummary } from "./GrantSummary";
import { PublicationSkeleton, PublicationSummary } from "./PublicationSummary";
import { CEREMONY_COPY } from "./messages";
import { WhatHappensNext } from "./WhatHappensNext";

type CeremonyViewProps = Pick<
  AgentReportingCeremony,
  | "stage"
  | "purpose"
  | "channelLabel"
  | "pairingCode"
  | "sessionAccount"
  | "resource"
  | "operation"
  | "grant"
  | "issues"
  | "error"
  | "account"
  | "connecting"
  | "connectWallet"
  | "connectPasskey"
  | "start"
  | "prove"
  | "publish"
  | "installGrant"
  | "leave"
> & {
  /** Story fixtures can provide local media; production uses the session-scoped API. */
  evidenceUrl?: (assetId: string) => string;
};

/** Stages with a session this browser can end: none while a request is being prepared or signed. */
const SESSION = new Set<AgentReportingCeremony["stage"]>([
  "review",
  "submitted",
  "published",
  "not_sent",
  "failed",
  "grant_ready",
  "grant_submitted",
  "grant_active",
]);

/**
 * The browser step of a chat report, review or permission, drawn with the app's flow parts. The
 * frame lays the page out and keeps its bands at one size; this view decides what each stage shows
 * and which act, if any, its bar offers. What a stage shows keeps its place and its order from the
 * step it first appears on, so sending the request moves nothing. A send whose outcome is unknown
 * never gets an act.
 */
export function CeremonyView(props: CeremonyViewProps) {
  const intl = useIntl();
  const firstItemId = useId();
  const { stage, resource, operation, grant } = props;
  const screen = readCeremonyScreen(props);
  const { isGrant, decides, uncertain, proving, publishing, granting } = screen;
  const text = (message: MessageDescriptor, values?: Record<string, string | number>) =>
    intl.formatMessage(message, values);
  const signer = grant?.policy.account ?? operation?.envelope?.accountAddress ?? null;
  const wrongAccount =
    (stage === "review" || stage === "grant_ready") &&
    signer !== null &&
    props.account?.toLowerCase() !== signer.toLowerCase();

  // Why the act is switched off, if it is: the wrong account, a publication this page refuses to
  // sign, or one that is still being prepared.
  const block: CeremonyProblem | null =
    !uncertain && (stage === "review" || stage === "grant_ready")
      ? wrongAccount && signer
        ? { ...BLOCKS.wrongAccount, values: { account: formatAddress(signer) }, tone: "error" }
        : props.issues.length > 0
          ? { ...BLOCKS.mismatch, tone: "error" }
          : stage === "grant_ready" && resource && !operation?.envelope
            ? {
                title: CEREMONY_COPY.loading.title,
                message: CEREMONY_COPY.loading.body as MessageDescriptor,
                tone: "neutral",
              }
            : null
      : null;
  // The status card already says an outcome is unknown, so no caution repeats it.
  const failure = props.error && !uncertain ? failureProblem(props.error) : null;
  // One problem at a time: what stops the act outright, then what failed, then a wait.
  const problem = block?.tone === "error" ? block : (failure ?? block);
  const withStatus = hasStatusCard(screen);
  const describedBy = block ? BLOCKED_ID : undefined;

  const actions: ReactNode = (() => {
    if (screen.opening) {
      return (
        <FlowForward
          label={text({ id: "public.reporting.intro.continue", defaultMessage: "Continue" })}
          loading={stage === "opening"}
          onClick={() => void props.start()}
        />
      );
    }
    if (proving) {
      return (
        <AccountActions
          account={props.account}
          connecting={props.connecting}
          proving={stage === "proving"}
          onConnectWallet={props.connectWallet}
          onConnectPasskey={() => void props.connectPasskey()}
          onProve={() => void props.prove()}
        />
      );
    }
    if (uncertain) return null;
    if (stage === "review" && props.sessionAccount && !props.account) {
      return (
        <AccountActions
          account={null}
          connecting={props.connecting}
          proving={false}
          onConnectWallet={props.connectWallet}
          onConnectPasskey={() => void props.connectPasskey()}
          onProve={() => void props.prove()}
        />
      );
    }
    if (publishing) {
      return (
        <FlowForward
          label={
            screen.isReview
              ? text({ id: "public.reporting.review.record", defaultMessage: "Record Decision" })
              : text({ id: "public.reporting.review.publish", defaultMessage: "Publish" })
          }
          loading={stage === "signing"}
          disabled={wrongAccount || props.issues.length > 0}
          describedBy={describedBy}
          onClick={() => void props.publish()}
        />
      );
    }
    if (granting) {
      return (
        <FlowForward
          label={text(
            resource
              ? decides
                ? {
                    id: "public.reporting.grant.allowFirstReview",
                    defaultMessage: "Allow and Record",
                  }
                : {
                    id: "public.reporting.grant.allowFirstReport",
                    defaultMessage: "Allow and Publish",
                  }
              : decides
                ? {
                    id: "public.reporting.grant.prepareReview",
                    defaultMessage: "Prepare First Review",
                  }
                : {
                    id: "public.reporting.grant.prepareReport",
                    defaultMessage: "Prepare First Report",
                  }
          )}
          loading={stage === "grant_signing"}
          disabled={
            !grant ||
            wrongAccount ||
            props.issues.length > 0 ||
            Boolean(resource && !operation?.envelope)
          }
          describedBy={describedBy}
          onClick={() => void props.installGrant()}
        />
      );
    }
    return null;
  })();

  // What the request publishes, shown before it is signed and kept on the page after it is sent.
  const publication = (() => {
    if (screen.isLink || isGrant || screen.unusable || screen.opening || proving) return null;
    if (stage === "pairing") return null;
    if (resource) return <PublicationSummary resource={resource} evidenceUrl={props.evidenceUrl} />;
    return stage === "loading" ? <PublicationSkeleton /> : null;
  })();

  // The permission itself, from the step that checks its limits to the outcome.
  const showsGrant =
    isGrant &&
    grant !== null &&
    (stage.startsWith("grant_") || stage === "loading" || stage === "failed");
  // A permission's first item: prepared after its limits are checked, then signed with them.
  const showsFirstItem =
    showsGrant &&
    !screen.permissionStep &&
    (stage === "loading" ||
      Boolean(resource && (resource.title || resource.lines.length || resource.evidence.length)));
  const firstItem = showsFirstItem ? (
    <section aria-labelledby={firstItemId} className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={firstItemId} className="text-base font-semibold text-text-strong-950">
          {text(
            decides
              ? {
                  id: "public.reporting.grant.firstReviewHeading",
                  defaultMessage: "Your first review",
                }
              : {
                  id: "public.reporting.grant.firstReportHeading",
                  defaultMessage: "Your first report",
                }
          )}
        </h2>
        {/* Said the same way before and after sending, so the report under it keeps its place. */}
        {grant ? (
          <p className="text-xs text-text-sub-600">
            {text(
              {
                id: "public.reporting.grant.firstCounts",
                defaultMessage: "Counts as 1 of the {maximum} publications this permission allows.",
              },
              { maximum: grant.policy.maxSubmissions }
            )}
          </p>
        ) : null}
      </div>
      {resource ? (
        <PublicationSummary resource={resource} evidenceUrl={props.evidenceUrl} headingLevel="h3" />
      ) : (
        <PublicationSkeleton headingLevel="h3" />
      )}
    </section>
  ) : null;

  return (
    <CeremonyFrame
      screen={screen.unusable ? "state" : "step"}
      steps={
        screen.steps
          ? { names: screen.steps.names.map((name) => text(name)), current: screen.steps.current }
          : null
      }
      heading={ceremonyHeading(intl, screen, props)}
      // The status card says a problem where the screen has one; elsewhere the heading card does.
      problem={withStatus ? null : problem}
      notice={<StatusCard screen={screen} problem={withStatus ? problem : null} />}
      actions={actions}
      // Without an act, the bar says where the request stands, in the act's place.
      barStatus={actions === null ? barStanding(intl, screen) : null}
    >
      <PageAccount
        account={props.sessionAccount ?? props.account}
        signedIn={props.sessionAccount !== null}
        channel={props.channelLabel}
        onLeave={SESSION.has(stage) ? () => void props.leave() : undefined}
      />
      {stage === "pairing" && props.pairingCode ? (
        <p
          className="rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-6 text-center font-mono text-3xl font-semibold tracking-[0.2em] text-text-strong-950 [overflow-wrap:anywhere] sm:text-4xl"
          aria-label={props.pairingCode.split("").join(" ")}
        >
          {props.pairingCode}
        </p>
      ) : null}
      {screen.opening || proving ? <WhatHappensNext flow={screen.isLink ? "link" : "any"} /> : null}
      {publication}
      {/* The first item is the one thing not yet seen when Review opens, so it leads, and the
          order holds once the request is sent. */}
      {firstItem}
      {showsGrant && grant ? <GrantSummary grant={grant} /> : null}
    </CeremonyFrame>
  );
}
