import type {
  SubmissionFlowController,
  SubmissionStage,
} from "@green-goods/shared/hooks/client-ui/submission/useSubmissionFlowController";
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { FormEvent, ReactNode } from "react";
import { useIntl } from "react-intl";

import { FormProgress } from "@/components/Communication";
import { PinnedPromiseCard } from "@/components/Features/Commitments";
import { TopNav } from "@/components/Navigation";
import { FlowBar, FlowBarNote, FlowForward, MediaTools } from "./FlowBar";

const BLOCKED_ID = "submission-blocked";
const TAKE_UP_ID = "submission-take-up";
const preventSubmit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

export interface SubmissionFlowProps {
  flow: SubmissionFlowController;
  /** The kind's piece for the stage, handed the pinned promise to place after its heading (DL-058). */
  renderStage: (stage: SubmissionStage, pinned: ReactNode) => ReactNode;
  /** What the body says before the stage: where the work goes, the draft's news. */
  lead?: ReactNode;
  /** The bar's own lines above the act: where a send or its link stands. */
  barStatus?: ReactNode;
  /** The body keeps clear of a taller bar while a dependent link is scheduled or waits. */
  tallBar?: boolean;
  formId?: string;
  /** Keeps the keyboard's enter key from submitting the form itself; the forward act sends. */
  keepFormStill?: boolean;
}

/**
 * The one submission flow's page (DL-131): the top bar with the step markers spread beside Back,
 * the stage the kind renders under the body's lead, and the fixed bar with why the step waits,
 * the prompts an Open ask's take-up opens (Review), the media tools on Media, and the one forward
 * act. Start has no forward act, so it has no bar:
 * choosing moves on. Once a promise is chosen, the kind places the pinned promise after its
 * heading, so the heading scrolls away and the promise stays in view (DL-058).
 */
export function SubmissionFlow({
  flow,
  renderStage,
  lead,
  barStatus,
  tallBar = false,
  formId,
  keepFormStill = false,
}: SubmissionFlowProps) {
  const { formatMessage } = useIntl();
  const pinned = flow.promise.pinned ? (
    <PinnedPromiseCard
      kind={flow.kind === "evidence" ? "proof" : "work"}
      title={flow.promise.pinned.title}
      direction={flow.promise.pinned.direction}
      onOpen={flow.promise.show}
    />
  ) : null;
  const { forward } = flow;
  const blockedReason = forward?.blockedReasonId
    ? formatMessage({ id: forward.blockedReasonId })
    : null;
  const takeUp = forward?.takeUpPrompts
    ? formatMessage({ id: "app.garden.submit.takeUpPrompts" }, { count: forward.takeUpPrompts })
    : null;
  const describedBy = [blockedReason && BLOCKED_ID, takeUp && TAKE_UP_ID].filter(Boolean).join(" ");
  // A take-up's note makes the bar taller too: three lines in Spanish and Portuguese.
  const tall = tallBar || takeUp !== null;

  return (
    <>
      <TopNav
        onBackClick={flow.back}
        overlay
        steps={
          <FormProgress
            layout="spread"
            currentStep={flow.progress}
            steps={flow.stageLabelIds.map((id) => formatMessage({ id }))}
          />
        }
      />
      <form
        id={formId}
        className="relative py-6 pt-[var(--app-top-bar-height)] flex flex-col gap-4 min-h-[calc(100vh-7.5rem)]"
        onSubmit={keepFormStill ? preventSubmit : undefined}
      >
        <div
          className={cn(
            "padded relative flex flex-col gap-4 flex-1",
            !forward
              ? "pb-[calc(1.5rem+var(--safe-area-bottom))]"
              : tall
                ? "pb-[calc(14rem+var(--safe-area-bottom))]"
                : "pb-[calc(7rem+var(--safe-area-bottom))]"
          )}
        >
          {lead}
          {renderStage(flow.stage, pinned)}
        </div>
      </form>
      {forward ? (
        <FlowBar
          status={
            <>
              {blockedReason ? <FlowBarNote id={BLOCKED_ID}>{blockedReason}</FlowBarNote> : null}
              {takeUp ? <FlowBarNote id={TAKE_UP_ID}>{takeUp}</FlowBarNote> : null}
              {barStatus}
            </>
          }
          tools={
            flow.mediaTools ? (
              <MediaTools
                onGallery={flow.mediaTools.openGallery}
                onCamera={flow.mediaTools.openCamera}
                onToggleRecording={flow.mediaTools.toggleRecording}
                isRecording={flow.mediaTools.isRecording}
                disabled={flow.mediaTools.disabled}
              />
            ) : null
          }
        >
          <FlowForward
            label={formatMessage({ id: forward.labelId })}
            onClick={forward.run}
            disabled={forward.disabled}
            loading={forward.loading}
            describedBy={describedBy || undefined}
          />
        </FlowBar>
      ) : null}
    </>
  );
}
