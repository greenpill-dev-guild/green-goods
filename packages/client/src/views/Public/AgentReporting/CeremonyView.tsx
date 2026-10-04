import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { Button } from "@green-goods/shared/components/Button";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { RiPlantLine, RiUserAddLine } from "@remixicon/react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import { FlowForward } from "@/components/Features/Work";
import { AccountActions, PageAccount } from "./CeremonyActs";
import { BLOCKED_ID, CeremonyFrame } from "./CeremonyFrame";
import { barStanding, hasStatusCard, StatusCard } from "./CeremonyOutcome";
import { ceremonyHeading, GardenLine } from "./CeremonyHeading";
import { PairedActs } from "./CeremonyBar";
import { readCeremonyScreen } from "./ceremonyScreen";
import { BLOCKS, type CeremonyProblem, failureProblem } from "./failures";
import { GrantSummary } from "./GrantSummary";
import { PublicationSkeleton, PublicationSummary } from "./PublicationSummary";
import { CEREMONY_COPY, STEP_NAMES } from "./messages";
import { WhatHappensNext } from "./WhatHappensNext";

type CeremonyViewProps = Pick<
  AgentReportingCeremony,
  | "stage"
  | "purpose"
  | "channelLabel"
  | "pairingCode"
  | "inAppBrowser"
  | "passkeyUnavailable"
  | "linkCopied"
  | "openInBrowser"
  | "communityOffer"
  | "joinFailure"
  | "joinSending"
  | "skipCommunity"
  | "joinCommunity"
  | "lastFailure"
  | "createAccount"
  | "accountKind"
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
  /** Story fixture for the account creation screen. */
  initialCreate?: boolean;
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

/** The browser ceremony keeps its bands fixed and never offers a second send after uncertainty. */
export function CeremonyView(props: CeremonyViewProps) {
  const intl = useIntl();
  const firstItemId = useId();
  const createFormId = useId();
  const nameId = useId();
  const [creating, setCreating] = useState(props.initialCreate ?? false);
  const [name, setName] = useState("");
  useEffect(() => {
    if (props.account) setCreating(false);
  }, [props.account]);
  const { stage, resource, operation, grant } = props;
  const screen = readCeremonyScreen(props);
  const { isGrant, decides, uncertain, proving, publishing, granting } = screen;
  const createScreen = creating && screen.isLink && stage === "connect";
  const joinScreen =
    screen.isLink && (stage === "pairing" || stage === "linked") && props.communityOffer !== null;
  const text = (message: MessageDescriptor, values?: Record<string, string | number>) =>
    intl.formatMessage(message, values);
  const signer = grant?.policy.account ?? operation?.envelope?.accountAddress ?? null;
  const wrongAccount =
    (stage === "review" || stage === "grant_ready") &&
    signer !== null &&
    props.account?.toLowerCase() !== signer.toLowerCase();

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
  const failure = props.error && !uncertain ? failureProblem(props.error) : null;
  const problem = block?.tone === "error" ? block : (failure ?? block);
  const withStatus = hasStatusCard(screen);
  const describedBy = block ? BLOCKED_ID : undefined;

  const actions: ReactNode = (() => {
    if (stage === "intro" && props.inAppBrowser) {
      return (
        <PairedActs>
          <Button
            size="lg"
            className="!px-2 !text-sm"
            emphasis="secondary"
            onClick={() => void props.start()}
          >
            {text({ id: "public.reporting.browser.continue", defaultMessage: "Continue Here" })}
          </Button>
          <Button size="lg" className="!px-2 !text-sm" onClick={() => void props.openInBrowser()}>
            {text({ id: "public.reporting.browser.open", defaultMessage: "Open in Browser" })}
          </Button>
        </PairedActs>
      );
    }
    if (screen.opening) {
      return (
        <FlowForward
          label={text({ id: "public.reporting.intro.continue", defaultMessage: "Continue" })}
          loading={stage === "opening"}
          onClick={() => void props.start()}
        />
      );
    }
    if (createScreen) {
      return (
        <PairedActs>
          <Button size="lg" emphasis="secondary" onClick={() => setCreating(false)}>
            {text({ id: "app.login.button.back", defaultMessage: "Back" })}
          </Button>
          <Button
            size="lg"
            type="submit"
            form={createFormId}
            loading={props.connecting}
            disabled={name.trim().length < 3}
          >
            {text({ id: "app.login.button.createAccount", defaultMessage: "Create Account" })}
          </Button>
        </PairedActs>
      );
    }
    if (joinScreen) {
      return (
        <PairedActs>
          <Button
            size="lg"
            emphasis="secondary"
            disabled={props.joinSending}
            onClick={props.skipCommunity}
          >
            {text({ id: "public.reporting.join.notNow", defaultMessage: "Not Now" })}
          </Button>
          <Button size="lg" loading={props.joinSending} onClick={() => void props.joinCommunity()}>
            {text({ id: "public.reporting.join.action", defaultMessage: "Join Garden" })}
          </Button>
        </PairedActs>
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
          passkeyUnavailable={props.passkeyUnavailable}
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
          passkeyUnavailable={props.passkeyUnavailable}
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
      hideHeadingIcon={stage === "intro" && props.inAppBrowser}
      steps={
        joinScreen
          ? { names: [text(STEP_NAMES.account), text(STEP_NAMES.link)], current: 2 }
          : screen.steps
            ? { names: screen.steps.names.map((name) => text(name)), current: screen.steps.current }
            : null
      }
      heading={
        createScreen
          ? {
              title: { id: "public.reporting.create.title", defaultMessage: "Create Your Account" },
              info: text({
                id: "public.reporting.create.body",
                defaultMessage: "Pick a name and keep it safe. It signs you in on other devices.",
              }),
              Icon: RiUserAddLine,
            }
          : joinScreen && props.communityOffer
            ? {
                title: { id: "public.reporting.join.title", defaultMessage: "Join a Garden" },
                info: text({
                  id: "public.reporting.join.body",
                  defaultMessage: "You aren't in a garden yet. This one is open to all:",
                }),
                Icon: RiPlantLine,
              }
            : ceremonyHeading(intl, screen, props)
      }
      // The status card says a problem where the screen has one; elsewhere the heading card does.
      problem={
        stage === "intro" && props.inAppBrowser
          ? {
              message: props.linkCopied
                ? {
                    id: "public.reporting.browser.copied",
                    defaultMessage: "Link copied. If nothing opened, paste it in Safari or Chrome.",
                  }
                : {
                    id: "public.reporting.browser.warning",
                    defaultMessage:
                      "Open this in Safari or Chrome. Passkeys and wallets may fail here.",
                  },
              tone: "caution",
            }
          : proving && !props.account && props.passkeyUnavailable
            ? {
                message: {
                  id: "public.reporting.browser.noPasskey",
                  defaultMessage:
                    "Passkeys aren't available here. Open in Safari or Chrome, or use a wallet.",
                },
                tone: "caution",
              }
            : joinScreen && props.joinFailure === "declined"
              ? failureProblem("declined")
              : joinScreen && props.joinFailure === "not_sent"
                ? {
                    title: { id: "public.reporting.join.title", defaultMessage: "Join a Garden" },
                    message: {
                      id: "public.reporting.join.failed",
                      defaultMessage: "Joining didn't go through. Try again, or tap Not Now.",
                    },
                    tone: "error",
                  }
                : props.lastFailure && (proving || createScreen)
                  ? {
                      title: {
                        id: "public.reporting.connect.title",
                        defaultMessage: "Show It's Your Account",
                      },
                      message: { defaultMessage: props.lastFailure },
                      tone: "error",
                    }
                  : withStatus
                    ? null
                    : problem
      }
      notice={
        joinScreen ? null : <StatusCard screen={screen} problem={withStatus ? problem : null} />
      }
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
      {joinScreen && props.communityOffer ? (
        <p className="min-w-0 text-base font-semibold text-text-strong-950">
          <GardenLine>{props.communityOffer.name}</GardenLine>
        </p>
      ) : null}
      {createScreen ? (
        <form
          id={createFormId}
          className="flex min-w-0 flex-col gap-3"
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length < 3) return;
            void props.createAccount(name.trim());
          }}
        >
          <FormField
            htmlFor={nameId}
            required
            label={text({
              id: "app.login.username.newAccountLabel",
              defaultMessage: "Display name for new account",
            })}
            hint={text({
              id: "app.login.username.hint",
              defaultMessage:
                "Keep this name somewhere safe. You'll use it to sign in on another device.",
            })}
          >
            <TextInput
              id={nameId}
              name="displayName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={text({
                id: "app.login.username.placeholder",
                defaultMessage: "e.g. alice or alice.eth",
              })}
              minLength={3}
              autoComplete="nickname"
              required
            />
          </FormField>
        </form>
      ) : null}
      {stage === "pairing" && !joinScreen && props.pairingCode ? (
        <p
          className="rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-6 text-center font-mono text-3xl font-semibold tracking-[0.2em] text-text-strong-950 [overflow-wrap:anywhere] sm:text-4xl"
          aria-label={props.pairingCode.split("").join(" ")}
        >
          {props.pairingCode}
        </p>
      ) : null}
      {joinScreen || screen.opening || (proving && !createScreen) ? (
        <WhatHappensNext
          flow={
            joinScreen
              ? props.accountKind === "passkey"
                ? "joinPasskey"
                : "joinWallet"
              : screen.isLink
                ? "link"
                : "any"
          }
        />
      ) : null}
      {screen.isLink && stage === "connect" && !props.account && !createScreen ? (
        <Button
          type="button"
          size="sm"
          emphasis="tertiary"
          className="text-sm text-primary-action underline underline-offset-4"
          disabled={props.passkeyUnavailable}
          onClick={() => setCreating(true)}
        >
          {text({
            id: "public.reporting.create.link",
            defaultMessage: "New here? Create an account",
          })}
        </Button>
      ) : null}
      {publication}
      {/* The first item is the one thing not yet seen when Review opens, so it leads, and the
          order holds once the request is sent. */}
      {firstItem}
      {showsGrant && grant ? <GrantSummary grant={grant} /> : null}
    </CeremonyFrame>
  );
}
