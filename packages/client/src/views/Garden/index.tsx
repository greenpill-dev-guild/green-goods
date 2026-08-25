import { useWorkSubmissionFlowController } from "@green-goods/shared/hooks/client-ui/work/useWorkSubmissionFlowController";
import { WorkTab } from "@green-goods/shared/stores/workFlowTypes";
import {
  RiArrowRightSLine,
  RiCameraFill,
  RiHammerFill,
  RiImageFill,
  RiMicLine,
  RiPlantFill,
  RiStopFill,
} from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { ActionCardSkeleton, FormInfo, GardenCardSkeleton } from "@/components/Cards";
import { FormProgress } from "@/components/Communication";
import { DraftDialog } from "@/components/Dialogs";
import { WorkViewSkeleton } from "@/components/Features/Work";
import { TopNav } from "@/components/Navigation";
import { APP_ROUTES } from "@/config/pwaRouting";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { WorkDetails } from "./Details";
import { WorkIntro } from "./Intro";
import { WorkMedia } from "./Media";
import { WorkReview } from "./Review";
import { trackWorkMediaJourneyEvent } from "@/config/mediaAnalytics";

const trackControllerMediaEvent = (
  event: "work_media_preview_failed" | "work_media_removed" | "work_broken_media_removed",
  properties: Record<string, unknown>
) =>
  trackWorkMediaJourneyEvent(event, properties as Parameters<typeof trackWorkMediaJourneyEvent>[1]);

const IntroSkeleton: React.FC = () => {
  const intl = useIntl();
  return (
    <div className="flex flex-col gap-6">
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourAction",
          defaultMessage: "Select your action",
        })}
        info={intl.formatMessage({
          id: "app.garden.whatTypeOfWork",
          defaultMessage: "What type of work are you submitting?",
        })}
        Icon={RiHammerFill}
      />
      <div className="flex gap-4 overflow-x-auto">
        {[0, 1, 2, 3].map((index) => (
          <div key={`action-skel-${index}`} className="min-w-[16rem]">
            <ActionCardSkeleton media="small" height="selection" />
          </div>
        ))}
      </div>
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourGarden",
          defaultMessage: "Select your garden",
        })}
        info={intl.formatMessage({
          id: "app.garden.whichGarden",
          defaultMessage: "Which garden are you submitting for?",
        })}
        Icon={RiPlantFill}
      />
      <div className="flex gap-4 overflow-x-auto">
        {[0, 1, 2, 3].map((index) => (
          <div key={`garden-skel-${index}`} className="min-w-[16rem]">
            <GardenCardSkeleton media="small" height="selection" showStats={false} />
          </div>
        ))}
      </div>
    </div>
  );
};

const Work: React.FC = () => {
  const intl = useIntl();
  const controller = useWorkSubmissionFlowController({
    homeRoute: APP_ROUTES.home,
    profileRoute: APP_ROUTES.profile,
    trackMediaJourneyEvent: trackControllerMediaEvent,
  });
  const {
    actionUID,
    actions,
    activeTab,
    audioNotes,
    authMode,
    brokenMediaIds,
    cameraClickRef,
    canProceed,
    changeTab,
    control,
    detailsConfig,
    detailInputs,
    draft,
    ensureWorkSubmissionJourneyId,
    exit,
    feedback,
    gardenAddress,
    gardens,
    hasJoinedGardens,
    images,
    isJoiningCommunityGarden,
    isLoading,
    isRecording,
    isWalletRequestExpired,
    joinableCommunityGarden,
    joinCommunityGarden,
    markMediaPreviewFailed,
    mediaClickRef,
    mediaConfig,
    minRequired,
    queueStatusMessage,
    recordingElapsed,
    register,
    removeBrokenMedia,
    removeMedia,
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
    submit,
    timeSpentMinutes,
    toggleAudioRecording,
    values,
    workSubmissionJourneyId,
  } = controller;

  const currentTab = {
    [WorkTab.Intro]: {
      primary: () => changeTab(WorkTab.Media),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.intro.label",
        defaultMessage: "Start Gardening",
      }),
      customSecondary: null,
      backButton: exit,
    },
    [WorkTab.Media]: {
      primary: () => changeTab(WorkTab.Details),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.media.label",
        defaultMessage: "Add Details",
      }),
      customSecondary: (
        <>
          <Button
            onClick={() => {
              if (mediaClickRef.current) mediaClickRef.current();
              else document.getElementById("work-media-upload")?.click();
            }}
            label=""
            className="min-w-11 w-11 px-0 shrink-0"
            variant="neutral"
            type="button"
            shape="regular"
            mode="stroke"
            leadingIcon={<RiImageFill className={`w-5 h-5 ${pwaStatusStyles.primary.icon}`} />}
          />
          <Button
            onClick={() => {
              if (cameraClickRef.current) cameraClickRef.current();
              else document.getElementById("work-media-camera")?.click();
            }}
            label=""
            className="min-w-11 w-11 px-0 shrink-0"
            variant="neutral"
            type="button"
            shape="regular"
            mode="stroke"
            leadingIcon={<RiCameraFill className={`w-5 h-5 ${pwaStatusStyles.primary.icon}`} />}
          />
          <Button
            onClick={toggleAudioRecording}
            label=""
            className="min-w-11 w-11 px-0 shrink-0"
            variant={isRecording ? "error" : "neutral"}
            type="button"
            shape="regular"
            mode={isRecording ? "filled" : "stroke"}
            leadingIcon={
              isRecording ? (
                <RiStopFill className={`w-5 h-5 ${pwaStatusStyles.error.foreground}`} />
              ) : (
                <RiMicLine className={`w-5 h-5 ${pwaStatusStyles.primary.icon}`} />
              )
            }
          />
        </>
      ),
      backButton: () => changeTab(WorkTab.Intro),
    },
    [WorkTab.Details]: {
      primary: () => changeTab(WorkTab.Review),
      primaryLabel: intl.formatMessage({
        id: "app.garden.submit.tab.details.label",
        defaultMessage: "Review Work",
      }),
      customSecondary: null,
      backButton: () => changeTab(WorkTab.Media),
    },
    [WorkTab.Review]: {
      primary: submit,
      primaryLabel: isWalletRequestExpired
        ? intl.formatMessage({
            id: "app.garden.submit.tab.review.retryLabel",
            defaultMessage: "Submit again",
          })
        : intl.formatMessage({
            id: "app.garden.submit.tab.review.label",
            defaultMessage: "Upload Work",
          }),
      customSecondary: null,
      backButton: () => changeTab(WorkTab.Details),
    },
  }[activeTab];

  const renderTabContent = () => {
    switch (activeTab) {
      case WorkTab.Intro:
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
            selectedDomain={selectedDomain}
            setActionUID={setActionUID}
            setGardenAddress={setGardenAddress}
            setSelectedDomain={setSelectedDomain}
          />
        );
      case WorkTab.Media:
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
          />
        );
      case WorkTab.Details:
        return (
          <WorkDetails
            config={detailsConfig}
            inputs={detailInputs}
            register={register}
            control={control}
            setValue={setValue}
          />
        );
      case WorkTab.Review:
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
          />
        );
    }
  };

  return (
    <>
      <DraftDialog
        isOpen={draft.showDraftDialog}
        onContinue={draft.handleContinueDraft}
        onStartFresh={draft.startFresh}
        imageCount={images.length}
      />
      <TopNav onBackClick={currentTab.backButton} overlay>
        <FormProgress
          currentStep={submissionCompleted ? 5 : Object.values(WorkTab).indexOf(activeTab) + 1}
          steps={Object.values(WorkTab).slice(0, 4)}
        />
      </TopNav>
      <form
        id="work-form"
        className="relative py-6 pt-20 flex flex-col gap-4 min-h-[calc(100vh-7.5rem)]"
      >
        <div className="padded relative flex flex-col gap-4 flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))]">
          {renderTabContent()}
        </div>
        <div className="flex fixed left-0 bottom-0 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] w-full z-modal bg-bg-white-0 border-t border-stroke-soft-200 rounded-t-[var(--radius-lg)] overflow-hidden">
          <div className="flex flex-col gap-2 w-full padded">
            {queueStatusMessage ? (
              <p className="text-xs text-text-sub-600 px-1" role="status" aria-live="polite">
                {queueStatusMessage}
              </p>
            ) : null}
            <div className="flex flex-row gap-4 w-full">
              {currentTab.customSecondary}
              <Button
                onClick={currentTab.primary}
                label={currentTab.primaryLabel}
                disabled={!canProceed}
                className="w-full"
                variant="primary"
                mode="filled"
                size="medium"
                type="button"
                shape="regular"
                trailingIcon={<RiArrowRightSLine className="w-5 h-5" />}
              />
            </div>
          </div>
        </div>
      </form>
    </>
  );
};

export default Work;
