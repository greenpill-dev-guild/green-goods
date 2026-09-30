/**
 * useCommitmentProofDraft Hook
 *
 * The proof composer's draft: the words from the proof draft store, the files
 * from the draft image table, both under one key. Loaded once when the
 * composer opens, saved as the member works, and cleared the moment the proof
 * is queued or thrown away.
 *
 * Files are saved whole on every change rather than diffed. A proof holds a
 * handful of photos at most, and replacing them is a few IndexedDB writes;
 * tracking which one moved is where a second bug would live.
 *
 * @module hooks/commitment-pooling/useCommitmentProofDraft
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ProofDraftRepository,
  proofDraftRepository,
} from "../../modules/commitment-pooling/proof-draft-repository";
import {
  type CommitmentProofDraft,
  commitmentProofDraftKey,
  useCommitmentProofDraftStore,
} from "../../stores/useCommitmentProofDraftStore";
import type { Address } from "../../types/domain";

export interface ProofDraftFiles {
  media: File[];
  audioNotes: File[];
}

export interface CommitmentProofDraftHandle {
  /** The draft's key, or null until the viewer and commitment are known. */
  key: string | null;
  /** Words and choices as last saved; undefined when there is no draft. */
  saved: CommitmentProofDraft | undefined;
  /** Files as last saved; resolved once after mount. */
  savedFiles: ProofDraftFiles | null;
  /** False until the files have been read back, so a form does not start empty and then fill. */
  isRestored: boolean;
  saveWords: (draft: Omit<CommitmentProofDraft, "updatedAt">) => void;
  saveFiles: (files: ProofDraftFiles) => Promise<void>;
  clear: () => Promise<void>;
}

export function useCommitmentProofDraft(input: {
  chainId: number;
  viewer: Address | null | undefined;
  commitmentId: bigint | null;
  repository?: ProofDraftRepository;
}): CommitmentProofDraftHandle {
  const repository = input.repository ?? proofDraftRepository;
  const key =
    input.viewer && input.commitmentId !== null
      ? commitmentProofDraftKey({
          chainId: input.chainId,
          viewer: input.viewer,
          commitmentId: input.commitmentId,
        })
      : null;
  const drafts = useCommitmentProofDraftStore((state) => state.drafts);
  const saveDraft = useCommitmentProofDraftStore((state) => state.saveDraft);
  const clearDraft = useCommitmentProofDraftStore((state) => state.clearDraft);
  const saved = key ? drafts[key] : undefined;

  const [savedFiles, setSavedFiles] = useState<ProofDraftFiles | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const restoredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!key || restoredFor.current === key) return;
    restoredFor.current = key;
    let cancelled = false;
    void repository.load(key).then((files) => {
      if (cancelled) return;
      setSavedFiles({
        media: files.filter((file) => !file.type.startsWith("audio/")),
        audioNotes: files.filter((file) => file.type.startsWith("audio/")),
      });
      setIsRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key, repository]);

  const saveWords = useCallback(
    (draft: Omit<CommitmentProofDraft, "updatedAt">) => {
      if (key) saveDraft(key, draft);
    },
    [key, saveDraft]
  );

  const saveFiles = useCallback(
    async (files: ProofDraftFiles) => {
      if (!key) return;
      await repository.save(key, [...files.media, ...files.audioNotes]);
    },
    [key, repository]
  );

  const clear = useCallback(async () => {
    if (!key) return;
    clearDraft(key);
    await repository.clear(key);
  }, [key, clearDraft, repository]);

  return { key, saved, savedFiles, isRestored, saveWords, saveFiles, clear };
}

/**
 * Keeps a composer's state and its draft in step: restores the files once
 * they are read back, writes the words on every change, and writes the files
 * when they change. Stops writing the moment the proof is queued, so a
 * cleared draft is not re-saved by the last render.
 */
export function useProofDraftSync(
  draft: CommitmentProofDraftHandle,
  input: {
    queued: boolean;
    words: Omit<CommitmentProofDraft, "updatedAt">;
    files: ProofDraftFiles;
    onRestore: (files: ProofDraftFiles) => void;
  }
): boolean {
  const [filesRestored, setFilesRestored] = useState(false);
  const { onRestore } = input;
  useEffect(() => {
    if (!draft.isRestored || filesRestored || !draft.savedFiles) return;
    setFilesRestored(true);
    onRestore(draft.savedFiles);
  }, [draft.isRestored, draft.savedFiles, filesRestored, onRestore]);

  const { saveWords, saveFiles } = draft;
  const { note, links, credited, clientEvidenceId } = input.words;
  useEffect(() => {
    if (input.queued) return;
    saveWords({ note, links, credited, clientEvidenceId });
  }, [note, links, credited, clientEvidenceId, input.queued, saveWords]);

  const { media, audioNotes } = input.files;
  useEffect(() => {
    if (input.queued || !filesRestored) return;
    void saveFiles({ media, audioNotes });
  }, [media, audioNotes, input.queued, filesRestored, saveFiles]);

  return filesRestored;
}
