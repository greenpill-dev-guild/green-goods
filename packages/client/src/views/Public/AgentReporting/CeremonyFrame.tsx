import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { useDocumentEvent, useWindowEvent } from "@green-goods/shared/hooks/utils/useEventListener";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  RiExternalLinkLine,
  RiLogoutBoxRLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { type MessageDescriptor, useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";
import { EmptyState, FormProgress } from "@/components/Communication";
import { FlowBar, FlowBarNote, FlowForward } from "@/components/Features/Work";

/** A failure or a reason the step's act is blocked, in the person's terms. */
export interface CeremonyNotice {
  message: MessageDescriptor;
  /** `caution` asks for patience; `neutral` only explains a wait. */
  tone: "error" | "caution" | "neutral";
}

export interface CeremonyHeading {
  title: MessageDescriptor | string;
  info: ReactNode;
  Icon: RemixiconComponentType;
}

/** The bar's line saying why the act waits, which the act names as its description. */
export const BLOCKED_ID = "ceremony-blocked";

/**
 * Command surface, solid material. The ceremony is drawn as the app's flows are (Submit Work, Add
 * Proof): the named steps, the step's heading card, a notice saying where things stand, what the
 * step shows, and the fixed bar with the step's act or, when there is none, where it stands. The
 * bar keeps its place from the first step to the outcome: the act or the standing line sits on the
 * same row at the bottom edge, and only the lines explaining an act are added above it.
 *
 * A screen that is not a step (the link can't be used, the step isn't available here) is the app's
 * empty state, as the proof flow shows its own, with nothing to act on.
 *
 * The page is never indexed, never sends a referrer, and its title never carries the chat link.
 */
export function CeremonyFrame({
  channel,
  screen = "step",
  steps = null,
  heading,
  values,
  notice = null,
  error = null,
  blocked = null,
  children,
  utilities = null,
  barNotes = null,
  actions = null,
  barStatus = null,
}: {
  channel: string | null;
  /** `state` draws the heading as the app's empty state and leaves out the steps and the bar. */
  screen?: "step" | "state";
  /** The flow's named steps and the one in progress, 1-based; one past the end when done. */
  steps?: { names: string[]; current: number } | null;
  heading: CeremonyHeading;
  values?: Record<string, string>;
  /** Where the step stands, under its heading (the app's stacked notice). */
  notice?: ReactNode;
  error?: CeremonyNotice | null;
  /** Why the act is blocked, said in the bar above it. */
  blocked?: CeremonyNotice | null;
  children?: ReactNode;
  /** Page utilities such as signing out, kept out of the step's acts. */
  utilities?: ReactNode;
  /** Lines over the bar's act: which signature it asks for, and from which account. */
  barNotes?: ReactNode;
  /** The step's acts, primary first. */
  actions?: ReactNode;
  /** In place of acts: where the step stands, at the act's height. */
  barStatus?: ReactNode;
}) {
  const intl = useIntl();
  const title =
    typeof heading.title === "string" ? heading.title : intl.formatMessage(heading.title, values);
  const isState = screen === "state";
  const hasActions = !isState && actions !== null;
  const hasBar = hasActions || (!isState && barStatus !== null);
  const reason = blocked && blocked.message.id !== error?.message.id ? blocked : null;
  return (
    <section aria-labelledby="ceremony-title" className="font-sans">
      <Helmet>
        <title>
          {intl.formatMessage({
            id: "public.reporting.documentTitle",
            defaultMessage: "Green Goods",
          })}
        </title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <div className="@container mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
        {channel ? (
          <p className="text-xs font-medium text-text-sub-600">
            {intl.formatMessage(
              { id: "public.reporting.eyebrow", defaultMessage: "From your {channel} chat" },
              { channel }
            )}
          </p>
        ) : null}
        {isState ? (
          // The state's own words already say what went wrong, so no notice repeats them.
          <EmptyState
            titleAs="h1"
            headingId="ceremony-title"
            tone="warning"
            icon={<heading.Icon />}
            title={title}
            description={heading.info}
          />
        ) : (
          <>
            {steps ? <FormProgress currentStep={steps.current} steps={steps.names} /> : null}
            <FormInfo
              titleAs="h1"
              headingId="ceremony-title"
              title={title}
              info={heading.info}
              Icon={heading.Icon}
              // These explanations run longer than a form step's, more so translated or enlarged.
              className="max-h-none"
            />
            {notice}
            {error && !hasActions ? <Notice notice={error} /> : null}
          </>
        )}
        {children}
        {utilities ? (
          <div className="flex min-w-0 flex-col gap-3" data-component="CeremonyUtilities">
            <h2 className="mt-2 text-base font-semibold text-text-strong-950">
              {intl.formatMessage({ id: "app.home.work.actions", defaultMessage: "Actions" })}
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{utilities}</div>
          </div>
        ) : null}
      </div>
      {hasBar ? (
        <CeremonyBar
          status={
            error || reason || barNotes ? (
              <>
                {error && hasActions ? <Notice notice={error} /> : null}
                {barNotes}
                {reason ? <Notice id={BLOCKED_ID} notice={reason} /> : null}
              </>
            ) : null
          }
        >
          {hasActions ? actions : barStatus}
        </CeremonyBar>
      ) : null}
    </section>
  );
}

/**
 * The app's flow bar, fixed to the bottom of the viewport at every width, its content held to the
 * page's column. A spacer of its measured height keeps the end of the content clear of it, and the
 * document's scroll edge is padded by the same height so a field or link that takes focus stays
 * above it.
 *
 * The bar never takes the page away: on a viewport too short to share (under 20rem, as at 400%
 * zoom), or when its own lines make it taller than half the viewport (large text, a long reason on
 * a small phone), it follows the content instead of covering it.
 */
function CeremonyBar({ status, children }: { status: ReactNode; children: ReactNode }) {
  const intl = useIntl();
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? Number.POSITIVE_INFINITY : window.innerHeight
  );
  useWindowEvent("resize", () => setViewportHeight(window.innerHeight));
  const follows = barHeight !== null && barHeight > viewportHeight / 2;
  const barRef = useRef<HTMLDivElement | null>(null);
  const setBar = useCallback((element: HTMLDivElement | null) => {
    barRef.current = element;
    if (!element || typeof ResizeObserver === "undefined") return;
    // The bar's own padding counts, so read its border box rather than its content box.
    const measure = () => setBarHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (barHeight === null || follows) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `${barHeight}px`;
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [barHeight, follows]);
  // Browsers leave a control that is already partly in view where it is when it takes focus, so
  // one of the page's own controls that the bar half covers is moved above it; `nearest` stops at
  // the padded scroll edge. Dialogs sit above the bar and are left alone.
  const regionRef = useRef<HTMLDivElement | null>(null);
  useDocumentEvent("focusin", (event) => {
    const bar = barRef.current;
    const page = regionRef.current?.parentElement;
    const target = event.target;
    if (!bar || !page || !(target instanceof Element) || bar.contains(target)) return;
    if (!page.contains(target) || getComputedStyle(bar).position === "static") return;
    const barTop = bar.getBoundingClientRect().top;
    const { top, bottom } = target.getBoundingClientRect();
    if (bottom > barTop && top < window.innerHeight) target.scrollIntoView({ block: "nearest" });
  });
  return (
    <>
      <div
        aria-hidden="true"
        data-component="CeremonyBarSpacer"
        className={cn(
          "[@media(max-height:20rem)]:hidden",
          follows && "hidden",
          barHeight === null && "h-[calc(7rem+env(safe-area-inset-bottom))]"
        )}
        style={barHeight === null ? undefined : { height: barHeight }}
      />
      <div
        ref={regionRef}
        role="region"
        aria-label={intl.formatMessage({
          id: "public.reporting.actionBar.label",
          defaultMessage: "Next step",
        })}
        data-component="CeremonyBar"
        className={cn(
          "[@media(max-height:20rem)]:[&>[data-component=FlowBar]]:static",
          follows && "[&>[data-component=FlowBar]]:static"
        )}
      >
        <FlowBar layout="column" ref={setBar} status={status}>
          {children}
        </FlowBar>
      </div>
    </>
  );
}

function Notice({ notice, id }: { notice: CeremonyNotice; id?: string }) {
  const intl = useIntl();
  const text = intl.formatMessage(notice.message);
  if (notice.tone === "neutral") return <FlowBarNote id={id}>{text}</FlowBarNote>;
  return (
    <div id={id}>
      <Alert variant={notice.tone === "caution" ? "warning" : "error"} className="p-3">
        {text}
      </Alert>
    </div>
  );
}

/**
 * Where a request stands once it has left the page, under the heading, as the app's work page says
 * where queued work stands: an icon and title on one line, then what happens next.
 */
export function StageNotice({
  variant,
  icon,
  title,
  body,
}: {
  variant: "info" | "success" | "warning" | "error";
  /** Replaces the variant's icon: a spinner while waiting, a refresh while checking. */
  icon?: ReactNode;
  title: MessageDescriptor;
  body: MessageDescriptor;
}) {
  const intl = useIntl();
  return (
    <Alert variant={variant} layout="stacked" icon={icon} title={intl.formatMessage(title)}>
      <p data-component="CeremonyStageNotice">{intl.formatMessage(body)}</p>
    </Alert>
  );
}

/**
 * Where the step stands, in the bar at the act's height, as the work page shows a settled
 * review: an icon and a short line, centred.
 */
export function BarStatus({
  tone,
  icon,
  announce = true,
  children,
}: {
  tone: "neutral" | "success" | "error";
  icon: ReactNode;
  /** Off when a notice under the heading already announces the same outcome. */
  announce?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      role={announce ? "status" : undefined}
      data-component="CeremonyBarStatus"
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 text-center text-sm font-medium",
        tone === "success"
          ? "text-success-dark"
          : tone === "error"
            ? "text-error-dark"
            : "text-text-sub-600"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 [&>svg]:h-5 [&>svg]:w-5",
          tone === "success" ? "text-success-base" : tone === "error" ? "text-error-base" : ""
        )}
      >
        {icon}
      </span>
      {children}
    </p>
  );
}

/** One line over the act: which signature it asks for, and from which account. */
export function ActContext({
  step = null,
  account = null,
}: {
  step?: ReactNode;
  account?: ReactNode;
}) {
  if (!step && !account) return null;
  return (
    <FlowBarNote>
      {step}
      {step && account ? " · " : null}
      {account}
    </FlowBarNote>
  );
}

/** "Connected as …" for the account in the browser, "From account …" for the one that signs. */
export function AccountLine({
  account,
  relation,
}: {
  account: string;
  relation: "connected" | "signer";
}) {
  const intl = useIntl();
  return (
    <span title={account}>
      {intl.formatMessage(
        relation === "connected"
          ? { id: "public.reporting.connect.as", defaultMessage: "Connected as {account}" }
          : { id: "public.reporting.review.signer", defaultMessage: "From account {account}" },
        { account: formatAddress(account) }
      )}
    </span>
  );
}

/**
 * Two acts on one row, as the promise page pairs them: each starts at half the row, the primary on
 * the right, and both take full rows, the primary on top, when a label would not fit. A label
 * wider than a whole row (large text on a small phone) wraps inside its button.
 */
export function PairedActs({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-row-reverse flex-wrap gap-2 [&>.gg-button]:min-w-fit [&>.gg-button]:grow [&>.gg-button]:whitespace-normal [&>.gg-button]:basis-[calc(50%-0.25rem)]">
      {children}
    </div>
  );
}

/** Connect or prove an existing account; this page never creates one. */
export function AccountActions({
  account,
  connecting,
  proving,
  onConnectWallet,
  onConnectPasskey,
  onProve,
}: {
  account: string | null;
  connecting: boolean;
  proving: boolean;
  onConnectWallet: () => void;
  onConnectPasskey: () => void;
  onProve: () => void;
}) {
  const intl = useIntl();
  if (account) {
    return (
      <FlowForward
        label={intl.formatMessage({
          id: "public.reporting.connect.sign",
          defaultMessage: "Sign to Continue",
        })}
        onClick={onProve}
        loading={proving}
      />
    );
  }
  return (
    <ConnectActions
      connecting={connecting}
      onConnectWallet={onConnectWallet}
      onConnectPasskey={onConnectPasskey}
    />
  );
}

/** Connect the wallet or passkey the person already uses with Green Goods. */
export function ConnectActions({
  connecting,
  onConnectWallet,
  onConnectPasskey,
}: {
  connecting: boolean;
  onConnectWallet: () => void;
  onConnectPasskey: () => void;
}) {
  const intl = useIntl();
  return (
    <PairedActs>
      <Button size="lg" loading={connecting} onClick={onConnectWallet}>
        {intl.formatMessage({
          id: "public.reporting.connect.wallet",
          defaultMessage: "Connect Wallet",
        })}
      </Button>
      <Button size="lg" emphasis="secondary" disabled={connecting} onClick={onConnectPasskey}>
        {intl.formatMessage({
          id: "public.reporting.connect.passkey",
          defaultMessage: "Use My Passkey",
        })}
      </Button>
    </PairedActs>
  );
}

/** Opens the owner permissions page beside the ceremony, never in its place. */
export function ManagePermissionsLink() {
  const intl = useIntl();
  return (
    <Button
      emphasis="secondary"
      className="w-full sm:w-auto"
      leadingIcon={<RiExternalLinkLine className="h-5 w-5" aria-hidden="true" />}
      asChild
    >
      <a href="/agent/reporting/permissions" target="_blank" rel="noopener noreferrer">
        {intl.formatMessage({
          id: "public.reporting.grant.manage",
          defaultMessage: "Manage Permissions",
        })}
        <span className="sr-only">
          {intl.formatMessage({
            id: "public.reporting.opensInNewTab",
            defaultMessage: "(opens in a new tab)",
          })}
        </span>
      </a>
    </Button>
  );
}

/** Ends this browser's access to the request, for a shared phone or computer. */
export function SignOutButton({ onLeave }: { onLeave: () => void }) {
  const intl = useIntl();
  return (
    <Button
      emphasis="secondary"
      className="w-full sm:w-auto"
      leadingIcon={<RiLogoutBoxRLine className="h-5 w-5" aria-hidden="true" />}
      onClick={onLeave}
    >
      {intl.formatMessage({
        id: "public.reporting.leave",
        defaultMessage: "Sign Out of This Page",
      })}
    </Button>
  );
}
