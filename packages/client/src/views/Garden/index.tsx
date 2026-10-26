import { Button } from "@green-goods/shared/components/Button";
import { MediaCardSkeleton } from "@green-goods/shared/components/Cards/MediaCard";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import {
  type SubmissionStage,
  useSubmissionFlowController,
} from "@green-goods/shared/hooks/client-ui/submission/useSubmissionFlowController";
import { useWorkSubmissionFlowController } from "@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController";
import type { Address } from "@green-goods/shared/types/domain";
import { RiErrorWarningLine, RiHammerFill, RiRefreshLine } from "@remixicon/react";
import type React from "react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";
import { FlowBarNote, SubmissionFlow, WorkViewSkeleton } from "@/components/Features/Work";
import { DraftSheet } from "@/components/Sheets";
import { trackWorkMediaJourneyEvent } from "@/config/mediaAnalytics";
import { APP_ROUTES } from "@/config/pwaRouting";
import { WorkDetails } from "./Details";
import { DraftStatus } from "./DraftStatus";
import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkReview } from "./Review";
import { SubmissionGardenLine } from "./SubmissionGardenLine";
import { WorkForSheet } from "./WorkForSheet";

const trackControllerMediaEvent = (
  event: "work_media_preview_failed" | "work_media_removed" | "work_broken_media_removed",
  properties: Record<string, unknown>
) =>
  trackWorkMediaJourneyEvent(event, properties as Parameters<typeof trackWorkMediaJourneyEvent>[1]);

/** A picker's row before its cards arrive, laid out as the picker lays them. */
const PickerRowSkeleton: React.FC = () => (
  <div className="-mx-4 flex gap-(--gg-list-gap) overflow-hidden px-4 pb-1">
    {[0, 1, 2, 3].map((index) => (
      <MediaCardSkeleton
        key={`picker-skeleton-${index}`}
        mediaShape="banner"
        className="w-[90%] shrink-0"
      />
    ))}
  </div>
);

/**
 * Start before its lists arrive. The garden question is left out: the flow
 * usually has its garden already (decision 28), and asking for one that a
 * moment later disappears would move the step under the member's thumb.
 */
const IntroSkeleton: React.FC = () => {
  const intl = useIntl();
  return (
    <div className="flex flex-col gap-6">
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourAction",
          defaultMessage: "Select Your Action",
        })}
        info={intl.formatMessage({
          id: "app.garden.whatTypeOfWork",
          defaultMessage: "What type of work are you submitting?",
        })}
        Icon={RiHammerFill}
      />
      <PickerRowSkeleton />
    </div>
  );
};

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
    commitmentLinkChoices,
    commitmentLinkChoicesLoading,
    commitmentLinkChoicesError,
    refetchCommitmentLinkChoices,
    isSchedulingDependentLink,
    isQueueingDependentLink,
    linkSchedulingError,
    linkSchedulingSucceeded,
    linkSchedulingWorkSent,
    hasPendingLinkRecovery,
    retryLinkOnly,
    clearLinkIntent,
    selectLinkIntent,
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
    setActionUID,
    setAudioNotes,
    setGardenAddress,
    setImages,
    setSelectedDomain,
    setValue,
    showSkeleton,
    submissionCompleted,
    submissionGardenSettled,
    timeSpentMinutes,
    values,
    workSubmissionJourneyId,
  } = controller;

  const linkChoiceKey = (choice: { commitmentId: bigint; requirementIndex: number }) =>
    `${choice.commitmentId.toString()}:${choice.requirementIndex}`;
  // Shared returns a link intent only after matching it to this live, eligible
  // choice set. Never reconstruct a choice from URL copy in the view.
  const availableLinkChoices = commitmentLinkChoices;
  const selectedCommitmentKey = linkIntent ? linkChoiceKey(linkIntent) : null;
  const commitmentChoices = availableLinkChoices.map((choice) => ({
    key: linkChoiceKey(choice),
    commitmentId: choice.commitmentId,
    requirementIndex: choice.requirementIndex,
    title: choice.commitmentTitle,
    approvedCount: choice.approvedCount,
    requiredCount: choice.requiredCount,
    dueDate: choice.dueDate,
    actionTitle: actions.find((action) => action.id === `${DEFAULT_CHAIN_ID}-${choice.actionUID}`)
      ?.title,
  }));

  // The work kind's piece at each stage. Once a promise is chosen at Start, every later step
  // names it after its heading (D16, O9): the shell hands the pinned card in, and its sheet
  // can unlink the work.
  const renderStage = (stage: SubmissionStage, pinned: ReactNode) => {
    switch (stage) {
      case "start":
        return showSkeleton ? (
          <IntroSkeleton />
        ) : (
          <WorkIntro
            actions={actions}
            gardens={gardens}
            hasJoinedGardens={hasJoinedGardens}
            isLoading={isLoading}
            joinableCommunityGarden={joinableCommunityGarden}
            isJoiningCommunityGarden={isJoiningCommunityGarden}
            onJoinCommunityGarden={joinCommunityGarden}
            selectedActionUID={actionUID}
            selectedGardenAddress={gardenAddress}
            gardenSettled={submissionGardenSettled}
            selectedDomain={selectedDomain}
            setActionUID={(value) => {
              setActionUID(value);
              if (linkIntent && value !== linkIntent.actionUID) clearLinkIntent();
            }}
            setGardenAddress={(value) => {
              setGardenAddress(value as Address | null);
              if (linkIntent && value?.toLowerCase() !== linkIntent.garden.toLowerCase()) {
                clearLinkIntent();
              }
            }}
            setSelectedDomain={setSelectedDomain}
            commitmentChoices={commitmentChoices}
            commitmentChoicesLoading={commitmentLinkChoicesLoading}
            commitmentChoicesError={commitmentLinkChoicesError}
            commitmentIntentStatus={linkIntentStatus}
            showCommitmentChoices={
              linkIntentStatus !== "none" || Boolean(gardenAddress && actionUID !== null)
            }
            onRetryCommitmentChoices={() => void refetchCommitmentLinkChoices()}
            selectedCommitmentKey={selectedCommitmentKey}
            setSelectedCommitmentKey={(key) => {
              if (!key) {
                clearLinkIntent();
                return;
              }
              selectLinkIntent(
                availableLinkChoices.find((choice) => linkChoiceKey(choice) === key) ?? null
              );
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
