import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { isHeicFile, isVideoFile } from "@green-goods/shared/modules/work/media-processing";
import type { ProofBeat } from "@green-goods/shared/hooks/client-ui/commitment/proofReadiness";
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useProofComposerController } from "@green-goods/shared/hooks/client-ui/commitment/useProofComposerController";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { RiCheckboxCircleFill, RiFileFill, RiImageFill } from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ImagePreviewDialog } from "@/components/Display";
import { PinnedPromiseCard, describeProofContents } from "@/components/Features/Commitments";
import { MediaRulePill } from "@/components/Features/Work";
import { APP_ROUTES } from "@/config/pwaRouting";
import { confirmerOf } from "../Commitment/CommitmentPeople";
import { ProofBar } from "./ProofBar";
import { type NoteHint, ProofDetails } from "./ProofDetails";
import { ProofForSheet } from "./ProofForSheet";
import { ProofMedia } from "./ProofMedia";
import { ProofReview } from "./ProofReview";
import { ProofShell, ProofState, type ProofStateKind } from "./ProofShell";

const BEATS: readonly ProofBeat[] = ["media", "details", "review"];

const BLOCKED_REASON_IDS = {
  nothing: "app.proof.blocked.nothing",
  credit: "app.proof.blocked.credit",
  "invalid-link": "app.compose.details.linkInvalid",
} as const;

/**
 * The three-step proof flow (D6, D16): Media, Details and Review in Submit
 * Work's page, with the promise pinned throughout. Once the proof is in the
 * queue and nothing waits on this screen, the flow hands over to the promise
 * (D7, D18); the toasts carry the rest of the send. Domain state and queue
 * effects live in the shared controller.
 */
export function ProofComposer() {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigate();
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
    useUIStore.getState().openWorkDashboard("pending");
    navigate(APP_ROUTES.home);
  }, [navigate]);
  const controller = useProofComposerController({
    chainId: DEFAULT_CHAIN_ID,
    commitmentId,
    routeGarden: gardenAddress,
    onOpenYourWork: openYourWork,
  });
  const [beat, setBeat] = useState<ProofBeat>("media");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [promiseOpen, setPromiseOpen] = useState(false);

  // Leaving goes back to the promise this flow came from, so Back from the
  // promise reaches the Promises tab; a proof link opened directly replaces
  // itself with the promise (PRD-1015). Opened from Your Work, the promise
  // takes this screen's place and its Back reopens Your Work.
  const toPromise = useCallback(() => {
    const parent = location.pathname.replace(/\/proof\/?$/, "");
    if (location.state?.proofOrigin === parent) navigate(-1);
    else
      navigate("..", {
        relative: "path",
        replace: true,
        state:
          location.state?.from === "dashboard" ? { from: "dashboard" } : { proofDirectEntry: true },
      });
  }, [location.pathname, location.state, navigate]);
  // Once the proof is admitted and no prompt waits here, the proof screens
  // give way to the promise (D7, D18). Never before: a proof the queue never
  // took is still this form.
  const handedOver = useRef(false);
  useEffect(() => {
    setBeat("media");
    setPreviewIndex(null);
    setPromiseOpen(false);
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
        onBack={toPromise}
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

  const beatIndex = BEATS.indexOf(beat);
  const readiness = controller.readiness(beat);
  const blockedReasonId =
    readiness.reason && readiness.reason in BLOCKED_REASON_IDS
      ? BLOCKED_REASON_IDS[readiness.reason as keyof typeof BLOCKED_REASON_IDS]
      : null;
  const title =
    controller.metadata?.title ??
    (controller.commitment.unitLabel
      ? formatCommitmentUnits(
          intl,
          controller.commitment.targetUnits,
          controller.commitment.unitLabel
        )
      : formatMessage({ id: "app.commitments.row.untitled" }));
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

  const heading =
    beat === "media"
      ? {
          title: formatMessage({ id: "app.proof.media.title" }),
          info: formatMessage({ id: "app.proof.media.info" }),
          Icon: RiImageFill,
        }
      : beat === "details"
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
  const advanceLabel = formatMessage({
    id:
      beat === "media"
        ? "app.proof.next.details"
        : beat === "details"
          ? "app.proof.next.review"
          : controller.sendToo
            ? "app.proof.submitAndSend"
            : "app.proof.submit",
  });

  return (
    <>
      <ProofShell
        onBack={() => (beatIndex === 0 ? toPromise() : setBeat(BEATS[beatIndex - 1] as ProofBeat))}
        progress={beatIndex + 1}
        heading={heading}
        pinned={
          <PinnedPromiseCard kind="proof" title={title} onOpen={() => setPromiseOpen(true)} />
        }
        bar={
          <ProofBar
            showMediaTools={beat === "media"}
            isProcessing={controller.isProcessing}
            isRecording={controller.isRecording}
            onToggleRecording={controller.toggleRecording}
            advanceLabel={advanceLabel}
            canAdvance={readiness.canAdvance && controller.draftPersistence === "saved"}
            // Only Review sends, so only its act spins while the proof is added.
            isPending={beat === "review" && controller.isPending}
            blockedReason={
              controller.draftPersistence !== "saved"
                ? formatMessage({
                    id:
                      controller.draftPersistence === "failed"
                        ? "app.proof.draft.saveRequired"
                        : "app.proof.draft.saving",
                  })
                : blockedReasonId
                  ? formatMessage({ id: blockedReasonId })
                  : null
            }
            onAdvance={() =>
              beat === "review"
                ? void controller.submit()
                : setBeat(BEATS[beatIndex + 1] as ProofBeat)
            }
          />
        }
      >
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
        {beat === "media" ? (
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
        {beat === "details" ? (
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
        {beat === "review" ? (
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
      </ProofShell>

      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={controller.imageUrls}
        initialIndex={previewIndex ?? 0}
      />
      <ProofForSheet
        open={promiseOpen}
        onClose={() => setPromiseOpen(false)}
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
