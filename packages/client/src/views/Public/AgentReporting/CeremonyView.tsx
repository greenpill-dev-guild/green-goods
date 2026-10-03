import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { type ReactNode, useId } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import { FlowForward } from "@/components/Features/Work";
import { AccountActions, AccountLine, ManagePermissionsLink, SignOutButton } from "./CeremonyActs";
import { ActContext } from "./CeremonyBar";
import { BLOCKED_ID, type CeremonyNotice, CeremonyFrame } from "./CeremonyFrame";
import { barStanding, OutcomeNotice } from "./CeremonyOutcome";
import { ceremonyHeading } from "./ceremonyHeading";
import { readCeremonyScreen } from "./ceremonyScreen";
import { GrantSummary } from "./GrantSummary";
import { PublicationSkeleton, PublicationSummary } from "./PublicationSummary";
import { CAUTIONS, CEREMONY_COPY, FAILURE_COPY } from "./messages";

type CeremonyViewProps = Pick<
  AgentReportingCeremony,
  | "stage"
  | "purpose"
  | "channelLabel"
  | "pairingCode"
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

/** Stages with a session this browser can end. */
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
 * frame lays the page out; this view decides what each stage shows and which act, if any, its bar
 * offers. A send whose outcome is unknown never gets an act.
 */
export function CeremonyView(props: CeremonyViewProps) {
  const intl = useIntl();
  const firstItemId = useId();
  const { stage, resource, operation, grant } = props;
  const screen = readCeremonyScreen(props);
  const { isGrant, decides, uncertain, proving, publishing, granting, sent } = screen;
  const text = (message: MessageDescriptor, values?: Record<string, string | number>) =>
    intl.formatMessage(message, values);
  const signer = grant?.policy.account ?? operation?.envelope?.accountAddress ?? null;
  const wrongAccount =
    (stage === "review" || stage === "grant_ready") &&
    signer !== null &&
    props.account?.toLowerCase() !== signer.toLowerCase();

  const blocked: CeremonyNotice | null =
    !uncertain && (stage === "review" || stage === "grant_ready")
      ? wrongAccount
        ? { message: FAILURE_COPY.wrong_account, tone: "error" }
        : props.issues.length > 0
          ? { message: FAILURE_COPY.envelope_mismatch, tone: "error" }
          : stage === "grant_ready" && resource && !operation?.envelope
            ? { message: CEREMONY_COPY.loading.body as MessageDescriptor, tone: "neutral" }
            : null
      : null;
  const describedBy = blocked ? BLOCKED_ID : undefined;

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
                    defaultMessage: "Allow and Record First Review",
                  }
                : {
                    id: "public.reporting.grant.allowFirstReport",
                    defaultMessage: "Allow and Publish First Report",
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
  const hasActions = actions !== null;

  // The act's own label says what it signs, so its note counts signatures and names the account.
  const actStep = !screen.twoSignatures
    ? null
    : proving
      ? text({
          id: "public.reporting.step.prove",
          defaultMessage: "Signature 1 of 2: prove the account",
        })
      : stage === "signing"
        ? text(CEREMONY_COPY.signing.body as MessageDescriptor)
        : stage === "grant_signing"
          ? text(CEREMONY_COPY.grant_signing.body as MessageDescriptor)
          : publishing || (granting && resource)
            ? text({ id: "public.reporting.step.second", defaultMessage: "Signature 2 of 2" })
            : granting
              ? text({
                  id: "public.reporting.grant.prepareNotice",
                  defaultMessage: "Preparing the first item does not request a signature.",
                })
              : null;
  const actAccount = proving ? (
    props.account ? (
      <AccountLine account={props.account} relation="connected" />
    ) : null
  ) : (publishing || granting) && signer ? (
    <AccountLine account={signer} relation="signer" />
  ) : null;

  const utilities =
    (isGrant && stage !== "grant_signing") || SESSION.has(stage) ? (
      <>
        {isGrant && stage !== "grant_signing" ? <ManagePermissionsLink /> : null}
        {SESSION.has(stage) ? <SignOutButton onLeave={() => void props.leave()} /> : null}
      </>
    ) : null;

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
        {grant && !sent ? (
          <p className="text-xs text-text-sub-600">
            {text(
              {
                id: "public.reporting.grant.firstCounts",
                defaultMessage:
                  "This first publication uses 1 of the {maximum} allowed publications. Check it before approving the permission.",
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
      channel={props.channelLabel}
      screen={screen.unusable ? "state" : "step"}
      steps={
        screen.steps
          ? { names: screen.steps.names.map((name) => text(name)), current: screen.steps.current }
          : null
      }
      heading={ceremonyHeading(intl, screen, props)}
      notice={<OutcomeNotice screen={screen} />}
      // A sent request's notice already says the outcome is unknown, so no caution repeats it.
      error={
        props.error && !uncertain
          ? {
              message: FAILURE_COPY[props.error],
              tone: CAUTIONS.has(props.error) ? "caution" : "error",
            }
          : null
      }
      blocked={blocked}
      barNotes={hasActions ? <ActContext step={actStep} account={actAccount} /> : null}
      actions={actions}
      // Without an act, the bar says where the step stands, in the act's place.
      barStatus={hasActions ? null : barStanding(intl, screen)}
      utilities={utilities}
    >
      {stage === "pairing" && props.pairingCode ? (
        <p
          className="rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-6 text-center font-mono text-3xl font-semibold tracking-[0.2em] text-text-strong-950 [overflow-wrap:anywhere] sm:text-4xl"
          aria-label={props.pairingCode.split("").join(" ")}
        >
          {props.pairingCode}
        </p>
      ) : null}
      {publication}
      {/* While it is checked, the newly prepared first item leads; once sent, the permission does. */}
      {sent ? null : firstItem}
      {showsGrant && grant ? <GrantSummary grant={grant} /> : null}
      {sent ? firstItem : null}
      {sent && signer ? (
        <p className="min-w-0 break-words text-xs text-text-sub-600">
          <AccountLine account={signer} relation="signer" />
        </p>
      ) : null}
    </CeremonyFrame>
  );
}
