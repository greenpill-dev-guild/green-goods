/** @vitest-environment happy-dom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode, StrictMode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actionUID: null as number | null,
  gardenAddress: null as string | null,
  setActiveTab: vi.fn(),
  ensureJourney: vi.fn(() => "journey-1"),
  reset: vi.fn(),
  enqueue: vi.fn(),
  takeUp: vi.fn(),
  takeUpChoices: [] as Array<Record<string, unknown>>,
  takeUpAsks: [] as Array<Record<string, unknown>>,
  takeUpLoading: false,
  uploadWork: vi.fn(),
  consumeShareTarget: vi.fn(),
  loadShareTarget: vi.fn(),
  normalizeWorkMediaFiles: vi.fn(),
  saveOnExit: vi.fn(),
  autoSaveFields: null as null | Record<string, unknown>,
  autoSaveEnabled: true,
  isResumingFromUrl: false,
  setDraftGarden: vi.fn(),
  setDraftAction: vi.fn(),
  setFlowState: vi.fn(),
  linkCleared: false,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  setImages: vi.fn(),
  setValue: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  outcome: null as null | Record<string, unknown>,
  choices: [] as Array<Record<string, unknown>>,
  communityGarden: null as null | { id: string },
  selectGarden: vi.fn(),
  joinGarden: vi.fn(),
  joinState: { isJoining: false, joiningGardenId: null as string | null },
  askAgain: vi.fn(),
  activeDraftId: null as string | null,
  activeTab: "Intro" as "Intro" | "Media" | "Details" | "Review",
  gardens: [] as Array<{ id: string; name: string; domainMask?: number }>,
  allGardens: [] as Array<{ id: string; name: string }>,
  gardenRecord: null as null | { id: string; name: string },
  activeGarden: {
    status: "choose" as "loading" | "error" | "none" | "choose" | "ready",
    gardenId: null as string | null,
  },
  actions: [] as Array<Record<string, unknown>>,
  workable: {
    data: [] as Array<Record<string, unknown>> | undefined,
    isPending: false,
    isError: false,
    fetchStatus: "idle" as "idle" | "fetching" | "paused",
  },
  startSkipAction: null as null | { garden: string; actionUID: number },
  queue: { pendingCommitmentIds: new Set<string>(), isUnavailable: false },
}));

vi.mock("../../../hooks/garden/useActiveGarden", () => ({
  useActiveGarden: () => ({ ...mocks.activeGarden, garden: null, selectGarden: vi.fn() }),
}));

vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: mocks.allGardens }),
}));

vi.mock("../../../hooks/garden/useGardenRecord", () => ({
  useGardenRecord: (_gardenId: string | null, options: { enabled?: boolean } = {}) => ({
    data: options.enabled === false ? undefined : mocks.gardenRecord,
  }),
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x9999999999999999999999999999999999999999",
}));

vi.mock("../../../stores/workFlowTypes", () => ({
  WorkTab: { Intro: "Intro", Media: "Media", Details: "Details", Review: "Review" },
}));

vi.mock("../../../utils/action/parsers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/action/parsers")>()),
  findActionByUID: () => ({}),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { error: mocks.loggerError, warn: mocks.loggerWarn },
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentJobs", () => ({
  useCommitmentJobs: () => ({
    enqueue: mocks.enqueue,
    takeUp: mocks.takeUp,
    isPending: false,
    error: null,
    viewer: null,
  }),
}));

vi.mock("../../../hooks/commitment-pooling/useWorkLinkChoices", async (importOriginal) => ({
  workLinkReturnTo: (
    await importOriginal<typeof import("../../../hooks/commitment-pooling/useWorkLinkChoices")>()
  ).workLinkReturnTo,
  useWorkLinkChoices: () => ({
    choices: mocks.choices,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useWorkablePromises: () => ({ ...mocks.workable, refetch: vi.fn() }),
}));

vi.mock("../../../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: () => mocks.queue,
}));

vi.mock("../../../hooks/commitment-pooling/useTakeUpChoices", () => ({
  useTakeUpChoices: () => ({
    asks: mocks.takeUpAsks,
    choices: mocks.takeUpChoices,
    isLoading: mocks.takeUpLoading,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseContractError: () => ({ name: "UnknownError" }),
}));

vi.mock("../../../components/Toast/toast.service", () => ({
  toastService: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock("../../../modules/app/posthog", () => ({
  track: vi.fn(),
}));

vi.mock("../../../hooks/utils/useAudioRecording", () => ({
  useAudioRecording: () => ({ isRecording: false, elapsed: 0, toggle: vi.fn() }),
}));

vi.mock("../../../hooks/work/useDraftAutoSave", () => ({
  useDraftSaveStatus: () => ({
    saveState: "saved",
    error: null,
    missingAttachments: [],
    removeMissingAttachment: vi.fn(),
  }),
  useDraftAutoSave: (
    fields: Record<string, unknown>,
    _images: unknown,
    options: { enabled: boolean }
  ) => {
    mocks.autoSaveFields = fields;
    mocks.autoSaveEnabled = options.enabled;
    return { saveOnExit: mocks.saveOnExit };
  },
}));

vi.mock("../../../modules/app/share-target", () => ({
  consumeShareTarget: mocks.consumeShareTarget,
  loadShareTarget: mocks.loadShareTarget,
}));

vi.mock("../../../modules/work/media-processing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../modules/work/media-processing")>()),
  normalizeWorkMediaFiles: mocks.normalizeWorkMediaFiles,
}));

vi.mock("../../../hooks/work/useDraftResume", () => ({
  useDraftResume: () => ({
    showDraftSheet: false,
    isResumingFromUrl: mocks.isResumingFromUrl,
    setShowDraftSheet: vi.fn(),
    handleContinueDraft: vi.fn(),
    handleStartFresh: vi.fn(),
    askAgainNextVisit: mocks.askAgain,
    clearActiveDraft: vi.fn(),
  }),
}));

vi.mock("../../../hooks/garden/useJoinGarden", () => ({
  useJoinGarden: () => ({ joinGarden: mocks.joinGarden, ...mocks.joinState }),
}));

vi.mock("../../../hooks/app/useOffline", () => ({
  useOffline: () => ({ isOnline: true, pendingCount: 0, syncStatus: "idle" }),
}));

vi.mock("../../../hooks/utils/useTimeout", () => ({
  useTimeout: () => ({ set: vi.fn() }),
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({
    authMode: "wallet",
    primaryAddress: "0x9999999999999999999999999999999999999999",
  }),
}));

vi.mock("../../../stores/useWorkFlowStore", () => ({
  useWorkFlowStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        submissionCompleted: false,
        workSubmissionJourneyId: "journey-1",
        ensureWorkSubmissionJourneyId: mocks.ensureJourney,
        setGardenAddress: mocks.setDraftGarden,
        audioNotes: [],
        setAudioNotes: vi.fn(),
        draftLinkCleared: mocks.linkCleared,
        activeDraftId: mocks.activeDraftId,
        startSkipAction: mocks.startSkipAction,
      }),
    {
      getState: () => ({
        audioNotes: [],
        reset: mocks.reset,
        setActionUID: mocks.setDraftAction,
        gardenAddress: mocks.gardenAddress,
        actionUID: mocks.actionUID,
        startSkipAction: mocks.startSkipAction,
      }),
      setState: mocks.setFlowState,
    }
  ),
}));

vi.mock("../../../providers/Work", () => ({
  useWorkFormContext: () => ({
    state: { isValid: true, isSubmitting: false },
    images: [],
    setImages: mocks.setImages,
    register: vi.fn(),
    control: {},
    setValue: mocks.setValue,
    uploadWork: mocks.uploadWork,
    feedback: "",
    timeSpentMinutes: undefined,
    values: {},
    reset: vi.fn(),
    workMutation: {
      isPending: false,
      error: null,
      lastSubmissionOutcome: mocks.outcome,
      getLastSubmissionOutcome: () => mocks.outcome,
      clearLastSubmissionOutcome: vi.fn(),
    },
  }),
  useWorkSelection: () => ({
    actions: mocks.actions,
    gardens: mocks.gardens,
    hasJoinedGardens: false,
    joinableCommunityGarden: mocks.communityGarden,
    isLoading: false,
    activeTab: mocks.activeTab,
    setActiveTab: mocks.setActiveTab,
    selectedDomain: null,
    setSelectedDomain: vi.fn(),
    actionUID: mocks.actionUID,
    setActionUID: vi.fn(),
    gardenAddress: mocks.gardenAddress,
    setGardenAddress: mocks.selectGarden,
  }),
}));

vi.mock("../../../hooks/client-ui/work/useWorkMediaLifecycle", () => ({
  useWorkMediaLifecycle: () => ({
    brokenMediaIds: new Set(),
    cameraClickRef: { current: null },
    markMediaPreviewFailed: vi.fn(),
    mediaClickRef: { current: null },
    removeBrokenMedia: vi.fn(),
    removeMedia: vi.fn(),
    resetBrokenMedia: vi.fn(),
  }),
}));

vi.mock("../../../hooks/client-ui/work/useWorkSubmissionPresentationModel", () => ({
  useWorkSubmissionPresentationModel: () => ({
    detailInputs: [],
    detailsConfig: {},
    mediaConfig: { required: false },
    minRequired: 0,
    reviewConfig: {},
    reviewData: {},
  }),
}));

import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { TakeUpNotSent } from "../../../modules/commitment-pooling/take-up";
import { useSubmissionFlowController } from "../../../hooks/client-ui/submission/useSubmissionFlowController";
import { useWorkSubmissionFlowController } from "../../../hooks/client-ui/work/useWorkSubmissionFlowController";
import { useUIStore } from "../../../stores/useUIStore";
import { Domain } from "../../../types/domain";

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(
    MemoryRouter,
    null,
    createElement(IntlProvider, { locale: "en", messages: {} }, children)
  );
}

function StrictShareWrapper({ children }: { children: ReactNode }) {
  return createElement(
    StrictMode,
    null,
    createElement(
      MemoryRouter,
      { initialEntries: ["/home/garden?shareTarget=share-1"] },
      createElement(IntlProvider, { locale: "en", messages: {} }, children)
    )
  );
}

const commitmentLinkIntent = {
  commitmentId: 9n,
  requirementIndex: 0,
  actionUID: 1,
  garden: "0x1111111111111111111111111111111111111111" as const,
  commitmentTitle: "Trees",
  requirementLabel: "1",
  returnTo: "/home/0x1111111111111111111111111111111111111111/commitments/9",
};

let navigateShareRoute: ((path: string) => void) | null = null;
let exitPath = "";
let exitNavigation = "";
let exitState: Record<string, unknown> | null = null;

function ExitPathCapture({ children }: { children: ReactNode }) {
  exitPath = useLocation().pathname;
  exitState = useLocation().state;
  exitNavigation = useNavigationType();
  return children;
}

function ExitWrapper({ children }: { children: ReactNode }) {
  return createElement(
    MemoryRouter,
    { initialEntries: ["/home/garden"] },
    createElement(
      ExitPathCapture,
      null,
      createElement(IntlProvider, { locale: "en", messages: {} }, children)
    )
  );
}

function ShareNavigationCapture({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  navigateShareRoute = (path) => navigate(path);
  return children;
}

function ShareNavigationWrapper({ children }: { children: ReactNode }) {
  return createElement(
    MemoryRouter,
    { initialEntries: ["/home/garden?shareTarget=share-1"] },
    createElement(
      ShareNavigationCapture,
      null,
      createElement(IntlProvider, { locale: "en", messages: {} }, children)
    )
  );
}

describe("useWorkSubmissionFlowController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.actionUID = null;
    mocks.gardenAddress = null;
    mocks.outcome = null;
    mocks.choices = [];
    mocks.takeUpChoices = [];
    mocks.takeUpAsks = [];
    mocks.takeUpLoading = false;
    mocks.communityGarden = null;
    mocks.joinState = { isJoining: false, joiningGardenId: null };
    mocks.enqueue.mockResolvedValue("link-job");
    mocks.consumeShareTarget.mockResolvedValue(undefined);
    mocks.loadShareTarget.mockReset();
    mocks.uploadWork.mockReset();
    mocks.normalizeWorkMediaFiles.mockReset();
    mocks.saveOnExit.mockReset();
    mocks.saveOnExit.mockResolvedValue("draft-1");
    mocks.autoSaveFields = null;
    mocks.autoSaveEnabled = true;
    mocks.isResumingFromUrl = false;
    mocks.linkCleared = false;
    mocks.activeDraftId = null;
    mocks.activeTab = "Intro";
    mocks.gardens = [];
    mocks.allGardens = [];
    mocks.gardenRecord = null;
    mocks.activeGarden = { status: "choose", gardenId: null };
    mocks.actions = [];
    mocks.workable = { data: [], isPending: false, isError: false, fetchStatus: "idle" };
    mocks.startSkipAction = null;
    mocks.queue = { pendingCommitmentIds: new Set(), isUnavailable: false };
    mocks.toastError.mockReset();
    navigateShareRoute = null;
    exitPath = "";
  });

  it("waits for draft reconciliation before applying or saving an incoming promise", () => {
    mocks.isResumingFromUrl = true;
    mocks.choices = [commitmentLinkIntent];
    const params = new URLSearchParams({
      linkCommitmentId: "9",
      linkRequirementIndex: "0",
      linkActionUID: "1",
      linkGarden: commitmentLinkIntent.garden,
      linkCommitmentTitle: "Trees",
      linkRequirementLabel: "1",
      returnTo: commitmentLinkIntent.returnTo,
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        MemoryRouter,
        { initialEntries: [`/home/garden?${params}`] },
        createElement(IntlProvider, { locale: "en", messages: {} }, children)
      );
    const view = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper }
    );
    expect(mocks.setDraftGarden).not.toHaveBeenCalled();
    expect(mocks.setDraftAction).not.toHaveBeenCalled();
    expect(mocks.autoSaveEnabled).toBe(false);
    expect(view.result.current.canProceed).toBe(false);

    mocks.isResumingFromUrl = false;
    view.rerender();
    expect(mocks.setDraftGarden).toHaveBeenCalledWith(commitmentLinkIntent.garden);
    expect(mocks.setDraftAction).toHaveBeenCalledWith(1);
    expect(mocks.autoSaveEnabled).toBe(true);
  });

  it("projects selection and owns the intro progress gate", () => {
    mocks.gardens = [{ id: "garden-1", name: "Riverside" }];
    const view = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: Wrapper }
    );
    expect(view.result.current.canProceed).toBe(false);

    mocks.actionUID = 1;
    mocks.gardenAddress = "garden-1";
    view.rerender();
    expect(view.result.current.canProceed).toBe(true);

    // A garden the member can no longer submit work to reopens the question and holds Start.
    mocks.gardenAddress = "garden-2";
    view.rerender();
    expect(view.result.current.submissionGardenSettled).toBe(false);
    expect(view.result.current.canProceed).toBe(false);
  });

  it("owns tab transitions", async () => {
    const { result } = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: Wrapper }
    );

    await result.current.changeTab("Media" as never);
    expect(mocks.setActiveTab).toHaveBeenCalledWith("Media");
  });

  it("returns home without waiting for the background draft save", () => {
    let releaseSave!: () => void;
    const pendingSave = new Promise<string>((resolve) => {
      releaseSave = () => resolve("draft-1");
    });
    mocks.saveOnExit.mockReturnValue(pendingSave);
    const { result } = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: ExitWrapper }
    );

    act(() => {
      void result.current.exit();
    });
    const pathBeforeSave = exitPath;
    releaseSave();

    expect(pathBeforeSave).toBe("/home");
    expect(mocks.saveOnExit).toHaveBeenCalledTimes(1);
  });

  it("preserves the dashboard trail when a promise query changes before leaving work", () => {
    const parent = "/home/garden-1/commitments/9";
    const dashboardBack = {
      scope: `${DEFAULT_CHAIN_ID}:0x9999999999999999999999999999999999999999:${useUIStore.getState().dashboardNavigationId}`,
      path: parent,
    };
    function LinkedWorkWrapper({ children }: { children: ReactNode }) {
      return createElement(
        MemoryRouter,
        {
          initialEntries: [
            parent,
            {
              pathname: "/home/garden",
              state: { dashboardBack },
            },
          ],
        },
        createElement(
          ExitPathCapture,
          null,
          createElement(IntlProvider, { locale: "en", messages: {} }, children)
        )
      );
    }
    const { result } = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: LinkedWorkWrapper }
    );
    act(() => result.current.clearLinkIntent());
    expect(exitState).toEqual({ dashboardBack });
    act(() => result.current.exit());
    expect(exitPath).toBe(parent);
    expect(exitNavigation).toBe("POP");
  });

  it.each([
    {
      from: "a prompt whose address holds the draft's promise",
      holdsIt: true,
      navigation: "REPLACE",
    },
    {
      from: "a prompt on the page's own address, or the wizard",
      holdsIt: false,
      navigation: "PUSH",
    },
  ])("opens Your Work on its drafts from $from", ({ holdsIt, navigation }) => {
    mocks.askAgain.mockReturnValue(holdsIt);
    useUIStore.getState().closeWorkDashboard();
    const { result } = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: ExitWrapper }
    );

    act(() => result.current.draft.manage());

    expect(exitState).toMatchObject({
      dashboardEntry: { snapshot: { kind: "work", tab: "pending", pendingFilter: "editing" } },
    });
    expect(exitPath).toBe("/home");
    // Back returns to the visit, except where its address would pass the draft's promise off
    // as the page's own.
    expect(exitNavigation).toBe(navigation);
    expect(mocks.askAgain).toHaveBeenCalledOnce();
  });

  it("offers a retry toast when the background draft save fails", async () => {
    const error = new Error("draft storage unavailable");
    mocks.saveOnExit.mockRejectedValueOnce(error).mockResolvedValueOnce("draft-1");
    const { result } = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: ExitWrapper }
    );

    act(() => {
      void result.current.exit();
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    const descriptor = mocks.toastError.mock.calls[0][0];
    expect(descriptor).toEqual(
      expect.objectContaining({
        error,
        persistent: true,
        action: expect.objectContaining({ onClick: expect.any(Function) }),
      })
    );

    act(() => descriptor.action.onClick());
    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(2));
  });

  it("imports and consumes a Share Target exactly once under Strict Mode", async () => {
    const image = new File(["image"], "garden.webp", { type: "image/webp" });
    let resolveShareTarget: ((value: Record<string, unknown>) => void) | undefined;
    const shareTarget = new Promise<Record<string, unknown>>((resolve) => {
      resolveShareTarget = resolve;
    });
    mocks.actionUID = 1;
    mocks.gardenAddress = "0x1111111111111111111111111111111111111111";
    mocks.loadShareTarget.mockReturnValue(shareTarget);
    const loadedShareTarget = {
      envelope: {
        version: 1,
        token: "share-1",
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
        title: "Creek restoration",
        text: "Seedlings planted",
        url: "https://example.org/proof",
        files: [],
      },
      feedback: "Creek restoration\n\nSeedlings planted\n\nhttps://example.org/proof",
      files: [image],
    };
    mocks.normalizeWorkMediaFiles.mockResolvedValue({
      accepted: [{ file: image }],
      rejected: [],
    });

    const view = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: StrictShareWrapper }
    );

    await waitFor(() => expect(mocks.loadShareTarget).toHaveBeenCalled());
    view.rerender();
    await act(async () => {
      resolveShareTarget?.(loadedShareTarget);
      await shareTarget;
    });

    await waitFor(() =>
      expect(mocks.setValue).toHaveBeenCalledWith(
        "feedback",
        "Creek restoration\n\nSeedlings planted\n\nhttps://example.org/proof",
        { shouldDirty: true }
      )
    );
    expect(mocks.setImages).toHaveBeenCalledWith([image]);
    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.consumeShareTarget).toHaveBeenCalledTimes(1));
    expect(mocks.consumeShareTarget).toHaveBeenCalledWith("share-1");
  });

  it("keeps the Share Target available when saving its draft fails", async () => {
    const image = new File(["image"], "garden.webp", { type: "image/webp" });
    mocks.actionUID = 1;
    mocks.gardenAddress = "0x1111111111111111111111111111111111111111";
    mocks.loadShareTarget.mockResolvedValue({
      envelope: {
        version: 1,
        token: "share-1",
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
        title: "Creek restoration",
        text: "",
        url: "",
        files: [],
      },
      feedback: "Creek restoration",
      files: [image],
    });
    mocks.normalizeWorkMediaFiles.mockResolvedValue({
      accepted: [{ file: image }],
      rejected: [],
    });
    mocks.saveOnExit.mockRejectedValue(new Error("draft storage unavailable"));

    renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: StrictShareWrapper }
    );

    await waitFor(() =>
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "Share Target draft save failed",
        expect.objectContaining({ source: "GardenFlow" })
      )
    );
    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(2));
    expect(mocks.consumeShareTarget).not.toHaveBeenCalled();
  });

  it("serializes overlapping Share Targets without dropping the newer token", async () => {
    const firstImage = new File(["first"], "first.webp", { type: "image/webp" });
    const secondImage = new File(["second"], "second.webp", { type: "image/webp" });
    const loadedShare = (token: string, feedback: string, file: File) => ({
      envelope: {
        version: 1,
        token,
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
        title: feedback,
        text: "",
        url: "",
        files: [],
      },
      feedback,
      files: [file],
    });
    let resolveFirstSave: ((draftId: string) => void) | undefined;
    const firstSave = new Promise<string>((resolve) => {
      resolveFirstSave = resolve;
    });
    mocks.actionUID = 1;
    mocks.gardenAddress = "0x1111111111111111111111111111111111111111";
    mocks.loadShareTarget.mockImplementation((token: string) =>
      Promise.resolve(
        token === "share-1"
          ? loadedShare("share-1", "First share", firstImage)
          : loadedShare("share-2", "Second share", secondImage)
      )
    );
    mocks.normalizeWorkMediaFiles.mockImplementation((files: File[]) =>
      Promise.resolve({
        accepted: files.map((file) => ({ file })),
        rejected: [],
      })
    );
    mocks.saveOnExit.mockReturnValueOnce(firstSave).mockResolvedValueOnce("draft-2");

    renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: ShareNavigationWrapper }
    );

    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(1));
    await act(async () => {
      navigateShareRoute?.("/home/garden?shareTarget=share-2");
      await Promise.resolve();
    });

    expect(mocks.loadShareTarget).not.toHaveBeenCalledWith("share-2");

    await act(async () => {
      resolveFirstSave?.("draft-1");
      await firstSave;
    });

    await waitFor(() => expect(mocks.consumeShareTarget).toHaveBeenCalledWith("share-1"));
    await waitFor(() => expect(mocks.loadShareTarget).toHaveBeenCalledWith("share-2"));
    await waitFor(() => expect(mocks.setValue).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.saveOnExit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.consumeShareTarget).toHaveBeenCalledWith("share-2"));
    expect(mocks.setValue).toHaveBeenNthCalledWith(1, "feedback", "First share", {
      shouldDirty: true,
    });
    expect(mocks.setValue).toHaveBeenNthCalledWith(2, "feedback", "Second share", {
      shouldDirty: true,
    });
  });

  it.each([
    ["direct", { kind: "direct", clientWorkId: "client-1", txHash: "0x1", sponsored: false }],
    [
      "queued",
      {
        kind: "queued",
        clientWorkId: "client-1",
        jobId: "work-job-1",
        txHash: "0x2",
        sponsored: false,
      },
    ],
  ] as const)("recovers a failed %s dependent link without resubmitting Work", async (_kind, outcome) => {
    const intent = commitmentLinkIntent;
    mocks.actionUID = 1;
    mocks.gardenAddress = intent.garden;
    mocks.choices = [intent];
    mocks.outcome = outcome;
    mocks.enqueue.mockRejectedValueOnce(new Error("storage unavailable"));
    const view = renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper: Wrapper }
    );

    act(() => view.result.current.selectLinkIntent(intent));
    await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));
    let submitted = false;
    await act(async () => {
      submitted = await view.result.current.submit();
    });
    expect(submitted).toBe(true);
    await waitFor(() => expect(view.result.current.hasPendingLinkRecovery).toBe(true));
    const firstPayload = mocks.enqueue.mock.calls[0][0].payload;

    mocks.enqueue.mockResolvedValueOnce("link-job");
    let retried = false;
    await act(async () => {
      retried = await view.result.current.retryLinkOnly();
    });
    expect(retried).toBe(true);
    expect(view.result.current.linkSchedulingSucceeded).toBe(true);
    expect(view.result.current.linkSchedulingWorkSent).toBe(_kind !== "queued");
    expect(mocks.uploadWork).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue.mock.calls[1][0].payload).toEqual(firstPayload);
    expect(firstPayload.clientWorkId).toBe("client-1");
    expect(firstPayload.clientOperationId).toBe("work-link:client-1:9:0");
    if (_kind === "queued") expect(firstPayload.sourceWorkJobId).toBe("work-job-1");
    else expect(firstPayload).not.toHaveProperty("sourceWorkJobId");
  });

  const renderThroughFlow = () =>
    renderHook(
      () => {
        const controller = useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        });
        const flow = useSubmissionFlowController({ kind: "work", controller });
        return { controller, flow };
      },
      { wrapper: Wrapper }
    );

  it("keeps the flow on the step the work store restored, saved with the draft as before", () => {
    mocks.actionUID = 1;
    mocks.gardenAddress = "garden-1";
    mocks.gardens = [{ id: "garden-1", name: "Riverside" }];
    mocks.activeTab = "Details";
    const view = renderThroughFlow();

    expect(view.result.current.flow.stage).toBe("details");
    expect(view.result.current.flow.progress).toBe(3);
    expect(mocks.autoSaveFields).toMatchObject({
      gardenAddress: "garden-1",
      actionUID: 1,
      currentStep: "details",
    });
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
  });

  it("reaches the queue through the shared Review stage with the same Work send and link payload", async () => {
    const intent = commitmentLinkIntent;
    mocks.actionUID = 1;
    mocks.gardenAddress = intent.garden;
    mocks.choices = [intent];
    mocks.activeTab = "Review";
    mocks.outcome = { kind: "direct", clientWorkId: "client-1", txHash: "0x1", sponsored: false };
    const view = renderThroughFlow();

    act(() => view.result.current.controller.selectLinkIntent(intent));
    await waitFor(() => expect(view.result.current.controller.linkIntentStatus).toBe("valid"));
    expect(view.result.current.flow.stage).toBe("review");
    expect(view.result.current.flow.forward?.labelId).toBe("app.garden.submit.tab.review.label");
    expect(mocks.autoSaveFields).toMatchObject({ currentStep: "review" });

    await act(async () => {
      view.result.current.flow.forward?.run();
    });

    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledOnce());
    expect(mocks.uploadWork).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue).toHaveBeenCalledWith({
      act: "workLink",
      payload: {
        clientOperationId: "work-link:client-1:9:0",
        commitmentId: 9n,
        clientWorkId: "client-1",
        requirementIndex: 0,
        gardenAddress: intent.garden,
      },
    });
    expect(view.result.current.controller.linkSchedulingSucceeded).toBe(true);
  });

  const communityGarden = "0x3333333333333333333333333333333333333333";
  const renderFlow = (wrapper = Wrapper) =>
    renderHook(
      () =>
        useWorkSubmissionFlowController({
          homeRoute: "/home",
          profileRoute: "/home/profile",
          trackMediaJourneyEvent: vi.fn(),
        }),
      { wrapper }
    );

  it.each([
    ["0xjoin", "Successfully joined garden"],
    ["already-member", "You are already a member of this garden"],
    ["already-joining", null],
  ] as const)("answers a Community Garden join that returns %s", async (joinResult, title) => {
    mocks.communityGarden = { id: communityGarden };
    mocks.joinGarden.mockResolvedValueOnce(joinResult);
    const { result } = renderFlow();

    await act(async () => {
      await result.current.joinCommunityGarden();
    });

    expect(mocks.joinGarden).toHaveBeenCalledWith(communityGarden);
    if (title) {
      expect(mocks.selectGarden).toHaveBeenCalledWith(communityGarden);
      expect(mocks.toastSuccess).toHaveBeenCalledWith({ title });
    } else {
      expect(mocks.selectGarden).not.toHaveBeenCalled();
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
    }
  });

  it("offers Profile when the Community Garden join fails", async () => {
    const error = new Error("join reverted");
    mocks.communityGarden = { id: communityGarden };
    mocks.joinGarden.mockRejectedValueOnce(error);
    const { result } = renderFlow(ExitWrapper);

    await act(async () => {
      await result.current.joinCommunityGarden();
    });

    expect(mocks.selectGarden).not.toHaveBeenCalled();
    expect(mocks.loggerError).toHaveBeenCalledWith("Community Garden join failed", {
      error,
      source: "GardenFlow",
      gardenAddress: communityGarden,
    });
    const descriptor = mocks.toastError.mock.calls[0][0];
    expect(descriptor).toEqual(
      expect.objectContaining({
        title: "Failed to join garden",
        message: "Try again here, or open Profile to join from your garden list.",
        action: expect.objectContaining({ label: "Profile", dismissOnClick: true }),
      })
    );
    act(() => descriptor.action.onClick());
    expect(exitPath).toBe("/home/profile");
  });

  it.each([
    [null, true],
    [communityGarden, true],
    ["0x2222222222222222222222222222222222222222", false],
  ] as const)("reports a join of %s as the Community Garden join: %s", (joiningGardenId, joining) => {
    mocks.communityGarden = { id: communityGarden };
    mocks.joinState = { isJoining: true, joiningGardenId };

    expect(renderFlow().result.current.isJoiningCommunityGarden).toBe(joining);
  });

  it("saves the promise with the draft, and taking it off as an unlink", async () => {
    const intent = commitmentLinkIntent;
    mocks.actionUID = intent.actionUID;
    mocks.gardenAddress = intent.garden;
    mocks.choices = [intent];
    const view = renderFlow();
    // A page without a promise leaves the draft's own alone.
    expect(mocks.autoSaveFields?.linkIntent).toBeUndefined();

    act(() => view.result.current.selectLinkIntent(intent));
    await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));
    expect(mocks.setFlowState).toHaveBeenLastCalledWith({ draftLinkCleared: false });
    expect(mocks.autoSaveFields?.linkIntent).toEqual({ ...intent, commitmentId: "9" });

    act(() => view.result.current.clearLinkIntent());
    expect(mocks.setFlowState).toHaveBeenLastCalledWith({ draftLinkCleared: true });
    mocks.linkCleared = true;
    view.rerender();
    expect(mocks.autoSaveFields?.linkIntent).toBeNull();
  });

  it("links the original work when the current flow selection changes during upload", async () => {
    const intent = commitmentLinkIntent;
    mocks.actionUID = intent.actionUID;
    mocks.gardenAddress = intent.garden;
    mocks.choices = [intent];
    let finishUpload!: () => void;
    mocks.uploadWork.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishUpload = resolve;
      })
    );
    const view = renderFlow();
    act(() => view.result.current.selectLinkIntent(intent));
    await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));
    let submission!: Promise<boolean>;
    act(() => {
      submission = view.result.current.submit();
    });
    await waitFor(() => expect(mocks.uploadWork).toHaveBeenCalledOnce());
    act(() => view.result.current.selectLinkIntent(null));
    mocks.actionUID = 2;
    view.rerender();
    // useWorkMutation's draft-ownership regression protects this retained result.
    mocks.outcome = {
      kind: "direct",
      clientWorkId: "original-work",
      txHash: "0x1",
      sponsored: false,
    };
    await act(async () => {
      finishUpload();
      await expect(submission).resolves.toBe(true);
    });
    expect(mocks.enqueue).toHaveBeenCalledWith({
      act: "workLink",
      payload: {
        clientOperationId: "work-link:original-work:9:0",
        commitmentId: 9n,
        clientWorkId: "original-work",
        requirementIndex: 0,
        gardenAddress: intent.garden,
      },
    });
    expect(mocks.uploadWork).toHaveBeenCalledOnce();
  });

  describe("taking up an Open ask in the tap that logs work for it (decision 18)", () => {
    const ask = { ...commitmentLinkIntent, takesUp: true as const };
    const claim = {
      commitmentId: 9n,
      kind: 1,
      gardenContext: ask.garden,
      gardenAddress: ask.garden,
    };
    const admit = vi.fn();
    /**
     * Submit Work's form as the controller drives it: the work's own checks, then the act the
     * controller hands it to run before admission, then admission, which puts the work's outcome
     * on record. `failsAdmission` fails that many admissions after the act has run.
     */
    const submitWorkForm = ({ passesChecks = true, failsAdmission = 0 } = {}) => {
      let failures = failsAdmission;
      // The outcome a test sets is what an admission records; a run that admits nothing records none.
      let configured: typeof mocks.outcome = null;
      mocks.uploadWork.mockImplementation(
        async (options?: { beforeAdmission?: () => Promise<boolean> }) => {
          configured = mocks.outcome ?? configured;
          mocks.outcome = null;
          if (!passesChecks) return;
          if (options?.beforeAdmission && !(await options.beforeAdmission())) return;
          if (failures-- > 0) throw new Error("upload failed");
          admit();
          mocks.outcome = configured;
        }
      );
    };
    const withAskChosen = () => {
      mocks.actionUID = ask.actionUID;
      mocks.gardenAddress = ask.garden;
      mocks.takeUpChoices = [ask];
      mocks.outcome = { kind: "direct", clientWorkId: "client-1", txHash: "0x1", sponsored: false };
      submitWorkForm();
      const view = renderFlow();
      act(() => view.result.current.selectLinkIntent(ask));
      return view;
    };

    it("takes the ask up before it admits the work, and counts each prompt up front", async () => {
      mocks.takeUp.mockResolvedValue({ status: "landed" });
      const view = withAskChosen();
      await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));
      // The take-up, the work and its link: three prompts, said before the first.
      expect(view.result.current.promptCount).toBe(3);

      await act(async () => {
        await expect(view.result.current.submit()).resolves.toBe(true);
      });

      expect(mocks.takeUp).toHaveBeenCalledWith(claim);
      expect(mocks.takeUp.mock.invocationCallOrder[0]).toBeLessThan(
        admit.mock.invocationCallOrder[0]
      );
      expect(mocks.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          act: "workLink",
          payload: expect.objectContaining({ commitmentId: 9n }),
        })
      );
      // Taken up from here, the promise asks for no take-up again.
      expect(view.result.current.promptCount).toBe(2);
    });

    it.each([
      ["declined", true, "app.garden.takeUp.declined.title"],
      ["refused", false, "app.garden.takeUp.failed.title"],
    ] as const)("queues none of the work when the take-up is %s", async (_case, declined, title) => {
      mocks.takeUp.mockRejectedValue(new TakeUpNotSent("not sent", declined));
      const view = withAskChosen();
      await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));

      await act(async () => {
        await expect(view.result.current.submit()).resolves.toBe(false);
      });

      expect(admit).not.toHaveBeenCalled();
      expect(mocks.enqueue).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith(expect.objectContaining({ title }));
    });

    it("takes nothing up for work that fails its own checks", async () => {
      const view = withAskChosen();
      submitWorkForm({ passesChecks: false });
      await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));

      await act(async () => {
        await expect(view.result.current.submit()).resolves.toBe(false);
      });

      // A take-up cannot be taken back, so it goes only for work its checks let through.
      expect(mocks.takeUp).not.toHaveBeenCalled();
      expect(mocks.enqueue).not.toHaveBeenCalled();
    });

    it("queues the work behind a take-up the queue holds for later", async () => {
      mocks.takeUp.mockResolvedValue({ status: "queued", reason: "offline" });
      const view = withAskChosen();
      mocks.outcome = {
        kind: "queued",
        clientWorkId: "client-1",
        jobId: "work-job",
        txHash: "0x1",
        sponsored: false,
      };
      await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));

      await act(async () => {
        await expect(view.result.current.submit()).resolves.toBe(true);
      });

      expect(admit).toHaveBeenCalledOnce();
      expect(mocks.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          act: "workLink",
          payload: expect.objectContaining({ sourceWorkJobId: "work-job" }),
        })
      );
      expect(view.result.current.promptCount).toBe(3);
    });

    it("takes the promise up once from one composer, whatever happens to the work after", async () => {
      mocks.takeUp.mockResolvedValue({ status: "landed" });
      const view = withAskChosen();
      submitWorkForm({ failsAdmission: 1 });
      await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));

      await act(async () => {
        await expect(view.result.current.submit()).resolves.toBe(false);
      });
      await act(async () => {
        await expect(view.result.current.submit()).resolves.toBe(true);
      });

      expect(mocks.takeUp).toHaveBeenCalledOnce();
      expect(mocks.uploadWork).toHaveBeenCalledTimes(2);
    });
  });

  it("releases dependent-link scheduling when validation stops the Work submission", async () => {
    const intent = commitmentLinkIntent;
    mocks.actionUID = 1;
    mocks.gardenAddress = intent.garden;
    mocks.choices = [intent];
    mocks.outcome = null;
    mocks.uploadWork.mockResolvedValue(undefined);
    const view = renderFlow();

    act(() => view.result.current.selectLinkIntent(intent));
    await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));
    let submitted = true;
    await act(async () => {
      submitted = await view.result.current.submit();
    });
    expect(submitted).toBe(false);
    expect(view.result.current.isSchedulingDependentLink).toBe(false);
    expect(view.result.current.linkSchedulingSucceeded).toBe(false);
    expect(view.result.current.hasPendingLinkRecovery).toBe(false);
    expect(mocks.enqueue).not.toHaveBeenCalled();

    mocks.outcome = { kind: "direct", clientWorkId: "client-1", txHash: "0x1", sponsored: false };
    await act(async () => {
      submitted = await view.result.current.submit();
    });
    expect(submitted).toBe(true);
    expect(mocks.uploadWork).toHaveBeenCalledTimes(2);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.enqueue.mock.calls[0][0].payload.clientOperationId).toBe("work-link:client-1:9:0");
    expect(view.result.current.isSchedulingDependentLink).toBe(false);
    expect(view.result.current.linkSchedulingSucceeded).toBe(true);
  });

  it.each([
    ["sent", { kind: "direct", clientWorkId: "client-1", txHash: "0x1", sponsored: false }, true],
    [
      "saved only on this device",
      {
        kind: "queued",
        clientWorkId: "client-1",
        jobId: "work-job-1",
        txHash: "0x2",
        sponsored: false,
        reason: "connection-unconfirmed",
      },
      false,
    ],
  ] as const)("reports the link as queueing only when the Work was sent: %s", async (_kind, outcome, queueing) => {
    const intent = commitmentLinkIntent;
    mocks.actionUID = 1;
    mocks.gardenAddress = intent.garden;
    mocks.choices = [intent];
    mocks.outcome = null;
    let finishUpload!: () => void;
    mocks.uploadWork.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishUpload = () => resolve();
      })
    );
    let finishLink!: (jobId: string) => void;
    mocks.enqueue.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishLink = resolve;
      })
    );
    const view = renderFlow();

    act(() => view.result.current.selectLinkIntent(intent));
    await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));
    let submission!: Promise<boolean>;
    act(() => {
      submission = view.result.current.submit();
    });
    await waitFor(() => expect(mocks.uploadWork).toHaveBeenCalledTimes(1));
    expect(view.result.current.isSchedulingDependentLink).toBe(true);
    expect(view.result.current.isQueueingDependentLink).toBe(false);

    mocks.outcome = { ...outcome };
    await act(async () => {
      finishUpload();
    });
    await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(view.result.current.isSchedulingDependentLink).toBe(true);
    expect(view.result.current.isQueueingDependentLink).toBe(queueing);

    let submitted = false;
    await act(async () => {
      finishLink("link-job");
      submitted = await submission;
    });
    expect(submitted).toBe(true);
    expect(view.result.current.isQueueingDependentLink).toBe(false);
    expect(view.result.current.isSchedulingDependentLink).toBe(false);
    expect(view.result.current.linkSchedulingSucceeded).toBe(true);
    expect(view.result.current.linkSchedulingWorkSent).toBe(queueing);
  });

  const ACTIVE_GARDEN = "0x4444444444444444444444444444444444444444";
  const DRAFT_GARDEN = "0x5555555555555555555555555555555555555555";
  const NAVIGATION_GARDEN = "0x6666666666666666666666666666666666666666";
  const memberGardens = [
    { id: ACTIVE_GARDEN, name: "Riverside" },
    { id: DRAFT_GARDEN, name: "Hilltop" },
    { id: NAVIGATION_GARDEN, name: "Orchard" },
    { id: commitmentLinkIntent.garden, name: "Creekside" },
  ];
  const linkSearch = `?${new URLSearchParams({
    linkCommitmentId: "9",
    linkRequirementIndex: "0",
    linkActionUID: "1",
    linkGarden: commitmentLinkIntent.garden,
    linkCommitmentTitle: "Trees",
    linkRequirementLabel: "1",
    returnTo: commitmentLinkIntent.returnTo,
  })}`;
  const enterFlow = ({ search = "", state = null }: { search?: string; state?: unknown } = {}) =>
    renderFlow(({ children }: { children: ReactNode }) =>
      createElement(
        MemoryRouter,
        { initialEntries: [{ pathname: "/home/garden", search, state }] },
        createElement(IntlProvider, { locale: "en", messages: {} }, children)
      )
    );

  it.each([
    { entry: "a fresh visit", active: ACTIVE_GARDEN, writes: [ACTIVE_GARDEN] },
    {
      entry: "an active garden the account cannot submit work to",
      active: "0x7777777777777777777777777777777777777777",
      writes: [],
    },
    {
      entry: "navigation state",
      active: ACTIVE_GARDEN,
      navigation: NAVIGATION_GARDEN,
      writes: [NAVIGATION_GARDEN],
    },
    {
      // History hands state back as it was saved, so a value that is no garden id is ignored.
      entry: "navigation state that is not a garden id",
      active: ACTIVE_GARDEN,
      navigation: 42 as unknown as string,
      writes: [ACTIVE_GARDEN],
    },
    {
      entry: "a resumed draft",
      active: ACTIVE_GARDEN,
      navigation: NAVIGATION_GARDEN,
      draft: DRAFT_GARDEN,
      writes: [],
    },
    {
      entry: "a promise link",
      active: ACTIVE_GARDEN,
      navigation: NAVIGATION_GARDEN,
      draft: DRAFT_GARDEN,
      linked: true,
      writes: [commitmentLinkIntent.garden],
    },
  ])("chooses the garden for $entry in the precedence order", (entry) => {
    mocks.gardens = memberGardens;
    mocks.activeGarden = { status: "ready", gardenId: entry.active };
    mocks.choices = entry.linked ? [commitmentLinkIntent] : [];
    if (entry.draft) {
      mocks.activeDraftId = "draft-1";
      mocks.gardenAddress = entry.draft;
    }

    enterFlow({
      search: entry.linked ? linkSearch : "",
      state: entry.navigation ? { gardenId: entry.navigation } : null,
    });

    // A promise link, a resumed draft and navigation state each come before the active garden,
    // which never moves a draft's garden.
    expect(mocks.setDraftGarden.mock.calls.map(([garden]) => garden)).toEqual(entry.writes);
  });

  it.each([
    {
      flow: "a resumed draft from another garden",
      garden: DRAFT_GARDEN,
      draft: true,
      named: "Hilltop",
    },
    {
      flow: "a promise link to another garden",
      garden: commitmentLinkIntent.garden,
      linked: true,
      named: "Creekside",
    },
    {
      flow: "a promise link to a garden the account is not a member of",
      garden: commitmentLinkIntent.garden,
      linked: true,
      member: false,
      named: "Creekside",
    },
    {
      flow: "a promise link to a garden past the chain's newest gardens",
      garden: commitmentLinkIntent.garden,
      linked: true,
      member: false,
      listed: false,
      named: "Creekside",
    },
    { flow: "work in the active garden", garden: ACTIVE_GARDEN, named: null },
    {
      flow: "a draft while the active garden is still unknown",
      garden: DRAFT_GARDEN,
      draft: true,
      activeUnknown: true,
      named: null,
    },
  ])("names the submission garden under the steps for $flow", (flow) => {
    mocks.gardens =
      flow.member === false
        ? memberGardens.filter(({ id }) => id !== commitmentLinkIntent.garden)
        : memberGardens;
    // The chain's list holds its newest gardens; an older one is read by its id.
    mocks.allGardens = flow.listed === false ? [] : memberGardens;
    mocks.gardenRecord =
      flow.listed === false ? { id: commitmentLinkIntent.garden, name: "Creekside" } : null;
    mocks.activeGarden = flow.activeUnknown
      ? { status: "loading", gardenId: null }
      : { status: "ready", gardenId: ACTIVE_GARDEN };
    mocks.choices = flow.linked ? [commitmentLinkIntent] : [];
    mocks.activeDraftId = flow.draft ? "draft-1" : null;
    mocks.gardenAddress = flow.garden;

    const { result } = enterFlow({ search: flow.linked ? linkSearch : "" });

    expect(result.current.namedSubmissionGarden?.name ?? null).toBe(flow.named);
  });

  it("asks no garden question while the flow's garden is one the member can submit work to", () => {
    mocks.gardens = memberGardens;
    mocks.activeGarden = { status: "ready", gardenId: ACTIVE_GARDEN };
    mocks.gardenAddress = ACTIVE_GARDEN;
    const view = enterFlow();
    expect(view.result.current.submissionGardenSettled).toBe(true);

    mocks.gardenAddress = "0x7777777777777777777777777777777777777777";
    view.rerender();
    expect(view.result.current.submissionGardenSettled).toBe(false);
  });

  /** A live action of a garden; the Start step offers it while `now` falls inside its dates. */
  const liveAction = (uid: number, domain: Domain | null) => ({
    id: `${DEFAULT_CHAIN_ID}-${uid}`,
    title: `Action ${uid}`,
    domain,
    startTime: Date.now() - 86_400_000,
    endTime: Date.now() + 86_400_000,
    media: [],
  });
  const promiseOwed = (choices: Array<Record<string, unknown>>, takesEvidence: boolean) => ({
    commitmentId: 9n,
    title: "Trees",
    direction: "REQUEST",
    state: "ACTIVE",
    dueDate: null,
    targetUnits: 0n,
    unitLabel: null,
    choices,
    takesEvidence,
  });
  /** The active garden, which offers Solar actions only. */
  const solarGarden = () => {
    mocks.gardens = [{ id: ACTIVE_GARDEN, name: "Riverside", domainMask: 1 << Domain.SOLAR }];
    mocks.activeGarden = { status: "ready", gardenId: ACTIVE_GARDEN };
    mocks.gardenAddress = ACTIVE_GARDEN;
  };

  it("opens Media with a garden's only action, the flow's own pick, when nothing else is owed", () => {
    solarGarden();
    // The Agroforestry action is not one this garden offers.
    mocks.actions = [liveAction(7, Domain.SOLAR), liveAction(8, Domain.AGRO)];
    const { result } = enterFlow();

    expect(mocks.setDraftAction).toHaveBeenCalledWith(7);
    expect(mocks.setFlowState).toHaveBeenCalledWith({
      startSkipAction: { garden: ACTIVE_GARDEN, actionUID: 7 },
    });
    expect(mocks.setActiveTab).toHaveBeenCalledWith("Media");
    expect(result.current.start.skipped).toBe(true);
  });

  it.each([
    [
      "while the member's promises are read",
      { data: undefined, isPending: true, isError: false, fetchStatus: "fetching" as const },
    ],
    [
      "when the member owes a promise here",
      {
        data: [promiseOwed([], true)],
        isPending: false,
        isError: false,
        fetchStatus: "idle" as const,
      },
    ],
    [
      "when the promises could not be read",
      { data: undefined, isPending: false, isError: true, fetchStatus: "idle" as const },
    ],
  ])("keeps Start %s, even with one action", (_case, read) => {
    solarGarden();
    mocks.actions = [liveAction(7, Domain.SOLAR)];
    mocks.workable = read;
    const { result } = enterFlow();

    expect(mocks.setActiveTab).not.toHaveBeenCalled();
    expect(mocks.setDraftAction).not.toHaveBeenCalled();
    expect(result.current.start.skipped).toBe(false);
  });

  it("opens a promise's page link on Media once confirmed, in the link's own garden", () => {
    mocks.gardens = memberGardens;
    mocks.activeGarden = { status: "ready", gardenId: ACTIVE_GARDEN };
    // The link's garden comes first in the precedence, so the flow holds it.
    mocks.gardenAddress = commitmentLinkIntent.garden;
    mocks.choices = [commitmentLinkIntent];
    mocks.actions = [liveAction(1, null), liveAction(2, null)];
    const { result } = enterFlow({ search: linkSearch });

    expect(mocks.setActiveTab).toHaveBeenCalledWith("Media");
    expect(mocks.setFlowState).not.toHaveBeenCalledWith(
      expect.objectContaining({ startSkipAction: expect.anything() })
    );
    expect(result.current.start.skipped).toBe(true);
  });

  it.each([
    ["gives the flow's pick back", null, true],
    ["keeps a draft's action", "draft-1", false],
  ])("%s when the work's garden changes", (_case, draft, givenBack) => {
    mocks.gardens = memberGardens;
    mocks.activeGarden = { status: "ready", gardenId: ACTIVE_GARDEN };
    mocks.gardenAddress = draft ? DRAFT_GARDEN : ACTIVE_GARDEN;
    mocks.activeDraftId = draft;
    mocks.startSkipAction = { garden: DRAFT_GARDEN, actionUID: 7 };
    mocks.actionUID = 7;
    mocks.activeTab = "Media";
    mocks.actions = [liveAction(7, null), liveAction(8, null)];
    enterFlow();

    if (givenBack) {
      expect(mocks.setFlowState).toHaveBeenCalledWith({ startSkipAction: null });
      expect(mocks.setDraftAction).toHaveBeenCalledWith(null);
      expect(mocks.setActiveTab).toHaveBeenCalledWith("Intro");
    } else {
      expect(mocks.setDraftAction).not.toHaveBeenCalled();
      expect(mocks.setActiveTab).not.toHaveBeenCalled();
    }
  });

  const owedChoice = {
    ...commitmentLinkIntent,
    garden: ACTIVE_GARDEN,
    actionUID: 9,
    approvedCount: 0,
    requiredCount: 4,
  };

  it("moves on once an action or a promise's action is chosen and saved, and opens evidence for its promise", async () => {
    solarGarden();
    mocks.actions = [liveAction(7, Domain.SOLAR), liveAction(9, Domain.SOLAR)];
    const choice = owedChoice;
    mocks.workable = {
      data: [promiseOwed([choice], true)],
      isPending: false,
      isError: false,
      fetchStatus: "idle",
    };
    // The store renders the flow again with the pick; the save the move makes must hold it.
    mocks.setDraftAction.mockImplementation((uid: number | null) => {
      mocks.actionUID = uid;
    });
    const saved: Array<Record<string, unknown> | null> = [];
    mocks.saveOnExit.mockImplementation(async () => {
      saved.push(mocks.autoSaveFields);
      return "draft-1";
    });
    const view = renderFlow(ExitWrapper);
    expect(view.result.current.start.promises.map((each) => each.commitmentId)).toEqual([9n]);

    await act(async () => view.result.current.start.chooseAction(7));
    await waitFor(() => expect(mocks.setActiveTab).toHaveBeenLastCalledWith("Media"));
    expect(saved.at(-1)).toMatchObject({ actionUID: 7, linkIntent: undefined });

    mocks.setActiveTab.mockClear();
    await act(async () => view.result.current.start.choosePromiseAction(choice));
    await waitFor(() => expect(mocks.setActiveTab).toHaveBeenLastCalledWith("Media"));
    expect(mocks.setDraftGarden).toHaveBeenLastCalledWith(ACTIVE_GARDEN);
    expect(saved.at(-1)).toMatchObject({
      actionUID: 9,
      linkIntent: expect.objectContaining({ commitmentId: "9", actionUID: 9 }),
    });

    await act(async () =>
      view.result.current.start.addEvidence(view.result.current.start.promises[0])
    );
    expect(exitPath).toBe(`/home/${ACTIVE_GARDEN}/commitments/9/proof`);
  });

  it("keeps Start on the path for a promise chosen there after the page's own link stopped holding", async () => {
    mocks.gardens = memberGardens;
    mocks.activeGarden = { status: "ready", gardenId: ACTIVE_GARDEN };
    mocks.gardenAddress = commitmentLinkIntent.garden;
    mocks.actions = [liveAction(1, null), liveAction(2, null)];
    // The page's link names the first requirement, which no longer holds; the second does.
    const other = {
      ...commitmentLinkIntent,
      requirementIndex: 1,
      requirementLabel: "2",
      actionUID: 2,
      approvedCount: 0,
      requiredCount: 4,
    };
    mocks.choices = [other];
    mocks.workable = {
      data: [promiseOwed([other], false)],
      isPending: false,
      isError: false,
      fetchStatus: "idle",
    };
    const view = enterFlow({ search: linkSearch });
    expect(view.result.current.linkIntentStatus).toBe("invalid");

    await act(async () => view.result.current.start.choosePromiseAction(other));

    expect(view.result.current.linkIntentStatus).toBe("valid");
    // Chosen on Start, so Back from Media returns to it rather than leaving the flow.
    expect(view.result.current.start.skipped).toBe(false);
  });

  it("lets go of a draft's action the garden chosen at Start does not offer, then waits for the member's pick", () => {
    solarGarden();
    // The draft's garden was curated away: its Agroforestry action stayed, its garden did not.
    mocks.gardenAddress = null;
    mocks.activeDraftId = "draft-1";
    mocks.actionUID = 5;
    mocks.actions = [liveAction(5, Domain.AGRO), liveAction(7, Domain.SOLAR)];
    const view = enterFlow();
    expect(view.result.current.submissionGardenSettled).toBe(false);

    act(() => view.result.current.start.chooseGarden(ACTIVE_GARDEN));
    expect(mocks.selectGarden).toHaveBeenLastCalledWith(ACTIVE_GARDEN);
    expect(mocks.setDraftAction).toHaveBeenLastCalledWith(null);

    // The garden settles with one action, and the flow does not choose it for the member.
    mocks.gardenAddress = ACTIVE_GARDEN;
    mocks.actionUID = null;
    view.rerender();
    expect(mocks.setActiveTab).not.toHaveBeenCalledWith("Media");
    expect(view.result.current.start.skipped).toBe(false);
  });

  it("never replaces a draft's own action with the garden's only one", () => {
    solarGarden();
    mocks.activeDraftId = "draft-1";
    // The draft's Solar action has ended; the garden now offers one other.
    mocks.actionUID = 5;
    mocks.actions = [
      { ...liveAction(5, Domain.SOLAR), endTime: Date.now() - 1 },
      liveAction(7, Domain.SOLAR),
    ];
    const { result } = enterFlow();

    expect(mocks.setDraftAction).not.toHaveBeenCalled();
    expect(mocks.setActiveTab).not.toHaveBeenCalled();
    expect(result.current.start.skipped).toBe(false);
  });

  it("keeps Start while the garden's Open asks are read, even with one action", () => {
    solarGarden();
    mocks.actions = [liveAction(7, Domain.SOLAR)];
    mocks.takeUpLoading = true;
    const { result } = enterFlow();

    expect(mocks.setActiveTab).not.toHaveBeenCalled();
    expect(result.current.start.skipped).toBe(false);
  });

  it.each([
    ["while a proof for it waits to send", new Set(["9"]), false],
    ["while the queue cannot be read", new Set<string>(), true],
  ])("offers no evidence on a promise %s", (_case, pendingCommitmentIds, isUnavailable) => {
    solarGarden();
    mocks.actions = [liveAction(7, Domain.SOLAR), liveAction(9, Domain.SOLAR)];
    mocks.workable = {
      data: [promiseOwed([owedChoice], true)],
      isPending: false,
      isError: false,
      fetchStatus: "idle",
    };
    mocks.queue = { pendingCommitmentIds, isUnavailable };
    const { result } = enterFlow();

    expect(result.current.start.promises).toEqual([
      expect.objectContaining({ commitmentId: 9n, takesEvidence: false }),
    ]);
  });

  it("lists the garden's Open asks after the member's promises, and takes one up through its action", async () => {
    solarGarden();
    mocks.actions = [liveAction(7, Domain.SOLAR), liveAction(9, Domain.SOLAR)];
    const choice = {
      ...commitmentLinkIntent,
      commitmentId: 31n,
      garden: ACTIVE_GARDEN,
      actionUID: 9,
      requiredCount: 2,
      takesUp: true as const,
    };
    const ask = { ...promiseOwed([choice], false), commitmentId: 31n, state: "REQUESTED" };
    mocks.takeUpAsks = [ask];
    mocks.takeUpChoices = [choice];
    const view = renderFlow(ExitWrapper);
    // Saying before the first prompt how many come: the take-up, the work, its link.
    expect(view.result.current.start.asks.map((each) => each.commitmentId)).toEqual([31n]);
    expect(view.result.current.start.askPromptCount).toBe(3);

    act(() => view.result.current.start.pickPromise(view.result.current.start.asks[0]));
    expect(view.result.current.start.screen).toMatchObject({
      kind: "promise",
      promise: { commitmentId: 31n },
    });

    await act(async () => view.result.current.start.choosePromiseAction(choice));
    expect(mocks.setDraftAction).toHaveBeenLastCalledWith(9);
    expect(mocks.setActiveTab).toHaveBeenLastCalledWith("Media");
    await waitFor(() => expect(view.result.current.linkIntentStatus).toBe("valid"));
    expect(view.result.current.promptCount).toBe(3);
  });
});
