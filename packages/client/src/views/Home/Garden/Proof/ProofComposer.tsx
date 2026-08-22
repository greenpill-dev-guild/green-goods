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
import {
  RiCameraFill,
  RiImageFill,
  RiMicLine,
  RiSearchLine,
  RiStopFill,
  RiWifiOffLine,
} from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";

import { EmptyState, FormProgress } from "@/components/Communication";
import { ImagePreviewDialog } from "@/components/Dialogs";
import { TopNav } from "@/components/Navigation";
import { pwaStatusStyles } from "@/styles/pwaStatusStyles";
import { ProofDetails } from "./ProofDetails";
import { ProofMedia } from "./ProofMedia";
import { ProofReview } from "./ProofReview";

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

  const { detail, isLoading, availability } = useCommitment({
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
    return (
      <Shell onBack={back} title={formatMessage({ id: "app.proof.title" })}>
        <EmptyState
          icon={<RiWifiOffLine />}
          title={formatMessage({ id: "app.commitments.notReady.title" })}
          description={formatMessage({ id: "app.commitments.notReady.description" })}
        />
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell onBack={back} title={formatMessage({ id: "app.proof.title" })}>
        <p className="text-xs text-text-soft-400" role="status">
          {formatMessage({ id: "app.commitment.loading" })}
        </p>
      </Shell>
    );
  }

  // Proof belongs to the people doing the work. Anyone else who lands here
  // reads a plain answer rather than a form the chain would refuse.
  if (!detail || (seat !== "provider" && seat !== "contributor")) {
    return (
      <Shell onBack={back} title={formatMessage({ id: "app.proof.title" })}>
        <EmptyState
          icon={<RiSearchLine />}
          title={formatMessage({ id: "app.proof.notYours.title" })}
          description={formatMessage({ id: "app.proof.notYours.body" })}
        />
      </Shell>
    );
  }

  if (queued) {
    return (
      <Shell onBack={back} title={formatMessage({ id: "app.proof.title" })}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <h1 className="text-lg font-medium text-text-strong-950">
            {formatMessage({
              id: isOnline ? "app.proof.queued.title" : "app.proof.queued.offlineTitle",
            })}
          </h1>
          <p className="max-w-sm text-sm text-text-sub-600">
            {formatMessage({
              id: isOnline ? "app.proof.queued.body" : "app.proof.queued.offlineBody",
            })}
          </p>
          <button
            type="button"
            onClick={back}
            className="mt-2 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg"
          >
            {formatMessage({ id: "app.proof.queued.back" })}
          </button>
        </div>
      </Shell>
    );
  }

  const beatIndex = BEATS.indexOf(beat);
  const isReview = beat === "review";
  const imageUrls = media
    .filter((file) => !isVideoFile(file))
    .map((file) => mediaResourceManager.getOrCreateUrl(file, "proof"));

  return (
    <>
      <Shell
        onBack={() => (beatIndex === 0 ? back() : setBeat(BEATS[beatIndex - 1] as Beat))}
        title={formatMessage({ id: "app.proof.title" })}
        progress={beatIndex + 1}
        bar={
          <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {!canAdvance && blockedReasonId ? (
              <p className="mb-2 text-xs text-text-sub-600" id="proof-blocked" role="status">
                {formatMessage({ id: blockedReasonId })}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              {beat === "media" ? (
                <>
                  <button
                    type="button"
                    onClick={() => document.getElementById("proof-media-upload")?.click()}
                    disabled={isProcessing}
                    aria-label={formatMessage({ id: "app.proof.media.gallery" })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 tap-target-lg disabled:opacity-60"
                  >
                    <RiImageFill className={`h-5 w-5 ${pwaStatusStyles.primary.icon}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById("proof-media-camera")?.click()}
                    disabled={isProcessing}
                    aria-label={formatMessage({ id: "app.proof.media.camera" })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 tap-target-lg disabled:opacity-60"
                  >
                    <RiCameraFill className={`h-5 w-5 ${pwaStatusStyles.primary.icon}`} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    aria-pressed={isRecording}
                    aria-label={formatMessage({
                      id: isRecording ? "app.proof.media.stopRecording" : "app.proof.media.record",
                    })}
                    className={
                      isRecording
                        ? `flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border tap-target-lg ${pwaStatusStyles.error.surface} ${pwaStatusStyles.error.border}`
                        : "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 tap-target-lg"
                    }
                  >
                    {isRecording ? (
                      <RiStopFill className={`h-5 w-5 ${pwaStatusStyles.error.icon}`} />
                    ) : (
                      <RiMicLine className={`h-5 w-5 ${pwaStatusStyles.primary.icon}`} />
                    )}
                  </button>
                </>
              ) : null}
              <button
                aria-describedby={!canAdvance && blockedReasonId ? "proof-blocked" : undefined}
                type="button"
                disabled={!canAdvance || jobs.isPending}
                aria-busy={jobs.isPending}
                onClick={() => (isReview ? void submit() : setBeat(BEATS[beatIndex + 1] as Beat))}
                className="min-w-0 flex-1 rounded-[var(--radius-lg)] bg-primary-action px-4 py-3 text-sm font-medium text-primary-action-foreground tap-target-lg disabled:opacity-60"
              >
                {formatMessage({ id: isReview ? "app.proof.submit" : "app.compose.next" })}
              </button>
            </div>
          </div>
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
            onPreview={setPreviewIndex}
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
      </Shell>

      <ImagePreviewDialog
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        images={imageUrls}
        initialIndex={previewIndex ?? 0}
      />
    </>
  );
}

function Shell({
  children,
  onBack,
  title,
  progress,
  bar,
}: {
  children: React.ReactNode;
  onBack: () => void;
  title: string;
  progress?: number;
  bar?: React.ReactNode;
}) {
  const { formatMessage } = useIntl();
  const steps = [
    formatMessage({ id: "app.proof.beat.media" }),
    formatMessage({ id: "app.proof.beat.details" }),
    formatMessage({ id: "app.compose.beat.review" }),
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <TopNav onBackClick={onBack}>
        {progress ? <FormProgress currentStep={progress} steps={steps} /> : null}
      </TopNav>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-1 flex-col gap-4 p-4 pb-24">
          <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">{title}</p>
          {children}
        </div>
      </div>
      {bar}
    </div>
  );
}

export default ProofComposer;
