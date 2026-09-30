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
import { imageCompressor } from "../../../utils/work/image-compression";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import {
  type CommitmentSendReport,
  useCommitmentJobs,
} from "../../commitment-pooling/useCommitmentJobs";
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
import { followBackgroundProof, proofSendKey, settleProofSend, startProofSend } from "./proofSend";
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
  const [clientEvidenceId] = useState(() => draft.saved?.clientEvidenceId ?? crypto.randomUUID());
  const [landing, setLanding] = useState<ProofLanding | null>(null);
  const [sendTooChoice, setSendTooChoice] = useState<boolean | null>(null);
  const submitting = useRef(false);

  const restoreFiles = useCallback((files: { media: File[]; audioNotes: File[] }) => {
    if (files.media.length > 0) setMedia(files.media);
    if (files.audioNotes.length > 0) setAudioNotes(files.audioNotes);
  }, []);
  useProofDraftSync(draft, {
    queued,
    words: { note, links, credited: selectedCredit, clientEvidenceId, garden: routeGarden ?? "" },
    files: { media, audioNotes },
    onRestore: restoreFiles,
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
    const toasts = createProofToasts(intl.formatMessage);
    const onOpenYourWork = input.onOpenYourWork;
    const record = detail.commitment;
    const gardenAddress = (record.providerGarden ?? routeGarden) as Address;
    const withSend = sendToo;
    const leads = seat === "provider";
    // Written by the send's reports; typed here, not narrowed to their first values.
    let admittedJobId = null as string | null;
    // Add and Send's send, queued behind the proof when the queue took it.
    let sendJobId = null as string | null;
    // How the tap's own send ended, when it ended here.
    let ended = null as "landed" | "declined" | null;
    let queuedReason = undefined as string | undefined;
    const land = (to: ProofLanding) => setLanding((current) => current ?? to);
    const letGo = () => {
      draftRepository.revoke("proof");
      setQueued(true);
      void draft.clear().catch(() => undefined);
    };
    // The promise says the proof is on its way, and holds its queue notice,
    // from the moment it leaves this phone until the send is over.
    const sendKey = proofSendKey(input.chainId, record.commitmentId, viewer);
    const onItsWay = () =>
      startProofSend(sendKey, {
        contents: proofContentsOf({ media, audioNotes, links, note }),
        baseline: record.evidenceCount,
      });
    // The second act was queued with the proof and waited for it. Now the proof
    // has landed it goes: a wallet is asked for the second signature here, and
    // anyone else's goes with the background flush. With no send queued, or one
    // that failed, Send for Confirmation stays on the promise.
    const sendForConfirmation = async () => {
      const sent = sendJobId
        ? await jobs.sendQueued({ jobId: sendJobId, commitmentId: record.commitmentId }).then(
            () => true,
            () => false
          )
        : false;
      toasts.added({ sent, leads });
    };
    const proofLanded = async () => {
      if (withSend) await sendForConfirmation();
      else toasts.added({ sent: false, leads });
      settleProofSend(sendKey, { landed: true });
    };
    const sendOver = () => settleProofSend(sendKey, { landed: false });
    // A passkey or embedded sign-in leaves the send to the background flush,
    // which may pick the proof up at once, so it is followed from admission.
    const flushSends = !jobs.sendsFromTap && isOnline && viewer !== null;
    const followFlush = (jobId: string, owner: Address) => {
      onItsWay();
      followBackgroundProof({
        jobId,
        owner,
        onEnd: (outcome) => {
          if (outcome === "landed") {
            void proofLanded();
            return;
          }
          sendOver();
          if (outcome === "declined") toasts.notAdded();
          else if (outcome === "failed") toasts.couldNotAdd(onOpenYourWork);
          else toasts.takingLonger();
        },
      });
    };

    if (isOnline) toasts.adding({ sendToo: withSend });
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
    const report = (event: CommitmentSendReport) => {
      switch (event.stage) {
        case "admitted":
          admittedJobId = event.jobId;
          sendJobId = event.followUpJobId ?? null;
          letGo();
          if (flushSends && viewer) followFlush(event.jobId, viewer);
          return;
        case "confirming":
          onItsWay();
          toasts.confirming();
          land("sending");
          return;
        case "landed":
          ended = "landed";
          // Held until the record counts it, when no confirming stage came first.
          onItsWay();
          land("landed");
          return;
        case "declined":
          ended = "declined";
          toasts.notAdded();
          land("declined");
          return;
        case "queued":
          queuedReason = event.reason;
          land("queued");
          return;
      }
    };

    try {
      await jobs.enqueue({
        act: "evidence",
        payload,
        report,
        ...(withSend ? { sendToo: true } : {}),
      });
    } catch {
      submitting.current = false;
      sendOver();
      if (!admittedJobId) {
        // Never queued: the proof is still this draft, and the form stays.
        toasts.dismiss();
        return false;
      }
      toasts.couldNotAdd(onOpenYourWork);
      land("failed");
      return true;
    }
    submitting.current = false;

    if (ended === "landed") void proofLanded();
    else if (ended === "declined") {
      // Already said: nothing was sent, and the proof waits on the phone.
    } else if (!isOnline) toasts.savedOffline();
    else if (flushSends) {
      // Followed since admission; the follower says how the flush's send ended.
    } else {
      sendOver();
      if (queuedReason === "awaiting-confirmation") toasts.takingLonger();
      // Otherwise the wallet send waits its turn, and the promise's notice says why.
      else toasts.dismiss();
    }
    return true;
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
    !landing &&
    selectCommitmentActKind({ commitment: detail.commitment, seat }) !== "addProof"
  )
    status = "closed";

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
    landing,
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
