/**
 * Commitment Proof Draft Store
 *
 * What a member has put into the proof composer, kept on this device until
 * the proof is queued or thrown away. Proof is composed in the field across
 * three beats, so an interrupted session — the PWA evicted, the phone locked
 * for an hour, a tap on the wrong thing — would otherwise lose every photo
 * and voice note taken. The commitment composer already keeps a draft; this
 * is the same promise for proof.
 *
 * The words live here. The files live in the draft image table of the work
 * draft database under the same key, because that table already knows how to
 * serialize a File into IndexedDB and read it back, and a second copy of that
 * is how two of them drift.
 *
 * One draft per member and commitment, keyed by the whole of that.
 *
 * @module stores/useCommitmentProofDraftStore
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const COMMITMENT_PROOF_DRAFT_STORAGE_KEY = "gg-commitment-proof-drafts";

export interface CommitmentProofDraft {
  note: string;
  links: string[];
  /** Lowercased addresses the member ticked; null means "not chosen yet". */
  credited: string[] | null;
  /**
   * The queue's identity for this proof before it has a CID. Kept with the
   * draft so a proof resumed after a restart is still one job behind one
   * button rather than two.
   */
  clientEvidenceId: string;
  updatedAt: number;
}

export interface CommitmentProofDraftStore {
  drafts: Record<string, CommitmentProofDraft>;
  saveDraft: (
    key: string,
    draft: Omit<CommitmentProofDraft, "updatedAt">,
    updatedAt?: number
  ) => void;
  clearDraft: (key: string) => void;
}

export function commitmentProofDraftKey(input: {
  chainId: number;
  viewer: string;
  commitmentId: bigint | string;
}): string {
  return ["proof", input.chainId, input.viewer.toLowerCase(), String(input.commitmentId)].join(":");
}

export const useCommitmentProofDraftStore = create<CommitmentProofDraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      saveDraft: (key, draft, updatedAt = Date.now()) =>
        set((state) => ({
          drafts: { ...state.drafts, [key]: { ...draft, updatedAt } },
        })),
      clearDraft: (key) =>
        set((state) => {
          const { [key]: _removed, ...rest } = state.drafts;
          return { drafts: rest };
        }),
    }),
    { name: COMMITMENT_PROOF_DRAFT_STORAGE_KEY }
  )
);
