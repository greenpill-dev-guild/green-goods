import { Alert } from "@green-goods/shared/components/Alert";
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { RemixiconComponentType } from "@remixicon/react";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { type MessageDescriptor, useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";
import { EmptyState, FormProgress } from "@/components/Communication";
import { FocusedHeaderSteps } from "@/components/Navigation/FocusedSiteHeader";
import { CeremonyBar } from "./CeremonyBar";
import type { CeremonyProblem } from "./failures";

export interface CeremonyHeading {
  title: MessageDescriptor | string;
  info: ReactNode;
  Icon?: RemixiconComponentType;
}

/** The words saying why an act is switched off, which the act names as its description. */
export const BLOCKED_ID = "ceremony-blocked";

const PROBLEM_TEXT = {
  error: "text-error-dark",
  caution: "text-warning-dark",
  neutral: "",
};

/**
 * Command surface, solid material. The ceremony is drawn as the app's flows are (Submit Work, Add
 * Proof), and every band that changes with the state is kept at one size, as the app's sign-in
 * screen keeps its zones, so the report or permission under them never moves:
 *
 * - the top bar holds the flow's steps, only while there is a step to take;
 * - the heading card is a title and two lines, whatever they say;
 * - the status card, where the view gives one, is the app's stacked notice: a title and two lines;
 * - the bottom bar is one row: the step's buttons or, once nothing is left to press, where the
 *   request stands.
 *
 * The page between the bars is the report or permission and nothing else: the account, signing out
 * and help live in the top bar's sheet. A problem never adds a band either. The status card says
 * it where there is one, and on a screen without one it takes the heading card's two lines.
 *
 * A screen that is not a step (the link can't be used, the step isn't available here) is the app's
 * empty state, as the proof flow shows its own, with nothing to act on.
 *
 * The page is never indexed, never sends a referrer, and its title never carries the chat link.
 */
export function CeremonyFrame({
  screen = "step",
  steps = null,
  heading,
  values,
  problem = null,
  notice = null,
  children,
  actions = null,
  barStatus = null,
  hideHeadingIcon = false,
}: {
  /** `state` draws the heading as the app's empty state and leaves out the steps and the bar. */
  screen?: "step" | "state";
  /** The flow's named steps and the one in progress, 1-based; null where nothing is stepped. */
  steps?: { names: string[]; current: number } | null;
  heading: CeremonyHeading;
  values?: Record<string, string>;
  /** What stops or failed the step, on a screen with no status card to say it. */
  problem?: CeremonyProblem | null;
  /** Where the request stands, under the heading (the app's stacked notice). */
  notice?: ReactNode;
  children?: ReactNode;
  /** The step's acts, primary first. */
  actions?: ReactNode;
  /** In place of acts: where the request stands, at the act's height. */
  barStatus?: ReactNode;
  hideHeadingIcon?: boolean;
}) {
  const intl = useIntl();
  const title =
    typeof heading.title === "string" ? heading.title : intl.formatMessage(heading.title, values);
  const isState = screen === "state";
  const hasActions = !isState && actions !== null;
  const hasBar = hasActions || (!isState && barStatus !== null);
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
      {steps && !isState ? (
        <FocusedHeaderSteps>
          <FormProgress currentStep={steps.current} steps={steps.names} />
        </FocusedHeaderSteps>
      ) : null}
      <div className="@container mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 px-4 pb-6 sm:px-6">
        {isState ? (
          // The state's own words already say what went wrong, so no notice repeats them.
          <EmptyState
            titleAs="h1"
            headingId="ceremony-title"
            tone="warning"
            icon={heading.Icon ? <heading.Icon /> : undefined}
            title={title}
            description={heading.info}
          />
        ) : (
          <>
            <FormInfo
              data-component="CeremonyHeading"
              titleAs="h1"
              headingId="ceremony-title"
              title={title}
              // Two lines are kept whatever the step says, so every step's card is one height.
              info={
                <span className="block min-h-[2lh]">
                  {problem ? (
                    <span
                      id={BLOCKED_ID}
                      role={problem.tone === "error" ? "alert" : "status"}
                      data-component="CeremonyHeadingProblem"
                      className={cn("block font-medium", PROBLEM_TEXT[problem.tone])}
                    >
                      {intl.formatMessage(problem.message, problem.values)}
                    </span>
                  ) : (
                    heading.info
                  )}
                </span>
              }
              Icon={hideHeadingIcon ? undefined : heading.Icon}
              // Enlarged text may need more than the form card's cap; it grows rather than clips.
              className="max-h-none"
            />
            {notice}
          </>
        )}
        {children}
      </div>
      {hasBar ? <CeremonyBar>{hasActions ? actions : barStatus}</CeremonyBar> : null}
    </section>
  );
}

/**
 * Where a request stands, under the heading, as the app's work page says where queued work stands:
 * an icon and title on one line, then two lines on what happens next. It is in place before the
 * request is sent, so sending it moves nothing, and a problem is said in it, in the same two lines.
 */
export function StageNotice({
  id,
  variant,
  icon,
  title,
  body,
  values,
}: {
  id?: string;
  variant: "info" | "success" | "warning" | "error";
  /** Replaces the variant's icon: a clock before sending, a spinner while waiting. */
  icon?: ReactNode;
  title: MessageDescriptor;
  body: MessageDescriptor;
  values?: Record<string, string | number>;
}) {
  const intl = useIntl();
  return (
    <Alert variant={variant} layout="stacked" icon={icon} title={intl.formatMessage(title)}>
      <p id={id} data-component="CeremonyStageNotice">
        {intl.formatMessage(body, values)}
      </p>
    </Alert>
  );
}
