import { Button } from "@green-goods/shared/components/Button";
import { Spinner } from "@green-goods/shared/components/Spinner";
import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { useIntl } from "react-intl";
import { AccountStep, CeremonyFrame } from "./CeremonyFrame";
import { GrantSummary } from "./GrantSummary";
import { PublicationSummary } from "./PublicationSummary";
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

const WAITING = new Set(["pairing", "loading", "submitted", "grant_submitted"]);
const SESSION = new Set([
  "review",
  "submitted",
  "published",
  "not_sent",
  "failed",
  "grant_ready",
  "grant_submitted",
  "grant_active",
]);

export function CeremonyView(props: CeremonyViewProps) {
  const intl = useIntl();
  const { stage, resource, operation, grant } = props;
  const copy = CEREMONY_COPY[stage];
  const isReview = props.purpose === "review_decision";
  const isGrant = props.purpose === "grant_reporting" || props.purpose === "grant_review";
  // Publishing and reviewing take two signatures; say so before the first one.
  const twoSignatures = props.purpose === "publish_work" || isReview || isGrant;
  const signer = grant?.policy.account ?? operation?.envelope?.accountAddress ?? null;
  const wrongAccount =
    (stage === "review" || stage === "grant_ready") &&
    signer !== null &&
    props.account?.toLowerCase() !== signer.toLowerCase();
  const title =
    stage === "review" && isReview
      ? {
          id: "public.reporting.review.decisionTitle",
          defaultMessage: "Check and record your decision",
        }
      : stage === "grant_ready" && grant?.purpose === "review"
        ? { id: "public.reporting.grant.reviewTitle", defaultMessage: "Allow bounded reviews" }
        : stage === "grant_active" && grant?.purpose === "review"
          ? {
              id: "public.reporting.grant.reviewActiveTitle",
              defaultMessage: "Review permission active",
            }
          : copy.title;

  return (
    <CeremonyFrame
      channel={props.channelLabel}
      title={
        props.error === "outcome_unknown"
          ? {
              id: "public.reporting.uncertain.title",
              defaultMessage: "Checking whether the request was sent",
            }
          : title
      }
      body={
        props.error === "outcome_unknown"
          ? {
              id: "public.reporting.uncertain.body",
              defaultMessage:
                "The result isn't confirmed yet. Don't send it again while Green Goods checks the network.",
            }
          : stage === "unsupported" && isGrant
            ? {
                id: "public.reporting.grant.unsupported",
                defaultMessage:
                  "A safe assistant permission isn't available for this account yet. Return to your chat to sign this report or decision with your own wallet or passkey.",
              }
            : stage === "grant_active" && grant?.purpose === "review"
              ? {
                  id: "public.reporting.grant.reviewActiveBody",
                  defaultMessage:
                    "The assistant can record your review decisions within these limits after you confirm each decision in chat. You can remove permissions from the reporting permissions page.",
                }
              : copy.body
      }
      values={{ garden: resource?.gardenLabel ?? "" }}
      error={
        props.error
          ? { message: FAILURE_COPY[props.error], caution: CAUTIONS.has(props.error) }
          : null
      }
      actions={
        <>
          {stage === "intro" || stage === "opening" ? (
            <Button size="lg" loading={stage === "opening"} onClick={() => void props.start()}>
              {intl.formatMessage({
                id: "public.reporting.intro.continue",
                defaultMessage: "Continue",
              })}
            </Button>
          ) : null}
          {stage === "connect" || stage === "proving" ? (
            <AccountStep
              account={props.account}
              connecting={props.connecting}
              proving={stage === "proving"}
              onConnectWallet={props.connectWallet}
              onConnectPasskey={() => void props.connectPasskey()}
              onProve={() => void props.prove()}
            />
          ) : null}
          {stage === "review" || stage === "signing" ? (
            <Button
              size="lg"
              loading={stage === "signing"}
              disabled={wrongAccount || props.issues.length > 0}
              onClick={() => void props.publish()}
            >
              {isReview
                ? intl.formatMessage({
                    id: "public.reporting.review.record",
                    defaultMessage: "Record decision",
                  })
                : intl.formatMessage({
                    id: "public.reporting.review.publish",
                    defaultMessage: "Publish",
                  })}
            </Button>
          ) : null}
          {stage === "grant_ready" || stage === "grant_signing" ? (
            <Button
              size="lg"
              loading={stage === "grant_signing"}
              disabled={
                !grant ||
                wrongAccount ||
                props.issues.length > 0 ||
                Boolean(resource && !operation?.envelope)
              }
              onClick={() => void props.installGrant()}
            >
              {intl.formatMessage(
                resource
                  ? grant?.purpose === "review"
                    ? {
                        id: "public.reporting.grant.allowFirstReview",
                        defaultMessage: "Allow and record first review",
                      }
                    : {
                        id: "public.reporting.grant.allowFirstReport",
                        defaultMessage: "Allow and publish first report",
                      }
                  : grant?.purpose === "review"
                    ? {
                        id: "public.reporting.grant.prepareReview",
                        defaultMessage: "Prepare first review",
                      }
                    : {
                        id: "public.reporting.grant.prepareReport",
                        defaultMessage: "Prepare first report",
                      }
              )}
            </Button>
          ) : null}
          {isGrant && stage !== "grant_signing" ? (
            <Button size="lg" emphasis="secondary" asChild>
              <a href="/agent/reporting/permissions" target="_blank" rel="noopener noreferrer">
                {intl.formatMessage({
                  id: "public.reporting.grant.manage",
                  defaultMessage: "Manage Permissions",
                })}
              </a>
            </Button>
          ) : null}
          {SESSION.has(stage) ? (
            <Button size="lg" emphasis="tertiary" onClick={() => void props.leave()}>
              {intl.formatMessage({
                id: "public.reporting.leave",
                defaultMessage: "Sign out of this page",
              })}
            </Button>
          ) : null}
        </>
      }
    >
      {twoSignatures &&
      (stage === "connect" ||
        stage === "proving" ||
        stage === "review" ||
        stage === "grant_ready") ? (
        <p className="rounded-xl bg-bg-weak-50 px-4 py-3 text-sm font-medium text-text-sub-600">
          {stage === "grant_ready"
            ? intl.formatMessage(
                resource
                  ? {
                      id: "public.reporting.step.install",
                      defaultMessage:
                        "Signature 2 of 2: allow permission and publish the first item",
                    }
                  : {
                      id: "public.reporting.grant.prepareNotice",
                      defaultMessage: "Preparing the first item does not request a signature.",
                    }
              )
            : stage === "review"
              ? intl.formatMessage({
                  id: "public.reporting.step.publish",
                  defaultMessage: "Signature 2 of 2: publish",
                })
              : intl.formatMessage({
                  id: "public.reporting.step.prove",
                  defaultMessage: "Signature 1 of 2: prove the account",
                })}
        </p>
      ) : null}
      {stage === "pairing" && props.pairingCode ? (
        <p
          className="rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-6 text-center font-mono text-3xl font-semibold tracking-[0.2em] text-text-strong-950 sm:text-4xl"
          aria-label={props.pairingCode.split("").join(" ")}
        >
          {props.pairingCode}
        </p>
      ) : null}
      {(stage === "review" || stage === "signing") && resource ? (
        <>
          <PublicationSummary resource={resource} evidenceUrl={props.evidenceUrl} />
          {signer ? (
            <p className="min-w-0 break-words text-sm text-text-sub-600" title={signer}>
              {intl.formatMessage(
                { id: "public.reporting.review.signer", defaultMessage: "From account {account}" },
                { account: formatAddress(signer) }
              )}
            </p>
          ) : null}
          {wrongAccount ? (
            <p role="alert" className="text-sm text-text-strong-950">
              {intl.formatMessage(FAILURE_COPY.wrong_account)}
            </p>
          ) : null}
        </>
      ) : null}
      {grant && (stage.startsWith("grant_") || (isGrant && stage === "loading")) ? (
        <>
          <GrantSummary grant={grant} />
          {resource && (stage === "grant_ready" || stage === "grant_signing") ? (
            <>
              <p className="rounded-xl bg-bg-weak-50 px-4 py-3 text-sm font-medium text-text-sub-600">
                {intl.formatMessage(
                  {
                    id: "public.reporting.grant.firstCounts",
                    defaultMessage:
                      "This first publication uses 1 of the {maximum} allowed publications. Check it before approving the permission.",
                  },
                  { maximum: grant.policy.maxSubmissions }
                )}
              </p>
              <PublicationSummary resource={resource} evidenceUrl={props.evidenceUrl} />
            </>
          ) : null}
          <p className="break-words text-sm text-text-sub-600" title={grant.policy.account}>
            {intl.formatMessage(
              { id: "public.reporting.review.signer", defaultMessage: "From account {account}" },
              { account: formatAddress(grant.policy.account) }
            )}
          </p>
        </>
      ) : null}
      {stage === "grant_ready" && wrongAccount ? (
        <p role="alert" className="text-sm text-text-strong-950">
          {intl.formatMessage(FAILURE_COPY.wrong_account)}
        </p>
      ) : null}
      {WAITING.has(stage) ? (
        <div role="status" className="flex items-center gap-3 text-sm text-text-sub-600">
          <Spinner size="sm" />
          {intl.formatMessage({
            id: "public.reporting.waiting",
            defaultMessage: "Checking for updates…",
          })}
        </div>
      ) : null}
    </CeremonyFrame>
  );
}
