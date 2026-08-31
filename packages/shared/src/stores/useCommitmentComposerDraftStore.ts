/**
 * Commitment Composer Draft Store
 *
 * What a member has typed into the commitment composer, kept on this device
 * until they place it or throw it away. Mirrors the work draft's promise
 * (`WorkDraftRecord`: a draft survives closing the app) at the composer's own
 * scale, which is a few fields rather than a media list.
 *
 * One draft per member, garden and door. The key is the whole of that: two
 * gardens never share a draft, and a request never resumes into an offer. The
 * draft carries its `clientCommitmentId`, because the queue derives the
 * creation request key from it and a draft resumed after a restart must keep
 * the id it started with rather than mint a second commitment behind the same
 * button.
 *
 * @module stores/useCommitmentComposerDraftStore
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const COMMITMENT_COMPOSER_DRAFT_STORAGE_KEY = "gg-commitment-composer-drafts";

export interface CommitmentComposerDraft {
  /** The form's values as last saved. Typed loosely: the form owns its schema. */
  values: Record<string, unknown>;
  clientCommitmentId: string;
  updatedAt: number;
}

export interface CommitmentComposerDraftStore {
  drafts: Record<string, CommitmentComposerDraft>;
  saveDraft: (
    key: string,
    draft: Omit<CommitmentComposerDraft, "updatedAt">,
    updatedAt?: number
  ) => void;
  clearDraft: (key: string) => void;
}

export function commitmentComposerDraftKey(input: {
  chainId: number;
  viewer: string;
  garden: string;
  direction: "OFFER" | "REQUEST";
}): string {
  return [
    input.chainId,
    input.viewer.toLowerCase(),
    input.garden.toLowerCase(),
    input.direction,
  ].join(":");
}

export const useCommitmentComposerDraftStore = create<CommitmentComposerDraftStore>()(
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
    { name: COMMITMENT_COMPOSER_DRAFT_STORAGE_KEY }
  )
);
