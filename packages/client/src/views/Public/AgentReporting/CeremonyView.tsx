import { Button } from "@green-goods/shared/components/Button";
import { Spinner } from "@green-goods/shared/components/Spinner";
import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { useIntl } from "react-intl";
import { AccountStep, CeremonyFrame } from "./CeremonyFrame";
import { CAUTIONS, CEREMONY_COPY, FAILURE_COPY } from "./messages";

type CeremonyViewProps = Pick<
  AgentReportingCeremony,
  | "stage"
  | "purpose"
  | "channelLabel"
  | "pairingCode"
  | "resource"
  | "operation"
  | "issues"
  | "error"
  | "account"
  | "connecting"
  | "connectWallet"
  | "connectPasskey"
  | "start"
  | "prove"
  | "publish"
  | "leave"
>;

const WAITING = new Set(["pairing", "loading", "submitted"]);
const SESSION = new Set(["review", "submitted", "published", "not_sent", "failed"]);

/** The exact publication, line by line, as the Agent froze it. */
function PublicationSummary({
  resource,
}: {
  resource: NonNullable<CeremonyViewProps["resource"]>;
}) {
  const intl = useIntl();
  const lines = resource.lines.filter((line) => line.value.trim() !== "");
  return (
    <div className="border border-stroke-soft-200 bg-bg-weak-50">
      <div className="border-b border-stroke-soft-200 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
          {resource.gardenLabel}
        </p>
        <p className="mt-1 text-base font-semibold text-text-strong-950">{resource.title}</p>
      </div>
      <dl className="divide-y divide-stroke-soft-200">
        {lines.map((line) => (
          <div key={line.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
              {line.label}
            </dt>
            <dd className="break-words text-sm text-text-strong-950">{line.value}</dd>
          </div>
        ))}
      </dl>
      {resource.evidence.length > 0 ? (
        <p className="border-t border-stroke-soft-200 px-4 py-3 text-sm text-text-sub-600">
          {intl.formatMessage(
            {
              id: "public.reporting.review.evidence",
              defaultMessage:
                "{count, plural, one {# photo or file} other {# photos or files}} attached",
            },
            { count: resource.evidence.length }
          )}
        </p>
      ) : null}
    </div>
  );
}

export function CeremonyView(props: CeremonyViewProps) {
  const intl = useIntl();
  const { stage, resource, operation } = props;
  const copy = CEREMONY_COPY[stage];
  const isReview = props.purpose === "review_decision";
  // Publishing and reviewing take two signatures; say so before the first one.
  const twoSignatures = props.purpose === "publish_work" || isReview;
  const signer = operation?.envelope?.accountAddress ?? null;
  const wrongAccount =
    stage === "review" && signer !== null && props.account?.toLowerCase() !== signer.toLowerCase();
  const title =
    stage === "review" && isReview
      ? {
          id: "public.reporting.review.decisionTitle",
          defaultMessage: "Check and record your decision",
        }
      : copy.title;

  return (
    <CeremonyFrame
      channel={props.channelLabel}
      title={title}
      body={copy.body}
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
      {twoSignatures && (stage === "connect" || stage === "proving" || stage === "review") ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
          {stage === "review"
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
          className="border border-stroke-soft-200 bg-bg-weak-50 px-4 py-6 text-center font-mono text-4xl font-semibold tracking-[0.3em] text-text-strong-950"
          aria-label={props.pairingCode.split("").join(" ")}
        >
          {props.pairingCode}
        </p>
      ) : null}
      {(stage === "review" || stage === "signing") && resource ? (
        <>
          <PublicationSummary resource={resource} />
          {signer ? (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage(
                { id: "public.reporting.review.signer", defaultMessage: "From account {account}" },
                { account: formatAddress(signer) }
              )}
            </p>
          ) : null}
          {wrongAccount ? (
            <p className="text-sm text-text-strong-950">
              {intl.formatMessage(FAILURE_COPY.wrong_account)}
            </p>
          ) : null}
        </>
      ) : null}
      {WAITING.has(stage) ? (
        <div className="flex items-center gap-3 text-sm text-text-sub-600">
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
