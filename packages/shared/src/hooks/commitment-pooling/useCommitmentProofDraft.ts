/**
 * The proof composer's key-scoped restoration and latest-snapshot durability.
 * Words stay in the proof store; whole files stay in the existing draft repository.
 * A failed read never admits an empty autosave, and a failed save keeps the form.
 * @module hooks/commitment-pooling/useCommitmentProofDraft
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logger } from "../../modules/app/logger";
import {
  type ProofDraftRepository,
  proofDraftRepository,
} from "../../modules/commitment-pooling/proof-draft-repository";
import { isVideoFile } from "../../modules/work/media-processing";
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

type DraftWords = Omit<CommitmentProofDraft, "updatedAt" | "files">;
interface DraftSnapshot {
  words: DraftWords;
  files: ProofDraftFiles;
}
type PersistenceStatus = "saving" | "saved" | "failed";
interface DraftScope {
  key: string | null;
  repository: ProofDraftRepository;
  cancelled: boolean;
  retired: boolean;
  revision: number;
  restoredFiles: ProofDraftFiles | null;
  durableFiles: ProofDraftFiles | null;
}

export interface CommitmentProofDraftHandle {
  key: string | null;
  saved: CommitmentProofDraft | undefined;
  /** Hidden immediately when the draft key changes. */
  savedFiles: ProofDraftFiles | null;
  restoration: "loading" | "restored" | "failed";
  isRestored: boolean;
  retryRestore: () => void;
  persistence: { snapshot: DraftSnapshot; status: PersistenceStatus } | null;
  /** Observe both attachment and words/count persistence, never just the files. */
  saveSnapshot: (snapshot: DraftSnapshot) => Promise<boolean>;
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
  const recordFiles = useCommitmentProofDraftStore((state) => state.recordFiles);
  const clearDraft = useCommitmentProofDraftStore((state) => state.clearDraft);
  const scopeRef = useRef<DraftScope | null>(null);
  const currentInput = useRef({ key, repository });
  currentInput.current = { key, repository };
  const [attempt, setAttempt] = useState(0);
  const [restoration, setRestoration] = useState<{
    scope: DraftScope;
    status: CommitmentProofDraftHandle["restoration"];
  } | null>(null);
  const [persistence, setPersistence] = useState<{
    scope: DraftScope;
    snapshot: DraftSnapshot;
    status: PersistenceStatus;
  } | null>(null);

  const ownsScope = useCallback(
    (scope: DraftScope) =>
      scopeRef.current === scope &&
      !scope.cancelled &&
      currentInput.current.key === scope.key &&
      currentInput.current.repository === scope.repository,
    []
  );
  const isCurrent = useCallback(
    (scope: DraftScope) => ownsScope(scope) && !scope.retired,
    [ownsScope]
  );

  useEffect(() => {
    const scope: DraftScope = {
      key,
      repository,
      cancelled: false,
      retired: false,
      revision: 0,
      restoredFiles: null,
      durableFiles: null,
    };
    scopeRef.current = scope;
    setRestoration({ scope, status: "loading" });
    if (key) {
      void (async () => {
        try {
          const storePersistence = useCommitmentProofDraftStore.persist;
          if (!storePersistence?.getOptions().storage) throw new Error("Storage unavailable");
          if (!storePersistence.hasHydrated()) await storePersistence.rehydrate();
          if (!storePersistence.hasHydrated()) throw new Error("Draft words unavailable");
          const files = await repository.load(key);
          if (!isCurrent(scope)) return;
          scope.durableFiles = {
            media: files.filter((file) => !file.type.startsWith("audio/")),
            audioNotes: files.filter((file) => file.type.startsWith("audio/")),
          };
          scope.restoredFiles = scope.durableFiles;
          setRestoration({ scope, status: "restored" });
        } catch (error) {
          if (!isCurrent(scope)) return;
          logger.error("Proof draft restoration failed", {
            source: "useCommitmentProofDraft",
            errorName: error instanceof Error ? error.name : "unknown",
          });
          setRestoration({ scope, status: "failed" });
        }
      })();
    }
    return () => {
      scope.cancelled = true;
    };
  }, [attempt, isCurrent, key, repository]);

  const activeRestoration = restoration && ownsScope(restoration.scope) ? restoration : null;
  const savedIdentity = key ? drafts[key]?.clientEvidenceId : undefined;
  const isRestored = activeRestoration?.status === "restored";
  const retryRestore = useCallback(() => {
    if (activeRestoration?.status !== "failed" || !isCurrent(activeRestoration.scope)) return;
    setRestoration({ scope: activeRestoration.scope, status: "loading" });
    setAttempt((current) => current + 1);
  }, [activeRestoration, isCurrent]);

  const saveSnapshot = useCallback(
    async (snapshot: DraftSnapshot): Promise<boolean> => {
      const scope = scopeRef.current;
      if (
        !key ||
        !scope ||
        scope.key !== key ||
        scope.repository !== repository ||
        !isRestored ||
        !isCurrent(scope)
      )
        return false;
      const revision = ++scope.revision;
      const latest = () => isCurrent(scope) && scope.revision === revision;
      setPersistence({ scope, snapshot, status: "saving" });
      try {
        if (!useCommitmentProofDraftStore.persist?.getOptions().storage)
          throw new Error("Storage unavailable");
        const { media, audioNotes } = snapshot.files;
        // Typing words does not repeatedly serialize unchanged attachments.
        if (scope.durableFiles?.media !== media || scope.durableFiles.audioNotes !== audioNotes) {
          await repository.save(key, [...media, ...audioNotes]);
          if (!isCurrent(scope)) return false;
          scope.durableFiles = snapshot.files;
        }
        if (!latest()) return false;
        // The configured store is synchronous localStorage. Await its runtime
        // result too, so a returning persistence error cannot be fire-and-forgotten.
        await saveDraft(key, snapshot.words);
        if (!latest()) return false;
        const videos = media.filter((file) => isVideoFile(file)).length;
        await recordFiles(key, {
          photos: media.length - videos,
          videos,
          voiceNotes: audioNotes.length,
        });
        if (!latest()) return false;
        setPersistence({ scope, snapshot, status: "saved" });
        return true;
      } catch (error) {
        if (!isCurrent(scope)) return false;
        logger.error("Proof draft save failed", {
          source: "useCommitmentProofDraft",
          errorName: error instanceof Error ? error.name : "unknown",
        });
        if (latest()) setPersistence({ scope, snapshot, status: "failed" });
        return false;
      }
    },
    [isCurrent, isRestored, key, recordFiles, repository, saveDraft]
  );

  const clear = useCallback(async () => {
    const scope = activeRestoration?.scope;
    if (
      !key ||
      !scope ||
      !scope.restoredFiles ||
      scope.key !== key ||
      scope.repository !== repository ||
      scope.retired
    )
      return;
    if (
      savedIdentity &&
      useCommitmentProofDraftStore.getState().drafts[key]?.clientEvidenceId !== savedIdentity
    )
      return;
    // Queue admission can arrive after navigation. Retire the captured draft,
    // never whichever key this mounted hook happens to own by then.
    scope.retired = true;
    clearDraft(key);
    await repository.clear(key);
  }, [key, clearDraft, activeRestoration?.scope, repository, savedIdentity]);

  return {
    key,
    saved: key ? drafts[key] : undefined,
    savedFiles: isRestored ? (activeRestoration.scope.restoredFiles ?? null) : null,
    restoration: activeRestoration?.status ?? "loading",
    isRestored,
    retryRestore,
    persistence: persistence && ownsScope(persistence.scope) ? persistence : null,
    saveSnapshot,
    clear,
  };
}

/** Restore the whole form before any autosave; retries save the current form. */
export function useProofDraftSync(
  draft: CommitmentProofDraftHandle,
  input: {
    queued: boolean;
    words: DraftWords;
    files: ProofDraftFiles;
    onRestore: (files: ProofDraftFiles, words: CommitmentProofDraft | undefined) => void;
  }
): { isRestored: boolean; persistence: PersistenceStatus; retrySave: () => void } {
  const [restoredFor, setRestoredFor] = useState<{
    key: string;
    files: ProofDraftFiles;
  } | null>(null);
  const { onRestore } = input;
  useEffect(() => {
    if (
      !draft.key ||
      !draft.isRestored ||
      !draft.savedFiles ||
      (restoredFor?.key === draft.key && restoredFor.files === draft.savedFiles)
    )
      return;
    onRestore(draft.savedFiles, draft.saved);
    setRestoredFor({ key: draft.key, files: draft.savedFiles });
  }, [draft.key, draft.isRestored, draft.savedFiles, draft.saved, restoredFor, onRestore]);

  const isRestored = Boolean(
    draft.key &&
      draft.isRestored &&
      restoredFor?.key === draft.key &&
      restoredFor.files === draft.savedFiles
  );
  const { note, links, credited, clientEvidenceId, garden } = input.words;
  const { media, audioNotes } = input.files;
  const snapshot = useMemo<DraftSnapshot>(
    () => ({
      words: { note, links, credited, clientEvidenceId, ...(garden ? { garden } : {}) },
      files: { media, audioNotes },
    }),
    [note, links, credited, clientEvidenceId, garden, media, audioNotes]
  );
  const { saveSnapshot } = draft;
  useEffect(() => {
    if (input.queued || !isRestored) return;
    void saveSnapshot(snapshot);
  }, [input.queued, isRestored, saveSnapshot, snapshot]);

  const retrySave = useCallback(() => {
    if (!input.queued && isRestored) void saveSnapshot(snapshot);
  }, [input.queued, isRestored, saveSnapshot, snapshot]);

  return {
    isRestored,
    persistence: draft.persistence?.snapshot === snapshot ? draft.persistence.status : "saving",
    retrySave,
  };
}
