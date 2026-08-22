/** @vitest-environment jsdom */

/**
 * The composer's draft: what a member typed, kept on this device until they
 * place it or throw it away.
 *
 * A draft is keyed by who is composing, in which garden, through which door,
 * so two gardens never share one and a request never resumes into an offer.
 * It carries its clientCommitmentId with it: the queue derives the creation
 * key from that id, and a draft resumed after a restart must keep the one it
 * started with rather than minting a second.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  COMMITMENT_COMPOSER_DRAFT_STORAGE_KEY,
  commitmentComposerDraftKey,
  useCommitmentComposerDraftStore,
} from "../stores/useCommitmentComposerDraftStore";

const VIEWER = "0x1111111111111111111111111111111111111111";
const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const key = commitmentComposerDraftKey({
  chainId: 42161,
  viewer: VIEWER,
  garden: GARDEN,
  direction: "OFFER",
});

describe("useCommitmentComposerDraftStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCommitmentComposerDraftStore.setState({ drafts: {} });
  });

  it("keeps one draft per member, garden and door", () => {
    const other = commitmentComposerDraftKey({
      chainId: 42161,
      viewer: VIEWER,
      garden: GARDEN,
      direction: "REQUEST",
    });
    expect(other).not.toBe(key);
    expect(
      commitmentComposerDraftKey({
        chainId: 42161,
        viewer: VIEWER.toUpperCase(),
        garden: GARDEN,
        direction: "OFFER",
      })
    ).toBe(key);
  });

  it("saves a draft with its client id and reads it back", () => {
    const store = useCommitmentComposerDraftStore.getState();
    store.saveDraft(key, { values: { title: "Prune" }, clientCommitmentId: "draft-1" }, 1000);

    const draft = useCommitmentComposerDraftStore.getState().drafts[key];
    expect(draft).toEqual({
      values: { title: "Prune" },
      clientCommitmentId: "draft-1",
      updatedAt: 1000,
    });
  });

  it("keeps the same client id across saves, so a resumed draft keeps its creation key", () => {
    const store = useCommitmentComposerDraftStore.getState();
    store.saveDraft(key, { values: { title: "Prune" }, clientCommitmentId: "draft-1" }, 1000);
    store.saveDraft(key, { values: { title: "Prune more" }, clientCommitmentId: "draft-1" }, 2000);

    expect(useCommitmentComposerDraftStore.getState().drafts[key]?.clientCommitmentId).toBe(
      "draft-1"
    );
    expect(useCommitmentComposerDraftStore.getState().drafts[key]?.updatedAt).toBe(2000);
  });

  it("forgets a draft once it is placed or discarded", () => {
    const store = useCommitmentComposerDraftStore.getState();
    store.saveDraft(key, { values: { title: "Prune" }, clientCommitmentId: "draft-1" }, 1000);
    store.clearDraft(key);

    expect(useCommitmentComposerDraftStore.getState().drafts[key]).toBeUndefined();
  });

  it("persists to this device", () => {
    useCommitmentComposerDraftStore
      .getState()
      .saveDraft(key, { values: { title: "Prune" }, clientCommitmentId: "draft-1" }, 1000);

    const raw = window.localStorage.getItem(COMMITMENT_COMPOSER_DRAFT_STORAGE_KEY);
    expect(raw).toContain("draft-1");
  });
});
