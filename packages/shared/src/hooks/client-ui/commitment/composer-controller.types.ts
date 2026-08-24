import type { UseFormReturn } from "react-hook-form";

import type { CommitmentCycleNameMap } from "../../commitment-pooling/useCommitmentCycleNames";
import type { CommitmentComposerValues } from "../../commitment-pooling/useCommitmentComposerForm";
import type { CommitmentComposerDraft } from "../../../stores/useCommitmentComposerDraftStore";
import type { CommitmentCycleRecord } from "../../../modules/commitment-pooling/types";
import type { Action, Address } from "../../../types/domain";

export type CommitmentComposerAccess = "loading" | "barred" | "allowed";
export type CommitmentComposerDirection = "OFFER" | "REQUEST";

export interface CommitmentComposerController {
  direction: CommitmentComposerDirection;
  garden: Address | null;
  viewer: Address | null;
  isOnline: boolean;
  form: UseFormReturn<CommitmentComposerValues>;
  values: CommitmentComposerValues;
  actions: Action[];
  openCycles: CommitmentCycleRecord[];
  cycleNames: CommitmentCycleNameMap["byCycleId"];
  gardenName: string | null;
  savedDraft: CommitmentComposerDraft | undefined;
  draftDecision: "pending" | "decided";
  clientCommitmentId: string;
  placed: boolean;
  access: CommitmentComposerAccess;
  hasPool: boolean;
  poolOpen: boolean;
  isPending: boolean;
  resumeDraft: () => void;
  startFresh: () => void;
  place: () => Promise<boolean>;
}
