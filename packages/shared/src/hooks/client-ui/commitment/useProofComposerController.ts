/**
 * Proof composer controller
 *
 * Owns commitment authority, draft persistence, queue payloads, media resources,
 * and form state so the client view only renders the three-beat journey.
 *
 * @module hooks/client-ui/commitment/useProofComposerController
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { selectCommitmentActKind } from "../../../modules/commitment-pooling/acts";
import { selectCommitmentSeat } from "../../../modules/commitment-pooling/selectors";
import { mediaResourceManager } from "../../../modules/job-queue/media-resource-manager";
import { isVideoFile, prepareMediaForUpload } from "../../../modules/work/media-processing";
import type { Address } from "../../../types/domain";
import { imageCompressor } from "../../../utils/work/image-compression";
import { useOffline } from "../../app/useOffline";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import { useCommitmentMetadataFor } from "../../commitment-pooling/useCommitmentMetadata";
import {
  useCommitmentProofDraft,
  useProofDraftSync,
} from "../../commitment-pooling/useCommitmentProofDraft";
import { useCommitment } from "../../commitment-pooling/useCommitmentPooling";
import { useAudioRecording } from "../../utils/useAudioRecording";
import type {
  ProofComposerController,
  ProofComposerStatus,
  ProofRosterMember,
} from "./proof-controller.types";
import { type ProofBeat, selectProofReadiness } from "./proofReadiness";

export interface UseProofComposerControllerInput {
  chainId: number;
  commitmentId: bigint | null;
  routeGarden: Address | string | null | undefined;
}

function sameAddress(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function useProofComposerController(
  input: UseProofComposerControllerInput
): ProofComposerController {
  const { isOnline } = useOffline();
  const viewer = (usePrimaryAddress() as Address | null) ?? null;
  const routeGarden = (input.routeGarden as Address | null | undefined) ?? null;
  const query = useCommitment(
    { chainId: input.chainId, commitmentId: input.commitmentId ?? 0n },
    { enabled: input.commitmentId !== null }
  );
  const metadata = useCommitmentMetadataFor(query.detail?.commitment);
  const jobs = useCommitmentJobs({ chainId: input.chainId });
  const draft = useCommitmentProofDraft({
    chainId: input.chainId,
    viewer,
    commitmentId: input.commitmentId,
  });

  const [media, setMedia] = useState<File[]>([]);
  const [audioNotes, setAudioNotes] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [note, setNote] = useState(() => draft.saved?.note ?? "");
  const [links, setLinks] = useState<string[]>(() => draft.saved?.links ?? []);
  const [selectedCredit, setSelectedCredit] = useState<Address[] | null>(
    () => (draft.saved?.credited as Address[] | null | undefined) ?? null
  );
  const [queued, setQueued] = useState(false);
  const clientEvidenceId = useMemo(
    () => draft.saved?.clientEvidenceId ?? crypto.randomUUID(),
    [draft.saved?.clientEvidenceId]
  );
  const restoreFiles = useCallback((files: { media: File[]; audioNotes: File[] }) => {
    if (files.media.length > 0) setMedia(files.media);
    if (files.audioNotes.length > 0) setAudioNotes(files.audioNotes);
  }, []);
  useProofDraftSync(draft, {
    queued,
    words: { note, links, credited: selectedCredit, clientEvidenceId },
    files: { media, audioNotes },
    onRestore: restoreFiles,
  });

  const recording = useAudioRecording({
    onRecordingComplete: (file) => setAudioNotes((current) => [...current, file]),
  });
  useEffect(() => () => mediaResourceManager.cleanupUrls("proof"), []);

  const detail = query.detail;
  const roster = useMemo<ProofRosterMember[]>(
    () =>
      (detail?.contributors ?? [])
        .filter((entry) => entry.active)
        .map((entry) => ({ address: entry.contributor, isLead: entry.isLead })),
    [detail]
  );
  const seat = useMemo(
    () =>
      detail
        ? selectCommitmentSeat({
            commitment: detail.commitment,
            contributors: roster.map((entry) => entry.address),
            viewer: viewer ?? undefined,
          })
        : null,
    [detail, roster, viewer]
  );
  const credited = useMemo(
    () =>
      selectedCredit ??
      roster
        .filter((entry) => viewer && sameAddress(entry.address, viewer))
        .map((entry) => entry.address),
    [roster, selectedCredit, viewer]
  );

  const toggleCredit = useCallback(
    (address: Address) =>
      setSelectedCredit((current) => {
        const chosen =
          current ??
          roster
            .filter((entry) => viewer && sameAddress(entry.address, viewer))
            .map((entry) => entry.address);
        return chosen.some((entry) => sameAddress(entry, address))
          ? chosen.filter((entry) => !sameAddress(entry, address))
          : [...chosen, address];
      }),
    [roster, viewer]
  );

  const pick = useCallback(async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return { rejectedCount: 0 };
    setIsProcessing(true);
    try {
      const prepared = await prepareMediaForUpload(Array.from(files), imageCompressor);
      setMedia((current) => [...current, ...prepared.files]);
      return { rejectedCount: prepared.rejectedCount };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const removeMedia = useCallback(
    (index: number) => setMedia((current) => current.filter((_, item) => item !== index)),
    []
  );
  const removeAudio = useCallback(
    (index: number) => setAudioNotes((current) => current.filter((_, item) => item !== index)),
    []
  );
  const hasAnything =
    media.length > 0 || audioNotes.length > 0 || note.trim().length > 0 || links.length > 0;
  const linkInvalid =
    selectProofReadiness({
      beat: "details",
      isProcessing,
      isRecording: recording.isRecording,
      hasAnything: true,
      creditedCount: 1,
      links,
    }).reason === "invalid-link";
  const readiness = useCallback(
    (beat: ProofBeat) =>
      selectProofReadiness({
        beat,
        isProcessing,
        isRecording: recording.isRecording,
        hasAnything,
        creditedCount: credited.length,
        links,
      }),
    [credited.length, hasAnything, isProcessing, links, recording.isRecording]
  );

  const submit = useCallback(async (): Promise<boolean> => {
    if (!detail || !routeGarden) return false;
    try {
      await jobs.enqueue({
        act: "evidence",
        payload: {
          clientEvidenceId,
          commitmentId: detail.commitment.commitmentId,
          creditedContributors: credited,
          gardenAddress: (detail.commitment.providerGarden ?? routeGarden) as Address,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(links.length > 0 ? { links } : {}),
          ...(media.length > 0 ? { media } : {}),
          ...(audioNotes.length > 0 ? { audioNotes } : {}),
        },
      });
      mediaResourceManager.cleanupUrls("proof");
      setQueued(true);
      await draft.clear();
      return true;
    } catch {
      return false;
    }
  }, [
    audioNotes,
    clientEvidenceId,
    credited,
    detail,
    draft,
    jobs,
    links,
    media,
    note,
    routeGarden,
  ]);

  let status: ProofComposerStatus = "ready";
  if (query.availability.status !== "available") status = "unavailable";
  else if (query.isLoading) status = "loading";
  else if (query.isError) status = "error";
  else if (!detail || (seat !== "provider" && seat !== "contributor")) status = "notYours";
  else if (selectCommitmentActKind({ commitment: detail.commitment, seat }) !== "addProof")
    status = "closed";
  else if (queued) status = "queued";

  const imageUrls = media
    .filter((file) => !isVideoFile(file))
    .map((file) => mediaResourceManager.getOrCreateUrl(file, "proof"));

  return {
    status,
    availability: query.availability,
    isOnline,
    viewer,
    detail,
    commitment: detail?.commitment ?? null,
    metadata,
    roster,
    media,
    audioNotes,
    note,
    setNote,
    links,
    setLinks,
    credited,
    clientEvidenceId,
    isProcessing,
    isRecording: recording.isRecording,
    recordingElapsed: recording.elapsed,
    isPending: jobs.isPending,
    linkInvalid,
    imageUrls,
    readiness,
    toggleCredit,
    toggleRecording: recording.toggle,
    pick,
    removeMedia,
    removeAudio,
    submit,
    refetch: query.refetch,
  };
}
