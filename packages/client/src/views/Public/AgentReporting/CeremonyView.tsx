import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { RiPlantLine, RiUserAddLine, RiUserSearchLine } from "@remixicon/react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import { FlowForward } from "@/components/Features/Work";
import { AccountActions, PageAccount } from "./CeremonyActs";
import { BLOCKED_ID, CeremonyFrame } from "./CeremonyFrame";
import { barStanding, hasStatusCard, StatusCard } from "./CeremonyOutcome";
import { ceremonyHeading, GardenLine } from "./CeremonyHeading";
import { readCeremonyScreen } from "./ceremonyScreen";
import { BLOCKS, type CeremonyProblem, failureProblem, type SpokenProblem } from "./failures";
import { GrantSummary } from "./GrantSummary";
import {
  AccountNameForm,
  AccountStepLinks,
  BrowserActs,
  JoinActs,
  NameActs,
  type NameScreen,
} from "./LinkScreens";
import { PublicationSkeleton, PublicationSummary } from "./PublicationSummary";
import { CEREMONY_COPY, STEP_NAMES } from "./messages";
import { WhatHappensNext } from "./WhatHappensNext";

type CeremonyViewProps = Pick<
  AgentReportingCeremony,
  | "stage"
  | "purpose"
  | "channelLabel"
  | "pairingCode"
  | "linkedAccount"
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
  | "canFindAccount"
  | "changeAccount"
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
  /** Story fixture for the account step's naming screens. */
  initialName?: NameScreen;
};

/** Stages in which a signature is being asked for, so the account under it must not change. */
const SIGNING = new Set<AgentReportingCeremony["stage"]>([
  "opening",
  "proving",
  "signing",
  "grant_signing",
]);

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

/** What the link flow's own screens say in the heading card's two lines. */
const NOTES = {
  inApp: {
    id: "public.reporting.browser.warning",
    defaultMessage: "Open this in Safari or Chrome. Passkeys and wallets may fail here.",
  },
  copied: {
    id: "public.reporting.browser.copied",
    defaultMessage: "Link copied. If nothing opened, paste it in Safari or Chrome.",
  },
  noPasskey: {
    id: "public.reporting.browser.noPasskey",
    defaultMessage: "Passkeys aren't available here. Open in Safari or Chrome, or use a wallet.",
  },
  joinFailed: {
    id: "public.reporting.join.failed",
    defaultMessage: "Joining didn't go through. Try again, or tap Not Now.",
  },
} satisfies Record<string, MessageDescriptor>;

/**
 * The browser step of a chat report, review or permission, drawn with the app's flow parts. The
 * frame lays the page out and keeps its bands at one size; this view decides what each stage shows
 * and which act, if any, its bar offers. What a stage shows keeps its place and its order from the
 * step it first appears on, so sending the request moves nothing. A send whose outcome is unknown
 * never gets an act.
 *
 * Linking an account has two screens of its own: naming a new account, on the account step, and
 * the invitation to the Community Garden, which opens the link step for an account in no garden.
 *
 * The account step starts on whichever account this browser last used with Green Goods, which
 * need not be the one meant for the chat. So it always offers a way to another: let go of the one
 * connected, or find an account kept on another device by the name it was created with.
 */
export function CeremonyView(props: CeremonyViewProps) {
  const intl = useIntl();
  const firstItemId = useId();
  const createFormId = useId();
  const [naming, setNaming] = useState<NameScreen | null>(props.initialName ?? null);
  const [name, setName] = useState("");
  const openNaming = (next: NameScreen | null) => {
    setName("");
    setNaming(next);
  };
  // An account created or found arrives connected, which ends the naming screen.
  useEffect(() => {
    if (props.account) setNaming(null);
  }, [props.account]);
  const { stage, resource, operation, grant } = props;
  const screen = readCeremonyScreen(props);
  const { isGrant, decides, uncertain, proving, publishing, granting } = screen;
  const inApp = stage === "intro" && props.inAppBrowser;
  const createScreen = naming === "create" && screen.isLink && stage === "connect";
  const findScreen = naming === "find" && stage === "connect" && !props.account;
  const nameScreen: NameScreen | null = createScreen ? "create" : findScreen ? "find" : null;
  const offer =
    screen.isLink && (stage === "pairing" || stage === "linked") ? props.communityOffer : null;
  const joinScreen = offer !== null;
  // The invitation is for the account the chat links; another one connected here cannot take it.
  const linked = props.linkedAccount;
  const joinWrongAccount =
    joinScreen &&
    props.account !== null &&
    linked !== null &&
    props.account.toLowerCase() !== linked.toLowerCase();
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

  /** Connect an account, or sign with the one connected, while `signing` shows the prompt is open. */
  const accountActs = (account: string | null, signing = false) => (
    <AccountActions
      account={account}
      connecting={props.connecting}
      proving={signing}
      onConnectWallet={props.connectWallet}
      onConnectPasskey={() => void props.connectPasskey()}
      passkeyUnavailable={props.passkeyUnavailable}
      onProve={() => void props.prove()}
    />
  );

  const actions: ReactNode = (() => {
    if (inApp) {
      return (
        <BrowserActs onOpen={() => void props.openInBrowser()} onStay={() => void props.start()} />
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
    if (nameScreen) {
      return (
        <NameActs
          screen={nameScreen}
          formId={createFormId}
          name={name}
          busy={props.connecting}
          onBack={() => openNaming(null)}
        />
      );
    }
    if (joinScreen) {
      // The linked account signs the join, so a browser with none connected connects one first.
      if (!props.account) return accountActs(null);
      return (
        <JoinActs
          sending={props.joinSending}
          blocked={joinWrongAccount}
          onJoin={() => void props.joinCommunity()}
          onSkip={props.skipCommunity}
        />
      );
    }
    if (proving) return accountActs(props.account, stage === "proving");
    if (uncertain) return null;
    // A browser the Agent recognized opens Review signed in, with no account connected yet.
    if (stage === "review" && props.sessionAccount && !props.account) return accountActs(null);
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

  // What the heading card says in place of its two lines, on the screens with no status card.
  const headingProblem: CeremonyProblem | SpokenProblem | null = (() => {
    if (inApp) return { message: props.linkCopied ? NOTES.copied : NOTES.inApp, tone: "caution" };
    if (joinWrongAccount && linked) {
      return { ...BLOCKS.wrongAccount, values: { account: formatAddress(linked) }, tone: "error" };
    }
    if (joinScreen && props.joinFailure === "declined") return failureProblem("declined");
    if (joinScreen && props.joinFailure === "not_sent") {
      return { message: NOTES.joinFailed, tone: "error" };
    }
    // Connecting or creating an account failed: the account layer has already put it into words.
    if (props.lastFailure && !props.account && (proving || joinScreen)) {
      return { spoken: props.lastFailure, tone: "error" };
    }
    if (proving && !props.account && props.passkeyUnavailable) {
      return { message: NOTES.noPasskey, tone: "caution" };
    }
    return withStatus ? null : problem;
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
      hideHeadingIcon={inApp}
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
          : findScreen
            ? {
                title: { id: "public.reporting.find.title", defaultMessage: "Find Your Account" },
                info: text({
                  id: "public.reporting.find.body",
                  defaultMessage: "Enter its name. Its passkey must be on this device or nearby.",
                }),
                Icon: RiUserSearchLine,
              }
            : joinScreen
              ? {
                  title: { id: "public.reporting.join.title", defaultMessage: "Join a Garden" },
                  info: text({
                    id: "public.reporting.join.body",
                    defaultMessage: "Anyone can join this garden and report to it:",
                  }),
                  Icon: RiPlantLine,
                }
              : // "Account linked" names the account the chat links, whatever is connected here.
                ceremonyHeading(intl, screen, { ...props, account: linked ?? props.account })
      }
      // The status card says a problem where the screen has one; elsewhere the heading card does.
      problem={headingProblem}
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
        onChangeAccount={
          props.account && !SIGNING.has(stage) ? () => void props.changeAccount() : undefined
        }
        onLeave={SESSION.has(stage) ? () => void props.leave() : undefined}
      />
      {offer ? (
        <p className="min-w-0 text-base font-semibold text-text-strong-950">
          <GardenLine>{offer.name}</GardenLine>
        </p>
      ) : null}
      {nameScreen ? (
        <AccountNameForm
          screen={nameScreen}
          id={createFormId}
          name={name}
          onName={setName}
          onSubmit={(chosen) =>
            void (nameScreen === "create"
              ? props.createAccount(chosen)
              : props.connectPasskey(chosen))
          }
        />
      ) : null}
      {stage === "pairing" && !joinScreen && props.pairingCode ? (
        <p
          className="rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 px-4 py-6 text-center font-mono text-3xl font-semibold tracking-[0.2em] text-text-strong-950 [overflow-wrap:anywhere] sm:text-4xl"
          aria-label={props.pairingCode.split("").join(" ")}
        >
          {props.pairingCode}
        </p>
      ) : null}
      {joinScreen || screen.opening || (proving && !nameScreen) ? (
        <WhatHappensNext
          flow={
            joinScreen
              ? // A chat that is linked already has no code to send after joining.
                `${stage === "linked" ? "joined" : "join"}${props.accountKind === "passkey" ? "Free" : "Paid"}`
              : screen.isLink
                ? "link"
                : "any"
          }
        />
      ) : null}
      {(stage === "connect" && !nameScreen && !joinScreen) || joinWrongAccount ? (
        <AccountStepLinks
          account={props.account}
          canCreate={screen.isLink}
          canFind={props.canFindAccount}
          passkeyUnavailable={props.passkeyUnavailable}
          onName={openNaming}
          onChangeAccount={() => void props.changeAccount()}
        />
      ) : null}
      {publication}
      {/* The first item is the one thing not yet seen when Review opens, so it leads, and the
          order holds once the request is sent. */}
      {firstItem}
      {showsGrant && grant ? <GrantSummary grant={grant} /> : null}
    </CeremonyFrame>
  );
}
