import type { Dispatch, SetStateAction } from "react";

import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type { CommitmentSeat } from "../../../modules/commitment-pooling/selectors";
import type {
  CommitmentDetail,
  CommitmentReadModel,
} from "../../../modules/commitment-pooling/types";
import type { CommitmentPoolingAvailability } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import type { ProofBeat, ProofReadiness } from "./proofReadiness";
import type { ProofContents } from "./proofContents";

export type ProofComposerStatus =
  | "unavailable"
  | "loading"
  | "error"
  | "notYours"
  | "closed"
  | "ready";

/**
 * Where Add This Proof hands over to the promise (D7, D18), once the queue holds
 * the proof and nothing waits on this screen: signed and confirming, landed,
 * left queued (offline, or for the background flush), declined at the prompt,
 * or failed with the proof kept. The toasts carry the rest.
 */
export type ProofLanding = "sending" | "landed" | "queued" | "declined" | "failed";

export interface ProofRosterMember {
  address: Address;
  isLead: boolean;
}

export interface ProofComposerController {
  status: ProofComposerStatus;
  availability: CommitmentPoolingAvailability;
  isOnline: boolean;
  viewer: Address | null;
  detail: CommitmentDetail | null;
  commitment: CommitmentReadModel | null;
  metadata: CommitmentMetadataV1 | null;
  roster: ProofRosterMember[];
  /** Where the reader sits on this promise; only a provider or a contributor gets the form. */
  seat: CommitmentSeat | null;
  /** The stewards of the promise's garden, once read, so the Proof for sheet can tag them. */
  stewards: readonly Address[];
  /** The reader leads the promise, so sending it is theirs; a teammate only adds proof. */
  leads: boolean;
  media: File[];
  audioNotes: File[];
  /** What the proof holds so far, counted. */
  contents: ProofContents;
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
  links: string[];
  setLinks: Dispatch<SetStateAction<string[]>>;
  credited: Address[];
  clientEvidenceId: string;
  isProcessing: boolean;
  isRecording: boolean;
  recordingElapsed: number;
  isPending: boolean;
  landing: ProofLanding | null;
  /**
   * D19: whether Review may offer "Send for confirmation too": the reader leads,
   * the promise is kept by proof, and the chain would take the send once this
   * proof lands.
   */
  canSendToo: boolean;
  /** Whether Add This Proof also sends it; on by default for someone working alone. */
  sendToo: boolean;
  setSendToo: (on: boolean) => void;
  linkInvalid: boolean;
  /** Photos only, without any HEIC photo still waiting to convert. */
  imageUrls: string[];
  /** A waiting HEIC photo's conversion; `undefined` for every other file. */
  heicStateOf: (file: File) => "waiting" | "converting" | "failed" | undefined;
  retryHeicConversion: (file: File) => void;
  readiness: (beat: ProofBeat) => ProofReadiness;
  toggleCredit: (address: Address) => void;
  toggleRecording: () => void;
  pick: (files: FileList | File[] | null) => Promise<{ rejectedCount: number }>;
  removeMedia: (index: number) => void;
  removeAudio: (index: number) => void;
  submit: () => Promise<boolean>;
  refetch: () => Promise<unknown>;
}
