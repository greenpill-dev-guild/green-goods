import { Alert } from "@green-goods/shared/components/Alert";
import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { type MessageDescriptor, useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";
import { EmptyState, FormProgress } from "@/components/Communication";
import { FlowBarNote } from "@/components/Features/Work";
import { CeremonyBar } from "./CeremonyBar";

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
