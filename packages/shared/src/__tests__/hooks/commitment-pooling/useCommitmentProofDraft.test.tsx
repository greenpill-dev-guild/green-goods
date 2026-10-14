/** @vitest-environment happy-dom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCommitmentProofDraft,
  useProofDraftSync,
  type CommitmentProofDraftHandle,
} from "../../../hooks/commitment-pooling/useCommitmentProofDraft";
import { logger } from "../../../modules/app/logger";
import type { ProofDraftRepository } from "../../../modules/commitment-pooling/proof-draft-repository";
import {
  commitmentProofDraftKey,
  useCommitmentProofDraftStore,
} from "../../../stores/useCommitmentProofDraftStore";
import type { CommitmentProofDraft } from "../../../stores/useCommitmentProofDraftStore";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
type Snapshot = Parameters<CommitmentProofDraftHandle["saveSnapshot"]>[0];
const key = (id = 9n) =>
  commitmentProofDraftKey({ chainId: 42161, viewer: VIEWER, commitmentId: id });
const words = {
  note: "Saved words",
  links: ["https://example.org/proof"],
  credited: [VIEWER],
  clientEvidenceId: "saved-evidence-id",
};
const photo = () => new File(["photo bytes"], "proof.jpg", { type: "image/jpeg" });
const repository = () => {
  const durable = new Map<string, File[]>();
  return {
    durable,
    load: vi.fn(async (scope: string) => durable.get(scope) ?? []),
    save: vi.fn(async (scope: string, files: File[]) => {
      durable.set(scope, files);
    }),
    clear: vi.fn(async (scope: string) => {
      durable.delete(scope);
    }),
    previewUrls: () => [],
    revoke: () => undefined,
  } satisfies ProofDraftRepository & { durable: Map<string, File[]> };
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const renderSynced = (draftRepository: ProofDraftRepository, strict = false) =>
  renderHook(
    () => {
      const draft = useCommitmentProofDraft({
        chainId: 42161,
        viewer: VIEWER,
        commitmentId: 9n,
        repository: draftRepository,
      });
      const [snapshot, setSnapshot] = useState<Snapshot>({
        words: { ...words, note: "", links: [], credited: null, clientEvidenceId: "new-id" },
        files: { media: [], audioNotes: [] },
      });
      const onRestore = useCallback(
        (files: Snapshot["files"], saved: CommitmentProofDraft | undefined) => {
          setSnapshot({
            files,
            words: saved ?? {
              ...words,
              note: "",
              links: [],
              credited: null,
              clientEvidenceId: "new-id",
            },
          });
        },
        []
      );
      const sync = useProofDraftSync(draft, { queued: false, ...snapshot, onRestore });
      return { draft, sync, snapshot, setSnapshot };
    },
    { reactStrictMode: strict }
  );

beforeEach(() => {
  useCommitmentProofDraftStore.setState({ drafts: {} });
  vi.spyOn(logger, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("useCommitmentProofDraft", () => {
  it("restores after StrictMode tears down and replays its mount effects", async () => {
    const draftRepository = repository();
    const { result } = renderHook(
      () =>
        useCommitmentProofDraft({
          chainId: 42161,
          viewer: VIEWER,
          commitmentId: 9n,
          repository: draftRepository,
        }),
      { reactStrictMode: true }
    );

    await waitFor(() => expect(result.current.isRestored).toBe(true));
    expect(result.current.savedFiles).toEqual({ media: [], audioNotes: [] });
    expect(draftRepository.load).toHaveBeenCalledTimes(2);
  });

  it("keeps a rejected read recoverable without overwriting saved words or files", async () => {
    const draftRepository = repository();
    const image = photo();
    const audio = new File(["voice bytes"], "voice.webm", { type: "audio/webm" });
    draftRepository.durable.set(key(), [image, audio]);
    useCommitmentProofDraftStore.getState().saveDraft(key(), words);
    draftRepository.load.mockRejectedValueOnce(new Error("read denied"));
    const { result } = renderSynced(draftRepository);

    await waitFor(() => expect(result.current.draft.restoration).toBe("failed"));
    expect(result.current.sync.isRestored).toBe(false);
    expect(draftRepository.save).not.toHaveBeenCalled();
    expect(useCommitmentProofDraftStore.getState().drafts[key()]).toMatchObject(words);
    await act(async () =>
      expect(await result.current.draft.saveSnapshot(result.current.snapshot)).toBe(false)
    );
    expect(draftRepository.save).not.toHaveBeenCalled();

    act(() => result.current.draft.retryRestore());
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    expect(result.current.snapshot).toEqual({
      words: expect.objectContaining(words),
      files: { media: [image], audioNotes: [audio] },
    });
    expect(await result.current.snapshot.files.media[0].text()).toBe("photo bytes");
    expect(await result.current.snapshot.files.audioNotes[0].text()).toBe("voice bytes");
    expect(draftRepository.load).toHaveBeenCalledTimes(2);
    expect(draftRepository.save).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Proof draft restoration failed", {
      source: "useCommitmentProofDraft",
      errorName: "Error",
    });
  });

  it("hides old-key state immediately and ignores a delayed old-key read", async () => {
    const old = deferred<File[]>();
    const draftRepository = repository();
    const current = photo();
    draftRepository.load.mockImplementation(async (scope) =>
      scope === key() ? old.promise : [current]
    );
    const { result, rerender } = renderHook(
      ({ id }) =>
        useCommitmentProofDraft({
          chainId: 42161,
          viewer: VIEWER,
          commitmentId: id,
          repository: draftRepository,
        }),
      { initialProps: { id: 9n as bigint | null } }
    );
    rerender({ id: 10n });
    expect(result.current.savedFiles).toBeNull();
    expect(result.current.isRestored).toBe(false);
    await waitFor(() => expect(result.current.isRestored).toBe(true));
    await act(async () => old.resolve([new File(["old"], "old.jpg")]));
    expect(result.current.savedFiles?.media).toEqual([current]);
    rerender({ id: null });
    expect(result.current.savedFiles).toBeNull();
    expect(result.current.isRestored).toBe(false);
  });

  it("does not let an old-key retry or save callback act on a new key", async () => {
    const draftRepository = repository();
    draftRepository.load.mockRejectedValueOnce(new Error("read denied"));
    const { result, rerender } = renderHook(
      ({ id }) =>
        useCommitmentProofDraft({
          chainId: 42161,
          viewer: VIEWER,
          commitmentId: id,
          repository: draftRepository,
        }),
      { initialProps: { id: 9n } }
    );
    await waitFor(() => expect(result.current.restoration).toBe("failed"));
    const retry = result.current.retryRestore;
    const staleSave = result.current.saveSnapshot;
    rerender({ id: 10n });
    await waitFor(() => expect(result.current.isRestored).toBe(true));
    const staleReadySave = result.current.saveSnapshot;
    rerender({ id: 11n });
    await waitFor(() => expect(result.current.isRestored).toBe(true));
    act(() => retry());
    await act(async () =>
      expect(await staleSave({ words, files: { media: [photo()], audioNotes: [] } })).toBe(false)
    );
    await act(async () =>
      expect(await staleReadySave({ words, files: { media: [photo()], audioNotes: [] } })).toBe(
        false
      )
    );
    expect(draftRepository.load).toHaveBeenCalledTimes(3);
    expect(draftRepository.save).not.toHaveBeenCalled();
    expect(result.current.key).toBe(key(11n));
  });

  it("retains current media and prior durable counts on failure, then saves the latest snapshot", async () => {
    const draftRepository = repository();
    const original = photo();
    draftRepository.durable.set(key(), [original]);
    useCommitmentProofDraftStore.getState().saveDraft(key(), words);
    useCommitmentProofDraftStore
      .getState()
      .recordFiles(key(), { photos: 1, videos: 0, voiceNotes: 0 });
    const { result } = renderSynced(draftRepository);
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    const unsaved = new File(["new"], "new.jpg", { type: "image/jpeg" });
    draftRepository.save.mockRejectedValueOnce(new DOMException("quota", "QuotaExceededError"));
    act(() =>
      result.current.setSnapshot((snapshot) => ({
        ...snapshot,
        files: { media: [original, unsaved], audioNotes: [] },
      }))
    );
    await waitFor(() => expect(result.current.sync.persistence).toBe("failed"));
    expect(result.current.snapshot.files.media).toEqual([original, unsaved]);
    expect(draftRepository.durable.get(key())).toEqual([original]);
    expect(useCommitmentProofDraftStore.getState().drafts[key()].files?.photos).toBe(1);

    act(() => result.current.sync.retrySave());
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    expect(draftRepository.durable.get(key())).toEqual([original, unsaved]);
    expect(useCommitmentProofDraftStore.getState().drafts[key()].files?.photos).toBe(2);
    expect(result.current.snapshot.words.clientEvidenceId).toBe("saved-evidence-id");
    expect(draftRepository.load).toHaveBeenCalledTimes(1);
  });

  it("an older attachment save cannot clear a newer failure", async () => {
    const draftRepository = repository();
    const { result } = renderSynced(draftRepository);
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    const oldSave = deferred<void>();
    // Adversarial completion order is stronger than the production repository's
    // serial writes: a stale result still cannot publish latest-snapshot durability.
    draftRepository.save
      .mockImplementationOnce(() => oldSave.promise)
      .mockRejectedValueOnce(new Error("latest save failed"));
    act(() =>
      result.current.setSnapshot((snapshot) => ({
        ...snapshot,
        files: { media: [photo()], audioNotes: [] },
      }))
    );
    await waitFor(() => expect(draftRepository.save).toHaveBeenCalledTimes(1));
    const latest = new File(["latest"], "latest.jpg", { type: "image/jpeg" });
    act(() =>
      result.current.setSnapshot((snapshot) => ({
        ...snapshot,
        files: { media: [latest], audioNotes: [] },
      }))
    );
    await waitFor(() => expect(result.current.sync.persistence).toBe("failed"));
    await act(async () => oldSave.resolve());
    expect(result.current.sync.persistence).toBe("failed");
    expect(result.current.snapshot.files.media).toEqual([latest]);
    act(() => result.current.sync.retrySave());
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    expect(draftRepository.save).toHaveBeenLastCalledWith(key(), [latest]);
  });

  it("ignores a save completion after unmount rather than publishing its counts", async () => {
    const draftRepository = repository();
    const { result, unmount } = renderSynced(draftRepository);
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    const write = deferred<void>();
    draftRepository.save.mockImplementationOnce(() => write.promise);
    act(() =>
      result.current.setSnapshot((snapshot) => ({
        ...snapshot,
        files: { media: [photo()], audioNotes: [] },
      }))
    );
    await waitFor(() => expect(draftRepository.save).toHaveBeenCalledTimes(1));
    const before = useCommitmentProofDraftStore.getState().drafts[key()];
    unmount();
    await act(async () => write.resolve());
    expect(useCommitmentProofDraftStore.getState().drafts[key()]).toEqual(before);
  });

  it("does not claim full durability when words storage fails after attachments succeed", async () => {
    const draftRepository = repository();
    const { result } = renderSynced(draftRepository);
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    const persistedBefore = localStorage.getItem("gg-commitment-proof-drafts");
    const storage = useCommitmentProofDraftStore.persist.getOptions().storage!;
    const write = vi.spyOn(storage, "setItem").mockImplementationOnce(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const image = photo();
    act(() =>
      result.current.setSnapshot((snapshot) => ({
        words: { ...snapshot.words, note: "New words" },
        files: { media: [image], audioNotes: [] },
      }))
    );
    await waitFor(() => expect(result.current.sync.persistence).toBe("failed"));
    expect(draftRepository.durable.get(key())).toEqual([image]);
    expect(localStorage.getItem("gg-commitment-proof-drafts")).toBe(persistedBefore);
    expect(result.current.snapshot.words.note).toBe("New words");
    write.mockRestore();
    act(() => result.current.sync.retrySave());
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    expect(
      JSON.parse(localStorage.getItem("gg-commitment-proof-drafts")!).state.drafts[key()]
    ).toMatchObject({ note: "New words", files: { photos: 1 } });
    expect(draftRepository.load).toHaveBeenCalledTimes(1);
  });

  it("keeps unavailable words restoration visible until same-key retry succeeds", async () => {
    const draftRepository = repository();
    useCommitmentProofDraftStore.getState().saveDraft(key(), words);
    const hydration = vi
      .spyOn(useCommitmentProofDraftStore.persist, "hasHydrated")
      .mockReturnValue(false);
    const { result } = renderSynced(draftRepository);
    await waitFor(() => expect(result.current.draft.restoration).toBe("failed"));
    expect(draftRepository.load).not.toHaveBeenCalled();
    expect(draftRepository.save).not.toHaveBeenCalled();
    expect(useCommitmentProofDraftStore.getState().drafts[key()]).toMatchObject(words);
    hydration.mockRestore();
    act(() => result.current.draft.retryRestore());
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    expect(result.current.snapshot.words).toMatchObject(words);
  });

  it("ignores old-key save completion without changing the new-key status or metadata", async () => {
    const draftRepository = repository();
    const { result, rerender } = renderHook(
      ({ id }) =>
        useCommitmentProofDraft({
          chainId: 42161,
          viewer: VIEWER,
          commitmentId: id,
          repository: draftRepository,
        }),
      { initialProps: { id: 9n } }
    );
    await waitFor(() => expect(result.current.isRestored).toBe(true));
    const write = deferred<void>();
    draftRepository.save.mockImplementationOnce(() => write.promise);
    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.saveSnapshot({ words, files: { media: [photo()], audioNotes: [] } });
    });
    rerender({ id: 10n });
    await waitFor(() => expect(result.current.isRestored).toBe(true));
    await act(async () => {
      write.resolve();
      expect(await pending).toBe(false);
    });
    expect(result.current.key).toBe(key(10n));
    expect(result.current.persistence).toBeNull();
    expect(useCommitmentProofDraftStore.getState().drafts[key()]).toBeUndefined();
    expect(useCommitmentProofDraftStore.getState().drafts[key(10n)]).toBeUndefined();
  });

  it("a captured admission clear cannot delete a newer proof identity under the same key", async () => {
    const draftRepository = repository();
    useCommitmentProofDraftStore.getState().saveDraft(key(), words);
    const { result } = renderSynced(draftRepository);
    await waitFor(() => expect(result.current.sync.persistence).toBe("saved"));
    const clearAdmittedDraft = result.current.draft.clear;
    act(() =>
      useCommitmentProofDraftStore
        .getState()
        .saveDraft(key(), { ...words, note: "New proof", clientEvidenceId: "replacement-id" })
    );
    await act(async () => {
      await clearAdmittedDraft();
    });
    expect(useCommitmentProofDraftStore.getState().drafts[key()].clientEvidenceId).toBe(
      "replacement-id"
    );
    expect(draftRepository.clear).not.toHaveBeenCalled();
  });
});
