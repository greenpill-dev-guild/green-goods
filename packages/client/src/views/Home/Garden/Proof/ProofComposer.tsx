import {
  type Address,
  DEFAULT_CHAIN_ID,
  imageCompressor,
  isVideoFile,
  mediaResourceManager,
  normalizeWorkMediaFiles,
  selectCommitmentSeat,
  toastService,
  useAudioRecording,
  useCommitment,
  useCommitmentJobs,
  useCommitmentMetadataFor,
  useOffline,
  usePrimaryAddress,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";

import { ImagePreviewDialog } from "@/components/Dialogs";
import { ProofBar } from "./ProofBar";
import { ProofDetails } from "./ProofDetails";
import { ProofMedia } from "./ProofMedia";
import { ProofReview } from "./ProofReview";
import { ProofShell, ProofState } from "./ProofShell";

const BEATS = ["media", "details", "review"] as const;
type Beat = (typeof BEATS)[number];

const WEB_LINK = /^https?:\/\/\S+$/i;

/**
 * Adding proof to a commitment, in the Submit Work rhythm: media, details,
 * review. Everything composed here is queued, never sent: the words, the
 * photos and the voice note ride the job until the phone is online, and the
 * executor publishes them then. The credited people are chosen here, in full
 * view, and travel with the job exactly as chosen.
 */
export function ProofComposer() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { commitmentId: commitmentIdParam, id: gardenAddress } = useParams<{
    commitmentId: string;
    id: string;
  }>();
  const { isOnline } = useOffline();
  const viewer = usePrimaryAddress();
  const chainId = DEFAULT_CHAIN_ID;

  const commitmentId = useMemo(() => {
    if (!commitmentIdParam) return null;
    try {
      return BigInt(commitmentIdParam);
    } catch {
      return null;
    }
  }, [commitmentIdParam]);

  const { detail, isLoading, isError, refetch, availability } = useCommitment({
    chainId,
    commitmentId: commitmentId ?? 0n,
  });
  const metadata = useCommitmentMetadataFor(detail?.commitment);
  const jobs = useCommitmentJobs({ chainId });

  const [beat, setBeat] = useState<Beat>("media");
  const [media, setMedia] = useState<File[]>([]);
  const [audioNotes, setAudioNotes] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [credited, setCredited] = useState<Address[] | null>(null);
  const [queued, setQueued] = useState(false);
  // One id per composition, minted once: the queue's identity for this proof
  // before it has a CID, so a retry behind the same button is one job.
  const clientEvidenceId = useMemo(() => crypto.randomUUID(), []);

  const {
    isRecording,
    elapsed: recordingElapsed,
    toggle: toggleRecording,
  } = useAudioRecording({
    onRecordingComplete: (file) => setAudioNotes((current) => [...current, file]),
  });

  // This screen creates preview URLs in the `proof` scope on the review beat,
  // after ProofMedia has unmounted. Only a successful submit released them, so
  // walking away from review left every photo's blob alive.
  useEffect(() => () => mediaResourceManager.cleanupUrls("proof"), []);

  const back = () => navigate("..", { relative: "path" });

  const roster = useMemo(
    () =>
      (detail?.contributors ?? [])
        .filter((entry) => entry.active)
        .map((entry) => ({ address: entry.contributor, isLead: entry.isLead })),
    [detail]
  );
  const seat = useMemo(() => {
    if (!detail) return null;
    return selectCommitmentSeat({
      commitment: detail.commitment,
      contributors: roster.map((entry) => entry.address),
      viewer: (viewer ?? undefined) as Address | undefined,
    });
  }, [detail, roster, viewer]);

  // The signed-in member is preselected visibly when they are on the roster;
  // nobody is credited invisibly.
  const creditedNow =
    credited ??
    roster
      .filter((entry) => viewer && entry.address.toLowerCase() === viewer.toLowerCase())
      .map((entry) => entry.address);
  const toggleCredit = (address: Address) =>
    setCredited(
      creditedNow.some((entry) => entry.toLowerCase() === address.toLowerCase())
        ? creditedNow.filter((entry) => entry.toLowerCase() !== address.toLowerCase())
        : [...creditedNow, address]
    );

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsProcessing(true);
    try {
      const normalized = await normalizeWorkMediaFiles(Array.from(files));
      if (normalized.rejected.length > 0) {
        toastService.info({
          title: formatMessage({ id: "app.garden.upload.unsupportedMediaTitle" }),
          message: formatMessage(
            { id: "app.garden.upload.unsupportedMediaMessage" },
            { count: normalized.rejected.length }
          ),
          context: "mediaUpload",
        });
      }
      const accepted = normalized.accepted.map((item) => item.file);
      const videos = accepted.filter(isVideoFile);
      const images = accepted.filter((file) => !isVideoFile(file));
      const toCompress = images.filter((file) => imageCompressor.shouldCompress(file, 1024));
      const asIs = images.filter((file) => !imageCompressor.shouldCompress(file, 1024));
      const compressed =
        toCompress.length > 0
          ? (
              await imageCompressor.compressImages(toCompress, {
                maxSizeMB: 0.8,
                maxWidthOrHeight: 2048,
                initialQuality: 0.8,
                useWebWorker: true,
              })
            ).map((result) => result.file)
          : [];
      setMedia((current) => [...current, ...asIs, ...compressed, ...videos]);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasAnything =
    media.length > 0 || audioNotes.length > 0 || note.trim().length > 0 || links.length > 0;
  const linkInvalid = links.some((url) => !WEB_LINK.test(url));
  // A proof may be words alone, so the media beat never blocks; what it asks
  // is answered by the time the details are in.
  const canAdvance =
    beat === "media"
      ? !isProcessing && !isRecording
      : beat === "details"
        ? hasAnything && creditedNow.length > 0 && !linkInvalid
        : true;
  const blockedReasonId =
    beat === "details" && !hasAnything
      ? "app.proof.blocked.nothing"
      : beat === "details" && creditedNow.length === 0
        ? "app.proof.blocked.credit"
        : beat === "details" && linkInvalid
          ? "app.compose.details.linkInvalid"
          : null;

  const submit = async () => {
    if (!detail || !gardenAddress) return;
    try {
      await jobs.enqueue({
        act: "evidence",
        payload: {
          clientEvidenceId,
          commitmentId: detail.commitment.commitmentId,
          creditedContributors: creditedNow,
          gardenAddress: gardenAddress as Address,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(links.length > 0 ? { links } : {}),
          ...(media.length > 0 ? { media } : {}),
          ...(audioNotes.length > 0 ? { audioNotes } : {}),
        },
      });
      mediaResourceManager.cleanupUrls("proof");
      setQueued(true);
    } catch {
      // useCommitmentJobs already surfaced it; the member keeps their draft.
    }
  };

  const title =
    metadata?.title ??
    (detail?.commitment.unitLabel
      ? formatMessage(
          { id: "app.commitments.row.units" },
          {
            count: detail.commitment.targetUnits.toString(),
            unit: detail.commitment.unitLabel,
          }
        )
      : formatMessage({ id: "app.commitments.row.untitled" }));

  if (availability.status !== "available") {
    return <ProofState kind="unavailable" isOnline={isOnline} onBack={back} />;
  }
  if (isLoading) return <ProofState kind="loading" isOnline={isOnline} onBack={back} />;
  // A failed read is not an answer about who this belongs to. Reporting it as
  // "not yours" tells the provider they lack permission and offers no way out,
  // so the read failure is named first and can be tried again. A read that
  // succeeded with nothing behind it is a different answer: the commitment
  // does not exist, and "not yours" is the plain truth of that too.
  if (isError) {
    return (
      <ProofState kind="error" isOnline={isOnline} onBack={back} onRetry={() => void refetch()} />
    );
  }
  // Proof belongs to the people doing the work. Anyone else who lands here
  // reads a plain answer rather than a form the chain would refuse.
  if (!detail || (seat !== "provider" && seat !== "contributor")) {
    return <ProofState kind="notYours" isOnline={isOnline} onBack={back} />;
  }
  if (queued) return <ProofState kind="queued" isOnline={isOnline} onBack={back} />;

  const beatIndex = BEATS.indexOf(beat);
  const isReview = beat === "review";
  const imageUrls = media
    .filter((file) => !isVideoFile(file))
    .map((file) => mediaResourceManager.getOrCreateUrl(file, "proof"));

  return (
    <>
      <ProofShell
        onBack={() => (beatIndex === 0 ? back() : setBeat(BEATS[beatIndex - 1] as Beat))}
        progress={beatIndex + 1}
        bar={
          <ProofBar
            showMediaTools={beat === "media"}
            isProcessing={isProcessing}
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
            advanceLabelId={isReview ? "app.proof.submit" : "app.compose.next"}
            canAdvance={canAdvance}
            isPending={jobs.isPending}
            blockedReasonId={blockedReasonId}
            onAdvance={() => (isReview ? void submit() : setBeat(BEATS[beatIndex + 1] as Beat))}
          />
        }
      >
        {beat === "media" ? (
          <ProofMedia
            media={media}
            audioNotes={audioNotes}
            isProcessing={isProcessing}
            isRecording={isRecording}
            recordingElapsed={recordingElapsed}
            onPick={(files) => void pick(files)}
            onRemoveMedia={(index) => setMedia((current) => current.filter((_, i) => i !== index))}
            onRemoveAudio={(index) =>
              setAudioNotes((current) => current.filter((_, i) => i !== index))
            }
            // ProofMedia counts across every item; the preview only holds
            // photos, so a video earlier in the list would shift the rest.
            onPreview={(index) =>
              setPreviewIndex(media.slice(0, index).filter((file) => !isVideoFile(file)).length)
            }
          />
        ) : null}
        {beat === "details" ? (
          <ProofDetails
            roster={roster}
            credited={creditedNow}
            onToggleCredit={toggleCredit}
            viewer={viewer as Address | null}
            note={note}
            onNote={setNote}
            links={links}
            onLinks={setLinks}
            linkInvalid={linkInvalid}
          />
        ) : null}
        {isReview ? (
          <ProofReview
            commitment={detail.commitment}
            title={title}
            mediaCount={media.length}
            audioCount={audioNotes.length}
            note={note}
            links={links}
            credited={creditedNow}
            isOnline={isOnline}
          />
        ) : null}
      </ProofShell>

      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={imageUrls}
        initialIndex={previewIndex ?? 0}
      />
    </>
  );
}

export default ProofComposer;
