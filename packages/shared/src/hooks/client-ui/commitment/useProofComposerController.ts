/**
 * Proof composer controller
 *
 * Owns commitment authority, draft persistence, queue payloads, media resources,
 * form state and the send's feedback, so the client view only renders the
 * three steps and leaves for the promise when told.
 *
 * @module hooks/client-ui/commitment/useProofComposerController
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";

import { createProofToasts } from "../../../components/Toast/presets/proof";
import { selectCommitmentActKind } from "../../../modules/commitment-pooling/acts";
import type { EvidenceJobPayload } from "../../../modules/commitment-pooling/jobs";
import {
  type ProofDraftRepository,
  proofDraftRepository,
} from "../../../modules/commitment-pooling/proof-draft-repository";
import { selectCommitmentSeat } from "../../../modules/commitment-pooling/selectors";
import {
  getWorkMediaId,
  isHeicFile,
  isVideoFile,
  prepareMediaForUpload,
} from "../../../modules/work/media-processing";
import type { Address } from "../../../types/domain";
import type { CommitmentProofDraft } from "../../../stores/useCommitmentProofDraftStore";
import { imageCompressor } from "../../../utils/work/image-compression";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCommitmentJobs } from "../../commitment-pooling/useCommitmentJobs";
import { useCommitmentMetadataFor } from "../../commitment-pooling/useCommitmentMetadata";
import {
  useCommitmentProofDraft,
  useProofDraftSync,
} from "../../commitment-pooling/useCommitmentProofDraft";
import {
  useCommitment,
  useCommitmentCycle,
  useCommitmentPool,
} from "../../commitment-pooling/useCommitmentPooling";
import { useProtocolPool } from "../../commitment-pooling/useProtocolPool";
import { useGardenRecord } from "../../garden/useGardenRecord";
import { useAudioRecording } from "../../utils/useAudioRecording";
import { useDeferredHeicConversion } from "../../work/useDeferredHeicConversion";
import type {
  ProofComposerController,
  ProofComposerStatus,
  ProofLanding,
  ProofRosterMember,
} from "./proof-controller.types";
import { proofContentsOf } from "./proofContents";
import { enqueueProof, proofSendKey } from "./proofSend";
import { type ProofBeat, selectProofReadiness, selectSendTooOffered } from "./proofReadiness";

export interface UseProofComposerControllerInput {
  chainId: number;
  commitmentId: bigint | null;
  routeGarden: Address | string | null | undefined;
  draftRepository?: ProofDraftRepository;
  /** Where "Couldn't add proof" sends someone to try again: Your Work's Pending list. */
  onOpenYourWork?: () => void;
}

function sameAddress(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

const NO_STEWARDS: readonly Address[] = [];

export function useProofComposerController(
  input: UseProofComposerControllerInput
): ProofComposerController {
  const intl = useIntl();
  const isOnline = useOnlineStatus();
  const draftRepository = input.draftRepository ?? proofDraftRepository;
  const viewer = (usePrimaryAddress() as Address | null) ?? null;
  const routeGarden = (input.routeGarden as Address | null | undefined) ?? null;
  const query = useCommitment(
    { chainId: input.chainId, commitmentId: input.commitmentId ?? 0n },
    { enabled: input.commitmentId !== null }
  );
  const commitment = query.detail?.commitment;
  const metadata = useCommitmentMetadataFor(commitment);
  const pool = useCommitmentPool(
    { chainId: input.chainId, poolId: commitment?.poolId ?? 0n },
    { enabled: Boolean(commitment?.poolId) }
  );
  const cycleId = commitment?.cycleId ?? 0n;
  const cycle = useCommitmentCycle(
    { chainId: input.chainId, cycleId },
    { enabled: cycleId !== 0n }
  );
  const protocolPool = useProtocolPool({ chainId: input.chainId });
  // The promise's own garden, so the Proof for sheet tags whoever confirms it as a steward.
  const poolGarden = useGardenRecord((pool.pool?.garden as Address | undefined) ?? null);
  const jobs = useCommitmentJobs({ chainId: input.chainId });
  const draft = useCommitmentProofDraft({
    chainId: input.chainId,
    viewer,
    commitmentId: input.commitmentId,
    repository: draftRepository,
  });

  const [media, setMedia] = useState<File[]>([]);
  const [audioNotes, setAudioNotes] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [note, setNote] = useState(() => draft.saved?.note ?? "");
  const [links, setLinks] = useState<string[]>(() => draft.saved?.links ?? []);
  const [selectedCredit, setSelectedCredit] = useState<Address[] | null>(
    () => (draft.saved?.credited as Address[] | null | undefined) ?? null
  );
  // Once the queue holds the proof, the draft is let go and never saved again.
  const [queued, setQueued] = useState(false);
  const [clientEvidenceId, setClientEvidenceId] = useState(
    () => draft.saved?.clientEvidenceId ?? crypto.randomUUID()
  );
  const [landing, setLanding] = useState<ProofLanding | null>(null);
  const [formKey, setFormKey] = useState(draft.key);
  const currentLanding = formKey === draft.key ? landing : null;
  const [sendTooChoice, setSendTooChoice] = useState<boolean | null>(null);
  const submitting = useRef(false);

  const restoreDraft = useCallback(
    (files: { media: File[]; audioNotes: File[] }, words: CommitmentProofDraft | undefined) => {
      setMedia(files.media);
      setAudioNotes(files.audioNotes);
      setNote(words?.note ?? "");
      setLinks(words?.links ?? []);
      setSelectedCredit((words?.credited as Address[] | null | undefined) ?? null);
      setClientEvidenceId(words?.clientEvidenceId ?? crypto.randomUUID());
      setQueued(false);
      setLanding(null);
      setFormKey(draft.key);
      setSendTooChoice(null);
      setIsProcessing(false);
      submitting.current = false;
    },
    [draft.key]
  );
  const draftSync = useProofDraftSync(draft, {
    queued,
    words: { note, links, credited: selectedCredit, clientEvidenceId, garden: routeGarden ?? "" },
    files: { media, audioNotes },
    onRestore: restoreDraft,
  });

  const heic = useDeferredHeicConversion({
    files: media,
    replace: (mediaId, converted) =>
      setMedia((current) =>
        current.map((file) => (getWorkMediaId(file) === mediaId ? converted : file))
      ),
  });

  const recording = useAudioRecording({
    onRecordingComplete: (file) => setAudioNotes((current) => [...current, file]),
  });
  useEffect(() => () => draftRepository.revoke("proof"), [draftRepository]);

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

  // D19: Add and Send only when this reader may send and the chain would take it.
  const canSendToo = useMemo(
    () =>
      selectSendTooOffered({
        detail,
        seat,
        pool: pool.pool,
        cycle: cycleId === 0n ? null : (cycle.cycle ?? undefined),
        creditedCount: credited.length,
        protocolPoolRegistered: protocolPool.isRegistered,
      }),
    [credited.length, cycle.cycle, cycleId, detail, pool.pool, protocolPool.isRegistered, seat]
  );
  // On by default for someone working alone; off with a team, since sending
  // settles the team and its credit.
  const sendToo = canSendToo && (sendTooChoice ?? roster.length <= 1);

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

  const composerScope = useRef({ key: draft.key, cancelled: false });
  if (composerScope.current.key !== draft.key)
    composerScope.current = { key: draft.key, cancelled: false };
  useEffect(() => {
    const scope = composerScope.current;
    scope.cancelled = false;
    return () => {
      scope.cancelled = true;
    };
  }, [draft.key]);
  const pick = useCallback(
    async (files: FileList | File[] | null) => {
      if (!draftSync.isRestored || !files || files.length === 0) return { rejectedCount: 0 };
      const scope = composerScope.current;
      setIsProcessing(true);
      try {
        const prepared = await prepareMediaForUpload(Array.from(files), imageCompressor);
        if (composerScope.current !== scope || scope.cancelled) return { rejectedCount: 0 };
        setMedia((current) => [...current, ...prepared.files]);
        return { rejectedCount: prepared.rejectedCount };
      } finally {
        if (composerScope.current === scope && !scope.cancelled) setIsProcessing(false);
      }
    },
    [draftSync.isRestored]
  );

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
    (beat: ProofBeat) => {
      const ready = selectProofReadiness({
        beat,
        isProcessing,
        isRecording: recording.isRecording,
        hasAnything,
        creditedCount: credited.length,
        links,
      });
      return {
        ...ready,
        canAdvance: ready.canAdvance && draftSync.isRestored && draftSync.persistence === "saved",
      };
    },
    [
      credited.length,
      hasAnything,
      isProcessing,
      links,
      recording.isRecording,
      draftSync.isRestored,
      draftSync.persistence,
    ]
  );

  /**
   * Add This Proof, in Submit Work's sequence (D18). The page stays still while
   * the toast says what is happening. Once the queue holds the proof the draft
   * is let go, and as soon as nothing waits on this screen (the signature is
   * given, the send is left queued, or the person declined) the flow hands over
   * to the promise through `landing`. Anything after that, the rest of a send
   * and Add and Send's second act, runs on without the screen.
   */
  const submit = useCallback(async (): Promise<boolean> => {
    if (
      !detail ||
      !routeGarden ||
      !viewer ||
      queued ||
      submitting.current ||
      !readiness("media").canAdvance ||
      !readiness("details").canAdvance
    )
      return false;
    submitting.current = true;
    const scope = composerScope.current;
    const ownsForm = () => composerScope.current === scope && !scope.cancelled;
    const record = detail.commitment;
    const gardenAddress = (record.providerGarden ?? routeGarden) as Address;
    const payload: EvidenceJobPayload = {
      clientEvidenceId,
      commitmentId: record.commitmentId,
      creditedContributors: credited,
      gardenAddress,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(links.length > 0 ? { links } : {}),
      ...(media.length > 0 ? { media } : {}),
      ...(audioNotes.length > 0 ? { audioNotes } : {}),
    };
    return enqueueProof({
      jobs,
      payload,
      send: {
        key: proofSendKey(input.chainId, record.commitmentId, viewer),
        owner: viewer,
        contents: proofContentsOf({ media, audioNotes, links, note }),
        baseline: record.evidenceCount,
      },
      withSend: sendToo,
      leads: seat === "provider",
      isOnline,
      toasts: createProofToasts(intl.formatMessage),
      onOpenYourWork: input.onOpenYourWork,
      onAdmission: () => {
        if (ownsForm()) {
          draftRepository.revoke("proof");
          setQueued(true);
        }
        void draft.clear().catch(() => undefined);
      },
      onLanding: (to) => {
        if (ownsForm()) setLanding((current) => (ownsForm() ? (current ?? to) : current));
      },
      onEnqueueSettled: () => {
        if (ownsForm()) submitting.current = false;
      },
    });
  }, [
    audioNotes,
    clientEvidenceId,
    credited,
    detail,
    draft,
    draftRepository,
    input.chainId,
    input.onOpenYourWork,
    intl.formatMessage,
    isOnline,
    jobs,
    links,
    media,
    note,
    routeGarden,
    queued,
    readiness,
    seat,
    sendToo,
    viewer,
  ]);

  let status: ProofComposerStatus = "ready";
  if (query.availability.status !== "available") status = "unavailable";
  else if (query.isLoading) status = "loading";
  else if (query.isError) status = "error";
  else if (!detail || (seat !== "provider" && seat !== "contributor")) status = "notYours";
  // Once handed over, the refreshed record may read as sent; the view is leaving anyway.
  else if (
    !currentLanding &&
    selectCommitmentActKind({ commitment: detail.commitment, seat }) !== "addProof"
  )
    status = "closed";
  else if (draft.restoration === "failed") status = "draftRestoreFailed";
  else if (!draftSync.isRestored) status = "restoringDraft";

  // A HEIC photo waiting to convert shows a placeholder, not a preview.
  const imageUrls = draftRepository.previewUrls(
    "proof",
    media.filter((file) => !isVideoFile(file) && !isHeicFile(file))
  );

  return {
    status,
    availability: query.availability,
    isOnline,
    viewer,
    detail,
    commitment: detail?.commitment ?? null,
    metadata,
    roster,
    seat,
    stewards: poolGarden.data?.stewards ?? NO_STEWARDS,
    leads: seat === "provider",
    media,
    audioNotes,
    contents: proofContentsOf({ media, audioNotes, links, note }),
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
    draftPersistence: draftSync.persistence,
    retryDraftRestore: draft.retryRestore,
    retryDraftSave: draftSync.retrySave,
    landing: currentLanding,
    canSendToo,
    sendToo,
    setSendToo: setSendTooChoice,
    linkInvalid,
    imageUrls,
    heicStateOf: heic.stateOf,
    retryHeicConversion: heic.retry,
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
