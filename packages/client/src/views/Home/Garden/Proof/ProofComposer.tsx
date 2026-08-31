import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { isVideoFile } from "@green-goods/shared/modules/work/media-processing";
import type { ProofBeat } from "@green-goods/shared/hooks/client-ui/commitment/proofReadiness";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useProofComposerController } from "@green-goods/shared/hooks/client-ui/commitment/useProofComposerController";
import { formatCommitmentUnits } from "@green-goods/shared/i18n/commitmentUnits";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";

import { ImagePreviewDialog } from "@/components/Dialogs";
import { ProofBar } from "./ProofBar";
import { ProofDetails } from "./ProofDetails";
import { ProofMedia } from "./ProofMedia";
import { ProofReview } from "./ProofReview";
import { ProofShell, ProofState, type ProofStateKind } from "./ProofShell";

const BEATS: readonly ProofBeat[] = ["media", "details", "review"];

const BLOCKED_REASON_IDS = {
  nothing: "app.proof.blocked.nothing",
  credit: "app.proof.blocked.credit",
  "invalid-link": "app.compose.details.linkInvalid",
} as const;

/** The three-beat proof journey; domain state and queue effects live in its shared controller. */
export function ProofComposer() {
  const intl = useIntl();
  const { formatMessage } = intl;
  const navigate = useNavigate();
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
  const controller = useProofComposerController({
    chainId: DEFAULT_CHAIN_ID,
    commitmentId,
    routeGarden: gardenAddress,
  });
  const [beat, setBeat] = useState<ProofBeat>("media");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const back = () => navigate("..", { relative: "path" });

  if (controller.status !== "ready" || !controller.commitment) {
    return (
      <ProofState
        kind={controller.status as ProofStateKind}
        isOnline={controller.isOnline}
        onBack={back}
        onRetry={controller.status === "error" ? () => void controller.refetch() : undefined}
      />
    );
  }

  const beatIndex = BEATS.indexOf(beat);
  const isReview = beat === "review";
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

  return (
    <>
      <ProofShell
        onBack={() => (beatIndex === 0 ? back() : setBeat(BEATS[beatIndex - 1] as ProofBeat))}
        progress={beatIndex + 1}
        bar={
          <ProofBar
            showMediaTools={beat === "media"}
            isProcessing={controller.isProcessing}
            isRecording={controller.isRecording}
            onToggleRecording={controller.toggleRecording}
            advanceLabelId={isReview ? "app.proof.submit" : "app.compose.next"}
            canAdvance={readiness.canAdvance}
            isPending={controller.isPending}
            blockedReasonId={blockedReasonId}
            onAdvance={() =>
              isReview ? void controller.submit() : setBeat(BEATS[beatIndex + 1] as ProofBeat)
            }
          />
        }
      >
        {beat === "media" ? (
          <ProofMedia
            media={controller.media}
            audioNotes={controller.audioNotes}
            isProcessing={controller.isProcessing}
            isRecording={controller.isRecording}
            recordingElapsed={controller.recordingElapsed}
            onPick={(files) => void pick(files)}
            onRemoveMedia={controller.removeMedia}
            onRemoveAudio={controller.removeAudio}
            onPreview={(index) =>
              setPreviewIndex(
                controller.media.slice(0, index).filter((file) => !isVideoFile(file)).length
              )
            }
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
            links={controller.links}
            onLinks={controller.setLinks}
            linkInvalid={controller.linkInvalid}
          />
        ) : null}
        {isReview ? (
          <ProofReview
            commitment={controller.commitment}
            title={title}
            mediaCount={controller.media.length}
            audioCount={controller.audioNotes.length}
            note={controller.note}
            links={controller.links}
            credited={controller.credited}
            isOnline={controller.isOnline}
          />
        ) : null}
      </ProofShell>

      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={controller.imageUrls}
        initialIndex={previewIndex ?? 0}
      />
    </>
  );
}

export default ProofComposer;
