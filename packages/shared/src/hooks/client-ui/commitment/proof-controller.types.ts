import type { Dispatch, SetStateAction } from "react";

import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type {
  CommitmentDetail,
  CommitmentReadModel,
} from "../../../modules/commitment-pooling/types";
import type { CommitmentPoolingAvailability } from "../../../modules/commitment-pooling/types-core";
import type { Address } from "../../../types/domain";
import type { ProofBeat, ProofReadiness } from "./proofReadiness";

export type ProofComposerStatus =
  | "unavailable"
  | "loading"
  | "error"
  | "notYours"
  | "closed"
  | "queued"
  | "ready";

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
  media: File[];
  audioNotes: File[];
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
  linkInvalid: boolean;
  imageUrls: string[];
  readiness: (beat: ProofBeat) => ProofReadiness;
  toggleCredit: (address: Address) => void;
  toggleRecording: () => void;
  pick: (files: FileList | File[] | null) => Promise<{ rejectedCount: number }>;
  removeMedia: (index: number) => void;
  removeAudio: (index: number) => void;
  submit: () => Promise<boolean>;
  refetch: () => Promise<unknown>;
}
