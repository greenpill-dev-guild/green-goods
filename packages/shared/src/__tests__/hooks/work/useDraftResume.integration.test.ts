/**
 * Start Fresh on a saved work draft, against the real draft store.
 * @vitest-environment happy-dom
 *
 * The resume prompt, autosave and the IndexedDB store run together here, because what Start Fresh
 * promises is only visible across them: the saved draft's record and media stay as they were from
 * the moment the prompt opens, and the next save gets a record of its own.
 */
import { act, cleanup, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDraftAutoSave } from "../../../hooks/work/useDraftAutoSave";
import { useDraftResume } from "../../../hooks/work/useDraftResume";
import {
  parseWorkLinkIntent,
  toDraftWorkLink,
  writeWorkLinkIntent,
} from "../../../modules/commitment-pooling/work-link-intent";
import { draftDB } from "../../../modules/job-queue/draft-db";
import { queueDraftWrite } from "../../../modules/work/draft-lifecycle";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const GARDEN = "0x5eed000000000000000000000000000000000001";
const CHAIN = 11155111;
const PROMISE = {
  commitmentId: "12",
  requirementIndex: 0,
  actionUID: 5,
  garden: GARDEN,
  commitmentTitle: "Transplant 36 seedlings into the east beds",
  requirementLabel: "Seedling Transplant · 36 plants",
  returnTo: `/home/${GARDEN}/commitments/12`,
} as const;
/** Submit Work opened for a different promise than the saved draft's. */
const ANOTHER_PROMISE_PAGE = writeWorkLinkIntent(new URLSearchParams(), {
  ...PROMISE,
  commitmentId: 9n,
  commitmentTitle: "Repair the north fence panel",
  returnTo: `/home/${GARDEN}/commitments/9`,
}).toString();

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ primaryAddress: ACCOUNT }),
}));
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({ useCurrentChain: () => CHAIN }));

/**
 * The wizard's draft wiring, as the Submit Work controller composes it: the address is live, so
 * a promise written into it is the promise the next save carries. `strict` mounts it as the app's
 * development build does, where the first load is interrupted and run again.
 */
function openWizard(query = "", { strict = false } = {}) {
  const setSearchParams = vi.fn();
  const restoreForm = vi.fn();
  const view = renderHookWithQueryClient(
    () => {
      const [searchParams, applySearchParams] = useState(() => new URLSearchParams(query));
      setSearchParams.mockImplementation((next: URLSearchParams) => applySearchParams(next));
      const promise = parseWorkLinkIntent(searchParams);
      const linkIntent = promise ? toDraftWorkLink(promise) : undefined;
      return useWizard({ searchParams, setSearchParams, restoreForm, linkIntent });
    },
    { reactStrictMode: strict }
  );
  return { ...view, setSearchParams, restoreForm };
}

function useWizard({
  searchParams,
  setSearchParams,
  restoreForm,
  linkIntent,
}: {
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
  restoreForm: () => void;
  linkIntent: ReturnType<typeof toDraftWorkLink> | undefined;
}) {
  const resume = useDraftResume({
    formState: {
      images: [],
      gardenAddress: null,
      actionUID: null,
      feedback: "",
      timeSpentMinutes: 0,
    },
    isOnIntroTab: true,
    searchParams,
    setSearchParams,
    restoreForm,
  });
  const gardenAddress = useWorkFlowStore((state) => state.gardenAddress);
  const actionUID = useWorkFlowStore((state) => state.actionUID);
  const feedback = useWorkFlowStore((state) => state.feedback);
  const details = useWorkFlowStore((state) => state.details);
  const images = useWorkFlowStore((state) => state.images);
  const { saveOnExit } = useDraftAutoSave(
    { gardenAddress, actionUID, feedback, details, linkIntent },
    images,
    { enabled: !resume.legacyRecovery }
  );
  return { ...resume, saveOnExit };
}

/** A saved draft with a photo and a promise, left as the wizard's active draft. */
async function saveDraftWithPhoto() {
  return draftDB.saveSnapshot(
    ACCOUNT,
    CHAIN,
    "old",
    {
      gardenAddress: GARDEN,
      actionUID: 5,
      feedback: "mulched the east beds",
      linkIntent: PROMISE,
    },
    [new File(["photo-bytes"], "beds.jpg", { type: "image/jpeg" })],
    []
  );
}

/** The open prompt, after any save the arrival could have started has had time to land. */
async function openOnSavedDraft(query = "", options?: { strict?: boolean }) {
  const wizard = openWizard(query, options);
  await waitFor(() => expect(wizard.result.current.showDraftSheet).toBe(true));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  await queueDraftWrite(async () => undefined);
  return wizard;
}

async function fillDraftSlots(count: number) {
  for (let index = 0; index < count; index++)
    await draftDB.saveSnapshot(ACCOUNT, CHAIN, `slot-${index}`, { feedback: "saved" }, [], []);
}

beforeEach(() => {
  useWorkFlowStore.getState().reset();
  useWorkFlowStore.setState({ draftScope: null, draftHydrated: false });
});
afterEach(async () => {
  cleanup();
  // An unmounting wizard flushes its draft; let that land before the records go.
  await queueDraftWrite(async () => undefined);
  for (const draft of await draftDB.getDraftsForUser(ACCOUNT, CHAIN))
    await draftDB.deleteDraft(draft.id);
  await draftDB.setActiveDraft(ACCOUNT, CHAIN, null);
});

describe("Start Fresh on a saved work draft", () => {
  it("keeps the saved draft and gives the next save a record of its own", async () => {
    const saved = await saveDraftWithPhoto();
    const photos = await draftDB.getImagesForDraft("old");
    const { result, setSearchParams, restoreForm } = await openOnSavedDraft();
    // Nothing is written to the draft while its prompt is open.
    expect(await result.current.saveOnExit()).toBeNull();
    expect(await draftDB.getDraft("old")).toEqual(saved);

    await act(async () => {
      await result.current.handleStartFresh();
    });

    expect(result.current.showDraftSheet).toBe(false);
    expect(useWorkFlowStore.getState()).toMatchObject({
      activeDraftId: null,
      gardenAddress: null,
      feedback: "",
      images: [],
    });
    expect(restoreForm).toHaveBeenLastCalledWith({ feedback: "" });
    // The promise came back with the old draft, so it leaves the page with it.
    const params = setSearchParams.mock.lastCall?.[0] as URLSearchParams;
    expect(params.get("linkCommitmentId")).toBeNull();
    expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBeNull();

    act(() => useWorkFlowStore.getState().setFeedback("pruned the hedge"));
    let next!: string | null;
    await act(async () => {
      next = await result.current.saveOnExit();
    });
    const fresh = next as string;

    expect(fresh).toEqual(expect.any(String));
    expect(fresh).not.toBe("old");
    const started = await draftDB.getDraft(fresh);
    expect(started).toMatchObject({ feedback: "pruned the hedge" });
    expect(started?.linkIntent).toBeUndefined();
    expect(await draftDB.getImagesForDraft(fresh)).toEqual([]);
    expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBe(fresh);
    expect(await draftDB.getDraftCount(ACCOUNT, CHAIN)).toBe(2);
    expect(await draftDB.getDraft("old")).toEqual(saved);
    expect((await draftDB.getImagesForDraft("old")).map((photo) => photo.id)).toEqual(
      photos.map((photo) => photo.id)
    );
  });

  it("leaves the saved draft its own promise when the page was opened for another", async () => {
    const saved = await saveDraftWithPhoto();
    const { result, setSearchParams } = await openOnSavedDraft(ANOTHER_PROMISE_PAGE);

    await act(async () => {
      await result.current.handleStartFresh();
    });

    // The page's promise was never written onto the draft that was set aside.
    expect(await draftDB.getDraft("old")).toEqual(saved);
    // The page keeps the promise it was opened for, and the new work is saved for it.
    expect(setSearchParams).not.toHaveBeenCalled();
    act(() => useWorkFlowStore.getState().setFeedback("reset the fence posts"));
    let next!: string | null;
    await act(async () => {
      next = await result.current.saveOnExit();
    });
    expect((await draftDB.getDraft(next as string))?.linkIntent?.commitmentId).toBe("9");
    expect((await draftDB.getDraft("old"))?.linkIntent?.commitmentId).toBe("12");
  });

  it("asks again when the person left with the prompt unanswered", async () => {
    const saved = await saveDraftWithPhoto();
    // Back out of Submit Work with the prompt still open: nothing was chosen.
    (await openOnSavedDraft()).unmount();
    await queueDraftWrite(async () => undefined);

    // The next visit, in the same session, is for another promise. It asks again, and the
    // draft is not carried on and saved for that promise meanwhile.
    const { result } = await openOnSavedDraft(ANOTHER_PROMISE_PAGE);

    expect(result.current.showDraftSheet).toBe(true);
    expect(await result.current.saveOnExit()).toBeNull();
    expect(await draftDB.getDraft("old")).toEqual(saved);
  });

  it("resumes the saved draft later from Your Work, with its media", async () => {
    await saveDraftWithPhoto();
    const first = await openOnSavedDraft();
    await act(async () => {
      await first.result.current.handleStartFresh();
    });
    first.unmount();

    const { result, setSearchParams } = openWizard("draftId=old");
    await waitFor(() =>
      expect(useWorkFlowStore.getState()).toMatchObject({
        draftHydrated: true,
        activeDraftId: "old",
      })
    );

    const state = useWorkFlowStore.getState();
    expect(state).toMatchObject({
      activeDraftId: "old",
      gardenAddress: GARDEN,
      actionUID: 5,
      feedback: "mulched the east beds",
    });
    expect(state.images.map((photo) => photo.name)).toEqual(["beds.jpg"]);
    expect(await state.images[0].text()).toBe("photo-bytes");
    // Opened by name, the draft comes straight back, promise included, without the prompt.
    expect(result.current.showDraftSheet).toBe(false);
    const params = setSearchParams.mock.lastCall?.[0] as URLSearchParams;
    expect(params.get("linkCommitmentId")).toBe("12");
    expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBe("old");
  });

  it("says every draft slot is taken instead of deleting anything", async () => {
    await fillDraftSlots(19);
    await saveDraftWithPhoto();
    const { result } = await openOnSavedDraft();
    const saved = await draftDB.getDraft("old");

    await act(async () => {
      await expect(result.current.handleStartFresh()).rejects.toThrow("draft-limit");
    });

    expect(await draftDB.getDraftCount(ACCOUNT, CHAIN)).toBe(20);
    expect(await draftDB.getDraft("old")).toEqual(saved);
    expect(await draftDB.getImagesForDraft("old")).toHaveLength(1);
    expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBe("old");
    // The wizard still holds the draft, and the prompt stays up to say why.
    expect(result.current.showDraftSheet).toBe(true);
    expect(useWorkFlowStore.getState()).toMatchObject({
      activeDraftId: "old",
      feedback: "mulched the east beds",
      draftDeleting: false,
    });
    expect(useWorkFlowStore.getState().images).toHaveLength(1);
  });

  it("asks again once the person has made room in Your Work", async () => {
    await fillDraftSlots(19);
    await saveDraftWithPhoto();
    const first = await openOnSavedDraft();
    await act(async () => {
      await expect(first.result.current.handleStartFresh()).rejects.toThrow("draft-limit");
    });
    // Manage drafts leaves with the prompt unanswered; a draft is discarded in Your Work. The
    // address holds the draft's own promise, so Back must not return to it.
    let draftsPromiseInAddress = false;
    act(() => {
      draftsPromiseInAddress = first.result.current.askAgainNextVisit();
    });
    expect(draftsPromiseInAddress).toBe(true);
    first.unmount();
    await queueDraftWrite(async () => undefined);
    await draftDB.deleteDraft("slot-0");

    const { result, setSearchParams } = await openOnSavedDraft();
    await act(async () => {
      await result.current.handleStartFresh();
    });

    expect(useWorkFlowStore.getState().activeDraftId).toBeNull();
    expect(await draftDB.getDraftCount(ACCOUNT, CHAIN)).toBe(19);
    expect(await draftDB.getImagesForDraft("old")).toHaveLength(1);
    // The draft's promise came back with it and left with it again.
    const params = setSearchParams.mock.lastCall?.[0] as URLSearchParams;
    expect(setSearchParams).toHaveBeenCalledTimes(2);
    expect(params.get("linkCommitmentId")).toBeNull();
  });

  it("comes back for the promise its page was opened for after making room", async () => {
    await fillDraftSlots(19);
    await saveDraftWithPhoto();
    const first = await openOnSavedDraft(ANOTHER_PROMISE_PAGE);
    await act(async () => {
      await expect(first.result.current.handleStartFresh()).rejects.toThrow("draft-limit");
    });
    // The address is the page's own, so Back may return to it.
    let draftsPromiseInAddress = true;
    act(() => {
      draftsPromiseInAddress = first.result.current.askAgainNextVisit();
    });
    expect(draftsPromiseInAddress).toBe(false);
    first.unmount();
    await queueDraftWrite(async () => undefined);
    await draftDB.deleteDraft("slot-0");

    // Back through the Garden tab, whose address names no promise. Mounted as the development
    // build mounts it, the first load is interrupted and must not spend the promise.
    const { result, setSearchParams } = await openOnSavedDraft("", { strict: true });
    const restored = setSearchParams.mock.lastCall?.[0] as URLSearchParams;
    expect(restored.get("linkCommitmentId")).toBe("9");
    await act(async () => {
      await result.current.handleStartFresh();
    });

    // It is the page's promise, so Start Fresh leaves it, and the draft set aside keeps its own.
    expect(setSearchParams).toHaveBeenCalledOnce();
    expect((await draftDB.getDraft("old"))?.linkIntent?.commitmentId).toBe("12");
    act(() => useWorkFlowStore.getState().setFeedback("reset the fence posts"));
    let next!: string | null;
    await act(async () => {
      next = await result.current.saveOnExit();
    });
    expect((await draftDB.getDraft(next as string))?.linkIntent?.commitmentId).toBe("9");
    // It was for that one visit: a later one starts without it.
    expect(useWorkFlowStore.getState().draftPagePromise).toBeNull();
  });

  it("lets go of the draft only after a save still writing has finished", async () => {
    await saveDraftWithPhoto();
    const { result } = await openOnSavedDraft();
    let finishSave!: () => void;
    const saving = queueDraftWrite(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        })
    );

    const fresh = result.current.handleStartFresh();
    try {
      await waitFor(() => expect(useWorkFlowStore.getState().draftDeleting).toBe(true));
      // Behind the save, nothing has let go yet: that save could still name the draft as active.
      expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBe("old");
      expect(useWorkFlowStore.getState().activeDraftId).toBe("old");
    } finally {
      finishSave();
      await saving;
      await act(async () => {
        await fresh;
      });
    }
    expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBeNull();
    expect(useWorkFlowStore.getState().activeDraftId).toBeNull();
    expect(await draftDB.getImagesForDraft("old")).toHaveLength(1);
  });
});
