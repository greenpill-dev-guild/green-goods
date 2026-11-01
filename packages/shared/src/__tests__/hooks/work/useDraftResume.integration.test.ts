/**
 * Start Fresh on a saved work draft, against the real draft store.
 * @vitest-environment happy-dom
 *
 * The resume prompt, autosave and the IndexedDB store run together here, because what Start Fresh
 * promises is only visible across them: the saved draft's record and media stay as they were from
 * the moment the prompt opens, and the next save gets a record of its own. What a Submit leaves to
 * resume is visible the same way, with the work mutation, the upload queue and the draft's
 * retirement composed as Submit Work composes them.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode, useEffect, useState } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { toastService } from "../../../components/Toast/toast.service";
import { useDraftAutoSave } from "../../../hooks/work/useDraftAutoSave";
import { useDraftResume } from "../../../hooks/work/useDraftResume";
import { useDrafts } from "../../../hooks/work/useDrafts";
import { useWorkDraftRetirement } from "../../../hooks/work/useWorkDraftRetirement";
import { useWorkMutation } from "../../../hooks/work/useWorkMutation";
import { useYourWorkCount } from "../../../hooks/work/useYourWorkCount";
import en from "../../../i18n/en.json";
import {
  parseWorkLinkIntent,
  toDraftWorkLink,
  writeWorkLinkIntent,
  type WorkLinkIntent,
} from "../../../modules/commitment-pooling/work-link-intent";
import { jobQueueDB } from "../../../modules/job-queue/db";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import { draftDB } from "../../../modules/job-queue/draft-db";
import type { WorkContent } from "../../../modules/job-queue/draft-state";
import { queueDraftWrite } from "../../../modules/work/draft-lifecycle";
import { WorkSubmissionError } from "../../../modules/work/wallet-submission/types";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import { WorkTab } from "../../../stores/workFlowTypes";
import type { WorkJobPayload } from "../../../types/job-queue";
import { createMockAction, createMockWorkDraft } from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";
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
// The Your Work badge reads the real drafts and queue; which garden is active is its edge.
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({ usePrimaryAddress: () => ACCOUNT }));
vi.mock("../../../hooks/garden/useActiveGarden", () => ({
  useActiveGarden: () => ({ inScope: () => true }),
}));
// Submit's queue and drafts share one chain, as they do in the app.
vi.mock("../../../config/default-chain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/default-chain")>()),
  DEFAULT_CHAIN_ID: 11155111,
}));
// A wallet account; what the wallet does with a send is each Submit test's call.
const wallet = vi.hoisted(() => ({
  send: vi.fn(),
  sender: {
    authMode: "wallet" as const,
    supportsBatching: false,
    supportsSponsorship: false,
    sendContractCall: async () => ({ hash: "0x" as const, sponsored: false }),
  },
}));
vi.mock("../../../hooks/blockchain/useTransactionSender", () => ({
  useTransactionSender: () => wallet.sender,
}));
vi.mock("../../../modules/work/wallet-submission", () => ({
  submitWorkDirectly: wallet.send,
}));

/**
 * The wizard's draft wiring, as the Submit Work controller composes it: the address is live, so
 * a promise written into it is the promise the next save carries. `strict` mounts it as the app's
 * development build does, where the first load is interrupted and run again.
 */
/** A hook with what the app gives autosave: queries, and the words its failure toast reads. */
function renderInApp<TResult>(hook: () => TResult, options: { reactStrictMode?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      IntlProvider,
      { locale: "en", messages: en },
      createElement(QueryClientProvider, { client: queryClient }, children)
    );
  return renderHook(hook, { ...options, wrapper });
}

function openWizard(
  query = "",
  { strict = false, work }: { strict?: boolean; work?: WorkContent } = {}
) {
  const setSearchParams = vi.fn();
  const restoreForm = vi.fn();
  const view = renderInApp(
    () => {
      const [searchParams, applySearchParams] = useState(() => new URLSearchParams(query));
      setSearchParams.mockImplementation((next: URLSearchParams) => applySearchParams(next));
      const promise = parseWorkLinkIntent(searchParams);
      const linkIntent = promise ? toDraftWorkLink(promise) : undefined;
      return useWizard({ searchParams, setSearchParams, restoreForm, work, linkIntent });
    },
    { reactStrictMode: strict }
  );
  return { ...view, setSearchParams, restoreForm };
}

function useWizard({
  searchParams,
  setSearchParams,
  restoreForm,
  work,
  linkIntent,
}: {
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
  restoreForm: () => void;
  work?: WorkContent;
  linkIntent: ReturnType<typeof toDraftWorkLink> | undefined;
}) {
  const resume = useDraftResume({
    searchParams,
    setSearchParams,
    restoreForm,
    work,
  });
  const gardenAddress = useWorkFlowStore((state) => state.gardenAddress);
  const actionUID = useWorkFlowStore((state) => state.actionUID);
  const feedback = useWorkFlowStore((state) => state.feedback);
  const details = useWorkFlowStore((state) => state.details);
  const images = useWorkFlowStore((state) => state.images);
  const { saveOnExit } = useDraftAutoSave(
    { gardenAddress, actionUID, feedback, details, linkIntent },
    images,
    { enabled: !resume.legacyRecovery && !resume.isResumingFromUrl }
  );
  useEffect(() => {
    const intent = parseWorkLinkIntent(searchParams);
    if (resume.isResumingFromUrl || !intent) return;
    useWorkFlowStore.getState().setGardenAddress(intent.garden);
    useWorkFlowStore.getState().setActionUID(intent.actionUID);
  }, [searchParams, resume.isResumingFromUrl]);
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
  vi.restoreAllMocks();
  // An unmounting wizard flushes its draft; let that land before the records go.
  await queueDraftWrite(async () => undefined);
  for (const draft of await draftDB.getDraftsForUser(ACCOUNT, CHAIN))
    await draftDB.deleteDraft(draft.id);
  await draftDB.setActiveDraft(ACCOUNT, CHAIN, null);
  for (const job of await jobQueueDB.getJobs({ userAddress: ACCOUNT }))
    await jobQueueDB.deleteJob(job.id);
});

describe("a flow with nothing in it (DL-148)", () => {
  /** One action tile tapped on Start, which moves the flow on to Media. */
  const tapActionTile = () =>
    act(() => {
      const store = useWorkFlowStore.getState();
      store.setGardenAddress(GARDEN);
      store.setActionUID(5);
      store.setActiveTab(WorkTab.Media);
    });
  const openedWizard = async (options?: Parameters<typeof openWizard>[1]) => {
    const wizard = openWizard("", options);
    await waitFor(() => expect(wizard.result.current.isResumingFromUrl).toBe(false));
    return wizard;
  };
  const leave = async (wizard: { unmount: () => void }) => {
    wizard.unmount();
    await queueDraftWrite(async () => undefined);
  };
  /** The Your Work badge, and whether the draft list behind it has answered. */
  const countYourWork = () =>
    renderHookWithQueryClient(() => ({
      count: useYourWorkCount().count,
      answered: !useDrafts().isLoading,
    }));

  it("leaves no draft and no badge after a tile is tapped, and the next visit starts over", async () => {
    const first = await openedWizard();
    tapActionTile();
    expect(await first.result.current.saveOnExit()).toBeNull();
    await leave(first);

    expect(await draftDB.getDraftsForUser(ACCOUNT, CHAIN)).toEqual([]);
    expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBeNull();
    const badge = countYourWork();
    await waitFor(() => expect(badge.result.current.answered).toBe(true));
    expect(badge.result.current.count).toBe(0);

    const next = await openedWizard();
    expect(useWorkFlowStore.getState()).toMatchObject({
      gardenAddress: null,
      actionUID: null,
      activeTab: WorkTab.Intro,
      activeDraftId: null,
    });
    expect(next.restoreForm).toHaveBeenLastCalledWith({ feedback: "" });
  });

  it("leaves no draft after a promise's page is opened and left", async () => {
    const wizard = openWizard(ANOTHER_PROMISE_PAGE);
    await waitFor(() => expect(useWorkFlowStore.getState().actionUID).toBe(PROMISE.actionUID));
    expect(await wizard.result.current.saveOnExit()).toBeNull();
    await leave(wizard);

    expect(await draftDB.getDraftsForUser(ACCOUNT, CHAIN)).toEqual([]);
  });

  it("keeps the same flow as a draft once it holds a photo, counted and back on the next visit", async () => {
    const first = await openedWizard();
    tapActionTile();
    act(() =>
      useWorkFlowStore
        .getState()
        .setImages([new File(["photo-bytes"], "beds.jpg", { type: "image/jpeg" })])
    );
    let draftId!: string | null;
    await act(async () => {
      draftId = await first.result.current.saveOnExit();
    });
    await leave(first);

    expect(await draftDB.getDraft(draftId as string)).toMatchObject({
      gardenAddress: GARDEN,
      actionUID: 5,
    });
    const badge = countYourWork();
    await waitFor(() => expect(badge.result.current.count).toBe(1));

    const next = await openedWizard();
    expect(useWorkFlowStore.getState()).toMatchObject({
      activeDraftId: draftId,
      gardenAddress: GARDEN,
      actionUID: 5,
      activeTab: WorkTab.Media,
    });
    expect(next.restoreForm).not.toHaveBeenCalled();
  });

  it("takes a draft away once it is emptied and left, and only then", async () => {
    const wizard = await openedWizard();
    tapActionTile();
    act(() =>
      useWorkFlowStore
        .getState()
        .setImages([new File(["photo-bytes"], "beds.jpg", { type: "image/jpeg" })])
    );
    let draftId!: string | null;
    await act(async () => {
      draftId = await wizard.result.current.saveOnExit();
    });

    // Swapping the only photo is not leaving: the draft stays while the flow is open.
    act(() => useWorkFlowStore.getState().setImages([]));
    await act(async () => {
      expect(await wizard.result.current.saveOnExit()).toBe(draftId);
    });
    expect(await draftDB.getDraft(draftId as string)).toBeDefined();

    await leave(wizard);
    expect(await draftDB.getDraft(draftId as string)).toBeUndefined();
    expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBeNull();
    expect(useWorkFlowStore.getState()).toMatchObject({ activeDraftId: null, actionUID: null });
    const badge = countYourWork();
    await waitFor(() => expect(badge.result.current.answered).toBe(true));
    expect(badge.result.current.count).toBe(0);
  });

  it("lets a member who comes straight back start over while the delete is still writing", async () => {
    const wizard = await openedWizard();
    tapActionTile();
    act(() =>
      useWorkFlowStore
        .getState()
        .setImages([new File(["photo-bytes"], "beds.jpg", { type: "image/jpeg" })])
    );
    let draftId!: string | null;
    await act(async () => {
      draftId = await wizard.result.current.saveOnExit();
    });
    act(() => useWorkFlowStore.getState().setImages([]));
    await act(async () => {
      await wizard.result.current.saveOnExit();
    });

    // A write still running holds the delete behind it.
    let finishWrite!: () => void;
    const writing = queueDraftWrite(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        })
    );
    wizard.unmount();
    expect(useWorkFlowStore.getState()).toMatchObject({ activeDraftId: null, actionUID: null });

    await openedWizard();
    act(() => useWorkFlowStore.getState().setFeedback("Turned the east beds"));
    finishWrite();
    await writing;
    await queueDraftWrite(async () => undefined);

    expect(await draftDB.getDraft(draftId as string)).toBeUndefined();
    expect(useWorkFlowStore.getState().feedback).toBe("Turned the east beds");
  });

  it("says so, with Retry, when an emptied draft cannot be deleted, and Retry finishes it", async () => {
    const wizard = await openedWizard();
    tapActionTile();
    act(() =>
      useWorkFlowStore
        .getState()
        .setImages([new File(["photo-bytes"], "beds.jpg", { type: "image/jpeg" })])
    );
    let draftId!: string | null;
    await act(async () => {
      draftId = await wizard.result.current.saveOnExit();
    });
    act(() => useWorkFlowStore.getState().setImages([]));
    await act(async () => {
      await wizard.result.current.saveOnExit();
    });

    const toast = vi.spyOn(toastService, "error");
    vi.spyOn(draftDB, "deleteDraft").mockRejectedValueOnce(new Error("store unavailable"));
    await leave(wizard);
    await waitFor(() => expect(toast).toHaveBeenCalledOnce());
    const report = toast.mock.calls[0][0];
    expect(report).toMatchObject({
      title: "Delete failed",
      message: "Could not delete the draft. Please try again.",
      action: { label: "Retry" },
    });
    expect(await draftDB.getDraft(draftId as string)).toBeDefined();

    report.action?.onClick();
    await queueDraftWrite(async () => undefined);
    expect(await draftDB.getDraft(draftId as string)).toBeUndefined();
    expect(toast).toHaveBeenCalledOnce();
  });

  it("keeps a draft left with an attachment it could not read", async () => {
    const wizard = await openedWizard();
    act(() => useWorkFlowStore.getState().setFeedback("Turned the east beds"));
    let draftId!: string | null;
    await act(async () => {
      draftId = await wizard.result.current.saveOnExit();
    });
    act(() => {
      useWorkFlowStore.getState().setFeedback("");
      useWorkFlowStore.setState({
        draftMissingAttachments: [{ id: "lost", name: "beds.jpg", order: 0, kind: "media" }],
      });
    });

    await leave(wizard);
    expect(await draftDB.getDraft(draftId as string)).toBeDefined();
  });

  it("does not wipe what the form still holds when no save could take it", async () => {
    // Autosave is off while photos from before an account wait to be recovered, so what the
    // member typed is only in the form.
    const first = await openedWizard();
    tapActionTile();
    await leave(first);

    const next = await openedWizard({
      work: { images: [], audioNotes: [], feedback: "Turned the east beds", details: {} },
    });
    expect(useWorkFlowStore.getState()).toMatchObject({ actionUID: 5, activeTab: WorkTab.Media });
    expect(next.restoreForm).not.toHaveBeenCalled();
  });
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
    const { result, setSearchParams } = openWizard(ANOTHER_PROMISE_PAGE);
    await waitFor(() => expect(result.current.isResumingFromUrl).toBe(false));

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

    // A generic next visit asks again, without silently treating dismissal as Continue.
    const { result } = await openOnSavedDraft();

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
    const first = openWizard(ANOTHER_PROMISE_PAGE);
    await waitFor(() => expect(useWorkFlowStore.getState().draftError).toBe("draft-limit"));
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
    const { result, setSearchParams } = openWizard("", { strict: true });
    await waitFor(() => expect(result.current.isResumingFromUrl).toBe(false));
    const restored = setSearchParams.mock.lastCall?.[0] as URLSearchParams;
    expect(restored.get("linkCommitmentId")).toBe("9");

    // It is the page's promise, and the draft set aside keeps its own.
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

describe("entering work from a promise", () => {
  it.each([
    { name: "cold promise change", warm: false, change: { commitmentId: 9n } },
    { name: "warm promise change", warm: true, change: { commitmentId: 9n } },
    { name: "another requirement", warm: false, change: { requirementIndex: 1 } },
    { name: "another action", warm: false, change: { actionUID: 6 } },
    {
      name: "another garden",
      warm: false,
      change: { garden: "0x1111111111111111111111111111111111111111" as const },
    },
  ])("sets unrelated work aside for $name", async ({ warm, change }) => {
    const saved = await saveDraftWithPhoto();
    if (warm) {
      const previous = await openOnSavedDraft();
      await act(async () => previous.result.current.handleContinueDraft());
      act(() => useWorkFlowStore.getState().setActiveTab(WorkTab.Review));
      previous.unmount();
      await queueDraftWrite(async () => undefined);
    }
    const before = await draftDB.getDraft("old");
    const intent: WorkLinkIntent = { ...PROMISE, commitmentId: 12n, ...change };
    intent.returnTo = `/home/${intent.garden}/commitments/${intent.commitmentId}`;
    const { result } = openWizard(writeWorkLinkIntent(new URLSearchParams(), intent).toString());
    await waitFor(() => expect(result.current.isResumingFromUrl).toBe(false));

    expect(result.current.showDraftSheet).toBe(false);
    expect(useWorkFlowStore.getState()).toMatchObject({
      activeTab: WorkTab.Intro,
      gardenAddress: intent.garden,
      actionUID: intent.actionUID,
      feedback: "",
      images: [],
    });
    act(() => useWorkFlowStore.getState().setFeedback("new fence work"));
    let next!: string | null;
    await act(async () => {
      next = await result.current.saveOnExit();
    });
    expect(next).not.toBe("old");
    if (next === null) throw new Error("Expected a separate saved draft");
    expect(await draftDB.getDraft("old")).toEqual(before ?? saved);
    expect(await draftDB.getImagesForDraft("old")).toHaveLength(1);
    expect(await draftDB.getDraft(next)).toMatchObject({
      gardenAddress: intent.garden,
      actionUID: intent.actionUID,
      feedback: "new fence work",
      linkIntent: {
        commitmentId: intent.commitmentId.toString(),
        requirementIndex: intent.requirementIndex,
      },
    });
    expect(await draftDB.getImagesForDraft(next)).toEqual([]);
  });

  it("waits for an outgoing save before setting aside its draft", async () => {
    await saveDraftWithPhoto();
    let finishSave!: () => void;
    const writing = queueDraftWrite(async () => {
      await new Promise<void>((resolve) => {
        finishSave = resolve;
      });
      await draftDB.updateDraft("old", { feedback: "last edit before leaving" });
    });
    const { result } = openWizard(ANOTHER_PROMISE_PAGE);
    try {
      await waitFor(() => expect(finishSave).toBeDefined());
      expect(result.current.isResumingFromUrl).toBe(true);
      expect(await result.current.saveOnExit()).toBeNull();
      expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBe("old");
    } finally {
      finishSave();
      await act(async () => {
        await writing;
      });
    }
    await waitFor(() => expect(result.current.isResumingFromUrl).toBe(false));
    expect((await draftDB.getDraft("old"))?.feedback).toBe("last edit before leaving");
    expect(useWorkFlowStore.getState().feedback).toBe("");
  });

  it.each([
    true,
    false,
  ])("resumes matching work directly, whether already linked or unlinked (%s)", async (linked) => {
    await saveDraftWithPhoto();
    if (!linked) await draftDB.updateDraft("old", { linkIntent: undefined });
    const query = writeWorkLinkIntent(new URLSearchParams(), {
      ...PROMISE,
      commitmentId: 12n,
      garden: getAddress(GARDEN),
    });
    const { result } = openWizard(query.toString());
    await waitFor(() => expect(result.current.isResumingFromUrl).toBe(false));
    expect(result.current.showDraftSheet).toBe(false);
    expect(useWorkFlowStore.getState()).toMatchObject({
      activeDraftId: "old",
      feedback: "mulched the east beds",
    });
    expect(useWorkFlowStore.getState().images.map((file) => file.name)).toEqual(["beds.jpg"]);
  });

  it("keeps the original work intact when a separate draft would exceed the limit", async () => {
    await fillDraftSlots(19);
    const saved = await saveDraftWithPhoto();
    const { result } = openWizard(ANOTHER_PROMISE_PAGE);
    await waitFor(() => expect(useWorkFlowStore.getState().draftError).toBe("draft-limit"));
    expect(await result.current.saveOnExit()).toBeNull();
    expect(await draftDB.getDraft("old")).toEqual(saved);
    expect(await draftDB.getDraftCount(ACCOUNT, CHAIN)).toBe(20);
    await draftDB.deleteDraft("slot-0");
    act(() => result.current.retryHydration());
    await waitFor(() => expect(result.current.isResumingFromUrl).toBe(false));
    expect(useWorkFlowStore.getState().feedback).toBe("");
    expect(await draftDB.getImagesForDraft("old")).toHaveLength(1);
  });
});

const ACTION = createMockAction({ id: `${CHAIN}-5`, title: "Mulch the east beds" });
/** Navigation runs at once; stable, as the controller's managed timer is. */
const scheduleNow = (callback: () => void) => callback();

/** A saved draft with a photo, left as the wizard's active draft, for work that is not for a promise. */
async function saveDraftForSubmit() {
  const photo = new File(["photo-bytes"], "beds.jpg", { type: "image/jpeg" });
  const record = await draftDB.saveSnapshot(
    ACCOUNT,
    CHAIN,
    "submitted",
    { gardenAddress: GARDEN, actionUID: 5, feedback: "mulched the east beds" },
    [photo],
    []
  );
  return { record, photo };
}

/**
 * Submit Work's Review as its controller composes it: the wizard's draft wiring, the work
 * mutation, and the retirement that lets the draft go once the composer's part is done. The
 * person continues the saved draft from the Garden tab's prompt first, as in the app.
 */
async function continueToReview() {
  const navigate = vi.fn();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      IntlProvider,
      { locale: "en", messages: {}, onError: () => undefined },
      createElement(QueryClientProvider, { client: queryClient }, children)
    );
  const review = renderHook(
    () => {
      const [searchParams, setSearchParams] = useState(() => new URLSearchParams());
      const wizard = useWizard({
        searchParams,
        setSearchParams,
        restoreForm: () => undefined,
        linkIntent: undefined,
      });
      const mutation = useWorkMutation({
        authMode: "wallet",
        gardenAddress: GARDEN,
        actionUID: 5,
        actions: [ACTION],
        userAddress: ACCOUNT,
      });
      useWorkDraftRetirement({
        completed: useWorkFlowStore((state) => state.submissionCompleted),
        paused: false,
        attempt: 0,
        clearActiveDraft: wizard.clearActiveDraft,
        schedule: scheduleNow,
        navigate,
      });
      return { ...wizard, mutation };
    },
    { wrapper }
  );
  await waitFor(() => expect(review.result.current.showDraftSheet).toBe(true));
  await act(async () => {
    await review.result.current.handleContinueDraft();
  });
  return { ...review, navigate };
}

/** Upload Work on Review, which rejects when the send does. */
async function uploadWork(review: Awaited<ReturnType<typeof continueToReview>>, photo: File) {
  await act(async () => {
    await expect(
      review.result.current.mutation.mutateAsync({
        draft: createMockWorkDraft({ actionUID: 5, feedback: "mulched the east beds" }),
        images: [photo],
      })
    ).rejects.toThrow();
  });
}

/** Back on the Garden tab later: a new visit asks to continue only a draft it can resume. */
async function offeredLater() {
  cleanup();
  useWorkFlowStore.getState().reset();
  useWorkFlowStore.setState({ draftScope: null, draftHydrated: false });
  const { result } = openWizard();
  await waitFor(() => expect(useWorkFlowStore.getState().draftHydrated).toBe(true));
  await act(async () => {
    await queueDraftWrite(async () => undefined);
  });
  return result.current.showDraftSheet;
}

const queuedWork = async (clientWorkId: string | undefined) =>
  (await jobQueueDB.getJobs({ userAddress: ACCOUNT, kind: "work", synced: false })).filter(
    (job) => (job.payload as WorkJobPayload).clientWorkId === clientWorkId
  );

describe("what a Submit leaves to resume", () => {
  it.each([
    [
      "a send that failed with nothing sent",
      new WorkSubmissionError("The garden refused this work", "transaction", "batch"),
    ],
    [
      "a declined wallet prompt",
      new WorkSubmissionError(
        "User rejected the request.",
        "transaction",
        "batch",
        Object.assign(new Error("User rejected the request."), { code: 4001 })
      ),
    ],
  ])("leaves no resumable draft once the queue admitted the work, after %s", async (_case, failure) => {
    const { record, photo } = await saveDraftForSubmit();
    const review = await continueToReview();
    wallet.send.mockRejectedValueOnce(failure);

    await uploadWork(review, photo);

    // The queue holds the work now, so the draft goes as it would after a send, and the composer
    // leaves for Your Work.
    await waitFor(() => expect(review.navigate).toHaveBeenCalledOnce());
    expect(await draftDB.getDraft(record.id)).toBeUndefined();
    expect(await draftDB.getActiveDraft(ACCOUNT, CHAIN)).toBeNull();
    // Your Work's Pending has the work and its photo to send again.
    const [work] = await queuedWork(record.clientWorkId);
    expect(work).toBeDefined();
    expect(await jobQueueDB.getImagesForJob(work.id)).toHaveLength(1);
    expect(wallet.send).toHaveBeenCalledOnce();
    // The Garden tab has nothing to continue.
    expect(await offeredLater()).toBe(false);
  });

  it("keeps the draft resumable when the queue never admitted the work", async () => {
    const { record, photo } = await saveDraftForSubmit();
    const review = await continueToReview();
    vi.spyOn(jobQueue, "addJob").mockRejectedValueOnce(new Error("QuotaExceededError"));

    await uploadWork(review, photo);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(review.navigate).not.toHaveBeenCalled();
    expect(await draftDB.getDraft(record.id)).toMatchObject({ feedback: "mulched the east beds" });
    expect(await draftDB.getImagesForDraft(record.id)).toHaveLength(1);
    expect(await queuedWork(record.clientWorkId)).toEqual([]);
    expect(wallet.send).not.toHaveBeenCalled();
    expect(await offeredLater()).toBe(true);
  });
});
