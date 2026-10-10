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
  /**
   * The garden the composer was opened under, where the promise's page opens,
   * so Your Work can reopen the draft without reading the promise first.
   */
  garden?: string;
  /**
   * What the draft's files hold, counted when they are saved, so Your Work can
   * list the draft and say what is in it without reading the files back.
   */
  files?: { photos: number; videos: number; voiceNotes: number };
  updatedAt: number;
}

type DraftWords = Omit<CommitmentProofDraft, "updatedAt" | "files" | "garden">;

/** Whether two saves hold the same words: saving them again is not an edit. */
function sameWords(left: DraftWords, right: DraftWords): boolean {
  return (
    left.note === right.note &&
    left.clientEvidenceId === right.clientEvidenceId &&
    JSON.stringify(left.links) === JSON.stringify(right.links) &&
    JSON.stringify(left.credited) === JSON.stringify(right.credited)
  );
}

export interface CommitmentProofDraftStore {
  drafts: Record<string, CommitmentProofDraft>;
  saveDraft: (
    key: string,
    draft: Omit<CommitmentProofDraft, "updatedAt" | "files">,
    updatedAt?: number
  ) => void;
  /**
   * Counts the files just saved under a draft the words already created. A
   * change in them is an edit, so it dates the draft too.
   */
  recordFiles: (
    key: string,
    files: NonNullable<CommitmentProofDraft["files"]>,
    updatedAt?: number
  ) => void;
  clearDraft: (key: string) => void;
}

/** Where one reader's proof drafts on one chain start in the store. */
export function commitmentProofDraftPrefix(chainId: number, viewer: string): string {
  return `proof:${chainId}:${viewer.toLowerCase()}:`;
}

/**
 * Whether a draft holds anything. Opening the composer saves its empty words,
 * so a draft only counts once it has words, links or files.
 */
export function proofDraftHasContent(draft: CommitmentProofDraft): boolean {
  const files = draft.files;
  return (
    draft.note.trim().length > 0 ||
    draft.links.length > 0 ||
    Boolean(files && files.photos + files.videos + files.voiceNotes > 0)
  );
}

export function commitmentProofDraftKey(input: {
  chainId: number;
  viewer: string;
  commitmentId: bigint | string;
}): string {
  return `${commitmentProofDraftPrefix(input.chainId, input.viewer)}${String(input.commitmentId)}`;
}

export const useCommitmentProofDraftStore = create<CommitmentProofDraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      // The words replace the words; the file counts stay until the files change.
      // The same words saved again (the composer reopening) are not an edit, and
      // filling in the draft's garden is not one either.
      saveDraft: (key, draft, updatedAt = Date.now()) =>
        set((state) => {
          const current = state.drafts[key];
          if (current && sameWords(current, draft)) {
            if (!draft.garden || current.garden === draft.garden) return state;
            return { drafts: { ...state.drafts, [key]: { ...current, garden: draft.garden } } };
          }
          const garden = draft.garden || current?.garden;
          return {
            drafts: {
              ...state.drafts,
              [key]: { ...draft, ...(garden ? { garden } : {}), files: current?.files, updatedAt },
            },
          };
        }),
      // Saving the same files again (the composer reopening) is not an edit.
      // A draft with no count yet holds no files, as Your Work reads it.
      recordFiles: (key, files, updatedAt = Date.now()) =>
        set((state) => {
          const current = state.drafts[key];
          if (!current) return state;
          const before = current.files ?? { photos: 0, videos: 0, voiceNotes: 0 };
          if (
            before.photos === files.photos &&
            before.videos === files.videos &&
            before.voiceNotes === files.voiceNotes
          )
            return state;
          return { drafts: { ...state.drafts, [key]: { ...current, files, updatedAt } } };
        }),
      clearDraft: (key) =>
        set((state) => {
          const { [key]: _removed, ...rest } = state.drafts;
          return { drafts: rest };
        }),
    }),
    { name: COMMITMENT_PROOF_DRAFT_STORAGE_KEY }
  )
);
