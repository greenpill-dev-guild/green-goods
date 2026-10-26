import { Button } from "@green-goods/shared/components/Button";
import {
  type SubmissionStage,
  useSubmissionFlowController,
} from "@green-goods/shared/hooks/client-ui/submission/useSubmissionFlowController";
import { useWorkSubmissionFlowController } from "@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController";
import type { Address } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiRefreshLine } from "@remixicon/react";
import type React from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { FlowBarNote, SubmissionFlow, WorkViewSkeleton } from "@/components/Features/Work";
import { DraftSheet } from "@/components/Sheets";
import { trackWorkMediaJourneyEvent } from "@/config/mediaAnalytics";
import { APP_ROUTES } from "@/config/pwaRouting";
import { WorkDetails } from "./Details";
import { DraftStatus } from "./DraftStatus";
import { WorkMedia } from "./Media";
import { WorkReview } from "./Review";
import { StartSkeleton, WorkStart } from "./Start";
import { SubmissionGardenLine } from "./SubmissionGardenLine";
import { WorkForSheet } from "./WorkForSheet";

const trackControllerMediaEvent = (
  event: "work_media_preview_failed" | "work_media_removed" | "work_broken_media_removed",
  properties: Record<string, unknown>
) =>
  trackWorkMediaJourneyEvent(event, properties as Parameters<typeof trackWorkMediaJourneyEvent>[1]);

/**
 * Logging work: the one submission flow's work kind (DL-131). Start, Media, Details and Review
 * on the shared shell, with the work kind's pieces at each stage and its own queue path, the
 * Work send and its dependent link to the promise, unchanged.
 */
const Work: React.FC = () => {
  const intl = useIntl();
  const controller = useWorkSubmissionFlowController({
    homeRoute: APP_ROUTES.home,
    profileRoute: APP_ROUTES.profile,
    trackMediaJourneyEvent: trackControllerMediaEvent,
  });
  const flow = useSubmissionFlowController({ kind: "work", controller });
  const {
    actionUID,
    actions,
    audioNotes,
    authMode,
    brokenMediaIds,
    cameraClickRef,
    control,
    detailsConfig,
    detailInputs,
    draft,
    ensureWorkSubmissionJourneyId,
    feedback,
    gardenAddress,
    gardens,
    hasJoinedGardens,
    heicStateOf,
    images,
    isJoiningCommunityGarden,
    isLoading,
    isRecording,
    joinableCommunityGarden,
    joinCommunityGarden,
    linkIntent,
    linkIntentStatus,
    refetchCommitmentLinkChoices,
    isSchedulingDependentLink,
    isQueueingDependentLink,
    linkSchedulingError,
    linkSchedulingSucceeded,
    linkSchedulingWorkSent,
    hasPendingLinkRecovery,
    retryLinkOnly,
    clearLinkIntent,
    markMediaPreviewFailed,
    mediaClickRef,
    mediaConfig,
    minRequired,
    namedSubmissionGarden,
    queueStatusMessage,
    recordingElapsed,
    register,
    removeBrokenMedia,
    removeMedia,
    retryHeicConversion,
    reviewConfig,
    reviewData,
    selectedDomain,
    setAudioNotes,
    setImages,
    setSelectedDomain,
    setValue,
    showSkeleton,
    start,
    submissionCompleted,
    submissionGardenSettled,
    timeSpentMinutes,
    values,
    workSubmissionJourneyId,
  } = controller;

  // The work kind's piece at each stage. Once a promise is chosen at Start, every later step
  // names it after its heading (D16, O9): the shell hands the pinned card in, and its sheet
  // can unlink the work. Start's own pieces come from the controller's Start model (DL-131).
  const renderStage = (stage: SubmissionStage, pinned: ReactNode) => {
    switch (stage) {
      case "start":
        return showSkeleton ? (
          <StartSkeleton />
        ) : (
          <WorkStart
            start={start}
            actionsLoading={isLoading && actions.length === 0}
            hasActions={actions.length > 0}
            selectedActionUID={actionUID}
            selectedDomain={selectedDomain}
            setSelectedDomain={setSelectedDomain}
            gardenQuestion={
              submissionGardenSettled
                ? null
                : {
                    gardens,
                    selected: gardenAddress,
                    onSelect: (value) => start.chooseGarden(value as Address | null),
                    hasJoined: hasJoinedGardens,
                    loading: isLoading,
                    joinable: joinableCommunityGarden,
                    joining: isJoiningCommunityGarden,
                    onJoin: joinCommunityGarden,
                  }
            }
            link={{
              status: linkIntentStatus,
              onRetry: () => void refetchCommitmentLinkChoices(),
              onLetGo: clearLinkIntent,
            }}
          />
        );
      case "media":
        return (
          <WorkMedia
            config={mediaConfig}
            images={images}
            setImages={setImages}
            audioNotes={audioNotes}
            setAudioNotes={setAudioNotes}
            minRequired={minRequired}
            onMediaClickRef={mediaClickRef}
            onCameraClickRef={cameraClickRef}
            isRecording={isRecording}
            recordingElapsed={recordingElapsed}
            brokenMediaIds={brokenMediaIds}
            onPreviewFailed={markMediaPreviewFailed}
            onRemoveMedia={removeMedia}
            onRemoveBrokenMedia={removeBrokenMedia}
            workSubmissionJourneyId={workSubmissionJourneyId}
            ensureWorkSubmissionJourneyId={ensureWorkSubmissionJourneyId}
            authMode={authMode}
            actionUID={actionUID}
            heicStateOf={heicStateOf}
            onRetryHeicConversion={retryHeicConversion}
            pinned={pinned}
          />
        );
      case "details":
        return (
          <WorkDetails
            pinned={pinned}
            config={detailsConfig}
            inputs={detailInputs}
            register={register}
            control={control}
            setValue={setValue}
          />
        );
      case "review":
        return showSkeleton ? (
          <div className="padded">
            <WorkViewSkeleton showMedia showActions={false} numDetails={4} />
          </div>
        ) : (
          <WorkReview
            reviewConfig={reviewConfig}
            garden={reviewData.garden}
            action={reviewData.action}
            images={images}
            audioNotes={audioNotes}
            values={values}
            feedback={feedback}
            timeSpentMinutes={timeSpentMinutes}
            brokenMediaIds={brokenMediaIds}
            onPreviewFailed={markMediaPreviewFailed}
            onRemoveBrokenMedia={removeBrokenMedia}
            heicStateOf={heicStateOf}
            onRetryHeicConversion={retryHeicConversion}
            pinned={pinned}
          />
        );
    }
  };

  return (
    <>
      {linkIntent ? (
        <WorkForSheet
          open={flow.promise.open}
          onClose={flow.promise.hide}
          intent={linkIntent}
          onUnlink={() => {
            flow.promise.hide();
            clearLinkIntent();
          }}
        />
      ) : null}
      <DraftSheet
        isOpen={draft.showDraftSheet}
        onContinue={draft.handleContinueDraft}
        onClose={draft.close}
        legacyRecovery={draft.legacyRecovery}
        onStartFresh={draft.startFresh}
        onManage={draft.manage}
        imageCount={images.length}
      />
      <SubmissionFlow
        flow={flow}
        formId="work-form"
        tallBar={isSchedulingDependentLink || hasPendingLinkRecovery}
        lead={
          <>
            {namedSubmissionGarden ? <SubmissionGardenLine garden={namedSubmissionGarden} /> : null}
            {controller.submissionOutcome?.kind === "awaiting-confirmation" && (
              <p role="status">{intl.formatMessage({ id: "app.work.awaitingConfirmation" })}</p>
            )}
            <DraftStatus draft={draft} submissionCompleted={submissionCompleted} />
          </>
        }
        barStatus={
          <>
            {queueStatusMessage ? <FlowBarNote>{queueStatusMessage}</FlowBarNote> : null}
            {isQueueingDependentLink ? (
              <FlowBarNote>
                {intl.formatMessage({
                  id: "app.garden.commitment.linkScheduling",
                  defaultMessage: "Work submitted. Queueing its link to the promise…",
                })}
              </FlowBarNote>
            ) : null}
            {linkSchedulingSucceeded ? (
              <FlowBarNote tone="success">
                {linkSchedulingWorkSent
                  ? intl.formatMessage({
                      id: "app.garden.commitment.linkScheduled",
                      defaultMessage: "Work submitted. Its link to the promise is queued.",
                    })
                  : intl.formatMessage({
                      id: "app.garden.commitment.linkSavedQueued",
                      defaultMessage:
                        "Work saved on this device. Its link to the promise is queued.",
                    })}
              </FlowBarNote>
            ) : null}
            {hasPendingLinkRecovery && linkSchedulingError ? (
              <div
                className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-warning-light bg-warning-lighter p-3 text-sm text-warning-dark"
                role="alert"
              >
                <span className="flex items-center gap-2">
                  <RiErrorWarningLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {linkSchedulingWorkSent
                    ? intl.formatMessage({
                        id: "app.garden.commitment.linkSchedulingError",
                        defaultMessage:
                          "Your work was submitted, but its link to the promise could not be queued.",
                      })
                    : intl.formatMessage({
                        id: "app.garden.commitment.linkSavedQueueError",
                        defaultMessage:
                          "Your work is saved on this device, but its link to the promise could not be queued.",
                      })}
                </span>
                <Button
                  type="button"
                  emphasis="tertiary"
                  size="compact"
                  onClick={() => void retryLinkOnly()}
                  loading={isSchedulingDependentLink}
                  leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
                  className="shrink-0"
                >
                  {intl.formatMessage({
                    id: "app.garden.commitment.retryLink",
                    defaultMessage: "Retry Link",
                  })}
                </Button>
              </div>
            ) : null}
          </>
        }
        renderStage={renderStage}
      />
    </>
  );
};

export default Work;
