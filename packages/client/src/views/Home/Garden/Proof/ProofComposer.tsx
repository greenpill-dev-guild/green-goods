import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useProofComposerController } from "@green-goods/shared/hooks/client-ui/commitment/useProofComposerController";
import {
  type SubmissionStage,
  useSubmissionFlowController,
} from "@green-goods/shared/hooks/client-ui/submission/useSubmissionFlowController";
import { useDashboardNavigation } from "@green-goods/shared/hooks/client-ui/useDashboardNavigation";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { isHeicFile, isVideoFile } from "@green-goods/shared/modules/work/media-processing";
import { RiCheckboxCircleFill, RiFileFill, RiImageFill } from "@remixicon/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { FormInfo } from "@/components/Cards";
import { ImagePreviewDialog } from "@/components/Display";
import { describeProofContents } from "@/components/Features/Commitments";
import { MediaRulePill, SubmissionFlow } from "@/components/Features/Work";
import { confirmerOf } from "../Commitment/CommitmentPeople";
import { type NoteHint, ProofDetails } from "./ProofDetails";
import { ProofForSheet } from "./ProofForSheet";
import { ProofMedia } from "./ProofMedia";
import { ProofReview } from "./ProofReview";
import { ProofState, type ProofStateKind } from "./ProofState";

/**
 * Adding evidence: the one submission flow's evidence kind (DL-131), Media, Details and Review
 * with the promise pinned throughout. Once the proof is in the queue and nothing waits on this
 * screen, the flow hands over to the promise (D7, D18); the toasts carry the rest of the send.
 * Domain state and queue effects live in the shared controller; the stage sequence, the forward
 * act and the pinned card in the shared flow.
 */
export function ProofComposer() {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigate();
  const dashboardNavigation = useDashboardNavigation();
  const location = useLocation();
  const { commitmentId: commitmentIdParam, id: gardenAddress } = useParams<{
    commitmentId: string;
    id: string;
  }>();
  const commitmentId = useMemo(() => {
    if (!commitmentIdParam) return null;
    try {
      return BigInt(commitmentIdParam);
    } catch {
      return null;
    }
  }, [commitmentIdParam]);
  // "Couldn't add proof" may speak after this screen is gone, so it opens
  // Your Work from Home rather than from here.
  const openYourWork = useCallback(() => {
    dashboardNavigation.openWork();
  }, [dashboardNavigation]);
  const controller = useProofComposerController({
    chainId: DEFAULT_CHAIN_ID,
    commitmentId,
    routeGarden: gardenAddress,
    onOpenYourWork: openYourWork,
  });

  // Leaving goes back to the promise this flow came from, so Back from the
  // promise reaches the Promises tab; a proof link opened directly replaces
  // itself with the promise (PRD-1015). Opened from Your Work or Home, the
  // promise takes this screen's place and its Back returns there.
  const toPromise = useCallback(() => {
    const parent = location.pathname.replace(/\/proof\/?$/, "");
    if (location.state?.proofOrigin === parent) navigate(-1);
    else
      dashboardNavigation.returnTo(parent, {
        relative: "path",
        replace: true,
        state:
          location.state?.from === "dashboard" || location.state?.from === "home"
            ? { from: location.state.from }
            : { proofDirectEntry: true },
      });
  }, [dashboardNavigation, location.pathname, location.state, navigate]);
  const leave = useCallback(() => {
    if (!dashboardNavigation.back()) toPromise();
  }, [dashboardNavigation, toPromise]);
  const title =
    controller.metadata?.title ??
    (controller.commitment?.unitLabel
      ? formatCommitmentUnits(
          intl,
          controller.commitment.targetUnits,
          controller.commitment.unitLabel
        )
      : formatMessage({ id: "app.commitments.row.untitled" }));
  const flow = useSubmissionFlowController({
    kind: "evidence",
    controller,
    commitmentId,
    leave,
    promiseTitle: title,
  });
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // Once the proof is admitted and no prompt waits here, the proof screens
  // give way to the promise (D7, D18). Never before: a proof the queue never
  // took is still this form.
  const handedOver = useRef(false);
  useEffect(() => {
    setPreviewIndex(null);
    handedOver.current = false;
  }, [commitmentId, controller.viewer]);
  useEffect(() => {
    if (!controller.landing || handedOver.current) return;
    handedOver.current = true;
    toPromise();
  }, [controller.landing, toPromise]);

  if (controller.status !== "ready" || !controller.commitment || !controller.detail) {
    return (
      <ProofState
        kind={controller.status === "ready" ? "loading" : (controller.status as ProofStateKind)}
        onBack={leave}
        onRetry={
          controller.status === "draftRestoreFailed"
            ? controller.retryDraftRestore
            : controller.status === "error"
              ? () => void controller.refetch()
              : undefined
        }
      />
    );
  }

  const { contents } = controller;
  // Whoever ordinarily confirms it, when one person does: Review names them.
  const confirmer = confirmerOf(controller.commitment, controller.detail.contributors);
  const summary = describeProofContents(intl, contents);
  // What the Media step holds; the links sit under the note on this same step.
  const attachedSummary = describeProofContents(
    intl,
    { ...contents, links: 0 },
    { words: "never", type: "conjunction" }
  );
  const noteHint: NoteHint =
    contents.photos + contents.videos + contents.voiceNotes > 0 && attachedSummary
      ? { kind: "alreadyAdded", summary: attachedSummary }
      : contents.links > 0
        ? { kind: "linkEnough", count: contents.links }
        : { kind: "needed" };

  const pick = async (files: FileList | null) => {
    const { rejectedCount } = await controller.pick(files);
    if (rejectedCount === 0) return;
    toastService.info({
      title: formatMessage({ id: "app.garden.upload.unsupportedMediaTitle" }),
      message: formatMessage(
        { id: "app.garden.upload.unsupportedMediaMessage" },
        { count: rejectedCount }
      ),
      context: "mediaUpload",
    });
  };

  const headingFor = (stage: SubmissionStage) =>
    stage === "media"
      ? {
          title: formatMessage({ id: "app.proof.media.title" }),
          info: formatMessage({ id: "app.proof.media.info" }),
          Icon: RiImageFill,
        }
      : stage === "details"
        ? {
            title: formatMessage({ id: "app.garden.details.title" }),
            info: formatMessage({ id: "app.proof.details.info" }),
            Icon: RiFileFill,
          }
        : {
            title: formatMessage({ id: "app.proof.review.title" }),
            info: formatMessage(
              { id: "app.proof.review.info" },
              {
                who: confirmer ? "named" : "other",
                name: confirmer ? (
                  <AddressDisplay
                    address={confirmer}
                    interactive={false}
                    className="inline text-[1em]"
                  />
                ) : null,
              }
            ),
            Icon: RiCheckboxCircleFill,
          };

  // Every stage leads with its heading card, then the promise it is for (DL-058), then a
  // save that failed, then the stage itself.
  const renderStage = (stage: SubmissionStage, pinned: ReactNode) => {
    const heading = headingFor(stage);
    return (
      <>
        <FormInfo title={heading.title} info={heading.info} Icon={heading.Icon} />
        {pinned}
        {controller.draftPersistence === "failed" ? (
          <Alert
            variant="warning"
            action={
              <Button type="button" emphasis="secondary" onClick={controller.retryDraftSave}>
                {formatMessage({ id: "app.proof.draft.saveRetry" })}
              </Button>
            }
          >
            {formatMessage({ id: "app.proof.draft.saveFailed" })}
          </Alert>
        ) : null}
        {stage === "media" ? (
          <ProofMedia
            media={controller.media}
            audioNotes={controller.audioNotes}
            rule={
              <MediaRulePill met={summary !== null}>
                {summary
                  ? formatMessage({ id: "app.proof.media.added" }, { summary })
                  : formatMessage({ id: "app.proof.media.nothingYet" })}
              </MediaRulePill>
            }
            isProcessing={controller.isProcessing}
            isRecording={controller.isRecording}
            recordingElapsed={controller.recordingElapsed}
            onPick={(files) => void pick(files)}
            onRemoveMedia={controller.removeMedia}
            onRemoveAudio={controller.removeAudio}
            onPreview={(index) =>
              setPreviewIndex(
                controller.media
                  .slice(0, index)
                  .filter((file) => !isVideoFile(file) && !isHeicFile(file)).length
              )
            }
            heicStateOf={controller.heicStateOf}
            onRetryHeicConversion={controller.retryHeicConversion}
          />
        ) : null}
        {stage === "details" ? (
          <ProofDetails
            roster={controller.roster}
            credited={controller.credited}
            onToggleCredit={controller.toggleCredit}
            viewer={controller.viewer}
            note={controller.note}
            onNote={controller.setNote}
            noteHint={noteHint}
            links={controller.links}
            onLinks={controller.setLinks}
            linkInvalid={controller.linkInvalid}
          />
        ) : null}
        {stage === "review" ? (
          <ProofReview
            media={controller.media}
            audioNotes={controller.audioNotes}
            note={controller.note}
            links={controller.links}
            credited={controller.credited}
            roster={controller.roster}
            viewer={controller.viewer}
            leads={controller.leads}
            confirmer={confirmer}
            isOnline={controller.isOnline}
            canSendToo={controller.canSendToo}
            sendToo={controller.sendToo}
            onSendToo={controller.setSendToo}
            heicStateOf={controller.heicStateOf}
          />
        ) : null}
      </>
    );
  };

  return (
    <>
      <SubmissionFlow flow={flow} keepFormStill renderStage={renderStage} />

      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={controller.imageUrls}
        initialIndex={previewIndex ?? 0}
      />
      <ProofForSheet
        open={flow.promise.open}
        onClose={flow.promise.hide}
        chainId={DEFAULT_CHAIN_ID}
        title={title}
        detail={controller.detail}
        metadata={controller.metadata}
        seat={controller.seat}
        viewer={controller.viewer}
        stewards={controller.stewards}
      />
    </>
  );
}

export default ProofComposer;
